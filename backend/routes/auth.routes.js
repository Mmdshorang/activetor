const router = require("express").Router();
const db = require("../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Op } = require("sequelize");
const { parseApiError } = require("../utils/apiError");
const { normalizePagePermissions } = require("../utils/pagePermissions");
const { normalizeIranPhone } = require("../utils/phone");
const { sendKavenegarOtp } = require("../utils/kavenegarOtp");
const axios = require("axios");
const OTP_EXPIRE_MINUTES = Number(process.env.OTP_EXPIRE_MINUTES || 2);
const OTP_RESEND_SECONDS = Number(process.env.OTP_RESEND_SECONDS || 60);
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const KAVENEGAR_API_KEY = "694A787A667A38326858303244707147527776314F413D3D";
const KAVENEGAR_TEMPLATE = "verify";

const buildAuthResponse = (entity, role) => ({
  id: entity.id,
  fullName: entity.fullName || null,
  username: entity.username || entity.phone || null,
  phone: entity.phone || null,
  role,
  pagePermissions: normalizePagePermissions(entity.pagePermissions, role),
});

const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

const createTokenForUser = (user) =>
  signToken({
    id: user.id,
    role: user.role || "admin",
    userType: "user",
    pagePermissions: normalizePagePermissions(
      user.pagePermissions,
      user.role || "admin",
    ),
  });

const createTokenForCustomer = (customer) =>
  signToken({
    id: customer.id,
    role: "customer",
    userType: "customer",
    pagePermissions: normalizePagePermissions([], "customer"),
  });

const findAccountByPhone = async (phone) => {
  const [user, customer] = await Promise.all([
    db.User.findOne({
      where: {
        [Op.or]: [{ phone }, { username: phone }],
      },
      attributes: { include: ["password"] },
    }),
    db.Customer.findOne({
      where: {
        [Op.or]: [{ phone }, { username: phone }],
      },
      attributes: { include: ["password"] },
    }),
  ]);

  if (user && customer) {
    return { conflict: true };
  }

  if (user) {
    return { type: "user", entity: user };
  }

  if (customer) {
    return { type: "customer", entity: customer };
  }

  return null;
};

const sendLoginResponse = (res, account) => {
  if (account.type === "user") {
    const token = createTokenForUser(account.entity);
    return res.json({
      success: true,
      token,
      user: buildAuthResponse(account.entity, account.entity.role || "admin"),
    });
  }

  const token = createTokenForCustomer(account.entity);
  return res.json({
    success: true,
    token,
    user: buildAuthResponse(account.entity, "customer"),
  });
};

const validateAndResolvePhoneAccount = async (phoneInput, res) => {
  const phone = normalizeIranPhone(phoneInput);
  if (!phone) {
    res.status(400).json({
      success: false,
      message: "شماره موبایل معتبر نیست",
    });
    return null;
  }

  const account = await findAccountByPhone(phone);
  if (!account) {
    res.status(404).json({
      success: false,
      message: "کاربری با این شماره موبایل یافت نشد",
    });
    return null;
  }

  if (account.conflict) {
    res.status(409).json({
      success: false,
      message: "این شماره موبایل همزمان برای چند حساب ثبت شده است",
    });
    return null;
  }

  if (account.entity.isActive === false) {
    const label = account.type === "customer" ? "مشتری" : "کاربر";
    res.status(403).json({
      success: false,
      message: `حساب ${label} غیرفعال است`,
    });
    return null;
  }

  return { phone, account };
};

const verifyOtpAndRespond = async ({ phoneInput, otpInput }, res) => {
  const otp = String(otpInput || "").trim();
  if (!otp || !/^\d{4,8}$/.test(otp)) {
    return res.status(400).json({
      success: false,
      message: "کد تایید معتبر نیست",
    });
  }

  const resolved = await validateAndResolvePhoneAccount(phoneInput, res);
  if (!resolved) return null;

  const { phone, account } = resolved;
  const otpRecord = await db.OtpCode.findOne({
    where: {
      phone,
      entityType: account.type,
      entityId: account.entity.id,
      isUsed: false,
    },
    order: [["createdAt", "DESC"]],
  });

  if (!otpRecord) {
    return res.status(400).json({
      success: false,
      message: "کد تایید یافت نشد، مجددا درخواست ارسال کد ثبت کنید",
    });
  }

  if (otpRecord.expiresAt < new Date()) {
    await otpRecord.update({ isUsed: true });
    return res.status(400).json({
      success: false,
      message: "کد تایید منقضی شده است",
    });
  }

  if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
    await otpRecord.update({ isUsed: true });
    return res.status(429).json({
      success: false,
      message: "تعداد تلاش بیش از حد مجاز است",
    });
  }

  const valid = await bcrypt.compare(otp, otpRecord.codeHash);
  if (!valid) {
    await otpRecord.update({ attempts: otpRecord.attempts + 1 });
    return res.status(400).json({
      success: false,
      message: "کد تایید اشتباه است",
    });
  }

  await otpRecord.update({
    isUsed: true,
    attempts: otpRecord.attempts + 1,
  });

  return sendLoginResponse(res, account);
};
router.post("/request-otp", async (req, res) => {
  try {
    const { phone, entityType = "USER", entityId = null } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "شماره موبایل الزامی است",
      });
    }

    // 1. ساخت OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // 2. هش کردن OTP
    const codeHash = await bcrypt.hash(otp, 10);

    // 3. ذخیره در دیتابیس (قبل از ارسال SMS)
    const otpRecord = await db.OtpCode.create({
      phone: String(phone).trim(),
      codeHash,
      isUsed: false,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 دقیقه
      entityType,
      entityId,
    });

    console.log("OTP saved:", otpRecord.id);

    // 4. ارسال پیامک (عدم وابستگی به fail شدن SMS)
    try {
      await axios.get(
        `https://api.kavenegar.com/v1/${process.env.KAVENEGAR_API_KEY}/verify/lookup.json`,
        {
          params: {
            receptor: phone,
            token: otp,
            template: process.env.KAVENEGAR_TEMPLATE,
          },
        }
      );

      console.log("SMS sent successfully");
    } catch (smsErr) {
      console.error("SMS FAILED (OTP still valid):", smsErr.message);
    }

    return res.json({
      success: true,
      message: "کد تایید ارسال شد",
    });
  } catch (err) {
    console.error("REQUEST OTP ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "خطا در ارسال OTP",
    });
  }
});
router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, otp } = req.body;

    const otpRecord = await db.OtpCode.findOne({
      where: {
        phone: String(phone).trim(),
        isUsed: false,
      },
      order: [["createdAt", "DESC"]],
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "کد معتبر نیست",
      });
    }

    if (new Date() > otpRecord.expiresAt) {
      return res.status(400).json({
        success: false,
        message: "کد منقضی شده است",
      });
    }

    const isValid = await bcrypt.compare(otp, otpRecord.codeHash);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "کد اشتباه است",
      });
    }

    // mark used
    await otpRecord.update({ isUsed: true });

    // 👇 این بخش مهمه: لاگین واقعی
    const user = await db.User.findOne({ where: { phone } });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "کاربر یافت نشد",
      });
    }

    const token = jwt.sign(
      { id: user.id, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      success: true,
      message: "ورود موفق",
      token,
      user,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "خطا در تایید کد",
    });
  }
});
router.post("/login", async (req, res) => {
  try {
    const hasOtpPayload = req.body?.phone || req.body?.otp;

    if (hasOtpPayload) {
      return verifyOtpAndRespond(
        { phoneInput: req.body?.phone, otpInput: req.body?.otp },
        res,
      );
    }

    const { username, password } = req.body;
    if (
      !username ||
      password === undefined ||
      password === null ||
      String(password) === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "برای ورود از موبایل و کد تایید استفاده کنید",
      });
    }

    const normalizedPassword = String(password);

    const user = await db.User.findOne({
      where: { username },
      attributes: { include: ["password"] },
    });

    if (user) {
      if (user.isActive === false) {
        return res.status(403).json({
          success: false,
          message: "حساب کاربر غیرفعال است",
        });
      }
      const valid = await bcrypt.compare(normalizedPassword, user.password);
      if (!valid) {
        return res.status(400).json({
          success: false,
          message: "نام کاربری یا رمز عبور اشتباه است",
        });
      }

      return sendLoginResponse(res, { type: "user", entity: user });
    }

    const customer = await db.Customer.findOne({
      where: { username },
      attributes: { include: ["password"] },
    });

    if (!customer || !customer.password) {
      return res.status(400).json({
        success: false,
        message: "نام کاربری یا رمز عبور اشتباه است",
      });
    }

    if (customer.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "حساب مشتری غیرفعال است",
      });
    }

    const validCustomer = await bcrypt.compare(
      normalizedPassword,
      customer.password,
    );
    if (!validCustomer) {
      return res.status(400).json({
        success: false,
        message: "نام کاربری یا رمز عبور اشتباه است",
      });
    }

    return sendLoginResponse(res, { type: "customer", entity: customer });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({
      success: false,
      message: parseApiError(err, "خطا در ورود به سیستم"),
    });
  }
});

module.exports = router;
