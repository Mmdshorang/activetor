const router = require("express").Router();
const db = require("../models");
const { Op } = require("sequelize");
const { auth } = require("../middleware/authorize");
const { parseApiError, logApiError } = require("../utils/apiError");
const { parseDateOnly } = require("../utils/dateOnly");

router.use(auth);

const canManageAll = (req) =>
  req.user.role === "admin" || req.user.role === "user";
const isCustomer = (req) => req.user.role === "customer";

const parseDateOrNull = (value) => {
  return parseDateOnly(value);
};

const resolveCustomerId = (payload = {}, query = {}) => {
  const rawId =
    payload.customerId || payload.userId || query.customerId || query.userId;
  if (!rawId) return null;
  const parsed = Number(rawId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

// License codes are opaque values; preserve empty strings and all whitespace.
const normalizeLicenseCode = (value) => String(value ?? "");

const buildLicenseCodesWhere = (code1, code2, code3, excludeId = null) => {
  const where = {
    code1,
  };

  const and = [];
  const normalizedCode2 = normalizeLicenseCode(code2);
  const normalizedCode3 = normalizeLicenseCode(code3);

  if (normalizedCode2) {
    where.code2 = normalizedCode2;
  } else {
    and.push({ [Op.or]: [{ code2: null }, { code2: "" }] });
  }

  if (normalizedCode3) {
    where.code3 = normalizedCode3;
  } else {
    and.push({ [Op.or]: [{ code3: null }, { code3: "" }] });
  }

  if (and.length) {
    where[Op.and] = and;
  }

  if (excludeId) {
    where.id = { [Op.ne]: excludeId };
  }

  return where;
};

const findDuplicateLicense = async (code1, code2, code3, excludeId = null) => {
  return db.License.findOne({
    where: buildLicenseCodesWhere(code1, code2, code3, excludeId),
    include: [
      {
        model: db.Customer,
        as: "customer",
        attributes: ["id", "fullName", "username"],
      },
    ],
  });
};

const buildDuplicateLicenseMessage = (license) => {
  const customerName =
    license.customer?.fullName ||
    license.customer?.username ||
    `ID: ${license.customerId}`;

  return `این ترکیب لایسنس قبلاً برای ${customerName} ثبت شده است`;
};

const checkCustomerLicenseCapacity = async (
  customerId,
  currentLicenseId = null,
) => {
  const customer = await db.Customer.findByPk(customerId);
  if (!customer) {
    return { ok: false, status: 404, message: "مشتری یافت نشد" };
  }

  const where = { customerId };
  if (currentLicenseId) {
    where.id = { [Op.ne]: currentLicenseId };
  }

  const count = await db.License.count({ where });
  if (count >= customer.licenseLimit) {
    return {
      ok: false,
      status: 400,
      message: "ظرفیت لایسنس این مشتری پر شده است",
    };
  }

  return { ok: true, customer };
};

router.get("/my-info", async (req, res) => {
  try {
    if (!isCustomer(req)) {
      return res.status(403).json({ message: "دسترسی غیرمجاز" });
    }

    const customer = await db.Customer.findByPk(req.user.id);
    if (!customer) return res.status(404).json({ message: "مشتری یافت نشد" });

    const count = await db.License.count({
      where: { customerId: req.user.id },
    });
    return res.json({
      customerId: req.user.id,
      limit: customer.licenseLimit || 0,
      count,
      remaining: Math.max((customer.licenseLimit || 0) - count, 0),
    });
  } catch (error) {
    console.error("License my-info failed:", error);
    return res
      .status(500)
      .json({ message: parseApiError(error, "خطا در دریافت اطلاعات لایسنس") });
  }
});

// دریافت لیست لایسنس‌ها
router.get("/", async (req, res) => {
  try {
    let where = {};

    if (isCustomer(req)) {
      where = { customerId: req.user.id };
    } else if (canManageAll(req)) {
      const customerId = resolveCustomerId({}, req.query);
      where = customerId ? { customerId } : {};
    } else {
      return res.status(403).json({ message: "دسترسی غیرمجاز" });
    }

    const licenses = await db.License.findAll({
      where,
      include: [
        {
          model: db.Customer,
          as: "customer",
          attributes: ["id", "fullName", "username", "phone", "company"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
    res.json(licenses);
  } catch (error) {
    console.error("License list failed:", error);
    res
      .status(500)
      .json({ message: parseApiError(error, "خطا در دریافت لایسنس ها") });
  }
});

router.post("/validate", async (req, res) => {
  try {
    let customerId = resolveCustomerId(req.body);
    const { systemName, version, code2, code3 } = req.body;
    const code1 = normalizeLicenseCode(req.body.code1);

    if (isCustomer(req)) {
      customerId = req.user.id;
    } else if (!canManageAll(req)) {
      return res.status(403).json({ message: "دسترسی غیرمجاز" });
    }

    if (!customerId) {
      return res.status(400).json({ message: "شناسه مشتری الزامی است" });
    }
    if (!systemName || !version) {
      return res.status(400).json({ message: "نام سیستم و نسخه الزامی است" });
    }
    const customerCheck = await checkCustomerLicenseCapacity(customerId);
    if (!customerCheck.ok) {
      return res
        .status(customerCheck.status)
        .json({ message: customerCheck.message });
    }

    const duplicateLicense = await findDuplicateLicense(code1, code2, code3);
    if (duplicateLicense) {
      return res
        .status(400)
        .json({ message: buildDuplicateLicenseMessage(duplicateLicense) });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error("License validate failed:", error);
    return res
      .status(500)
      .json({ message: parseApiError(error, "خطا در اعتبارسنجی لایسنس") });
  }
});

// افزودن لایسنس جدید
router.post("/", async (req, res) => {
  try {
    let customerId = resolveCustomerId(req.body);
    const {
      systemName,
      version,
      expireDate,
      isActive,
      licenseId,
    } = req.body;
    const code1 = normalizeLicenseCode(req.body.code1);
    const code2 = normalizeLicenseCode(req.body.code2);
    const code3 = normalizeLicenseCode(req.body.code3);

    if (isCustomer(req)) {
      customerId = req.user.id;
    } else if (!canManageAll(req)) {
      return res.status(403).json({ message: "دسترسی غیرمجاز" });
    }

    if (!customerId) {
      return res.status(400).json({ message: "شناسه مشتری الزامی است" });
    }
    if (!systemName || !version) {
      return res.status(400).json({ message: "نام سیستم و نسخه الزامی است" });
    }

    const customerCheck = await checkCustomerLicenseCapacity(customerId);
    if (!customerCheck.ok) {
      return res
        .status(customerCheck.status)
        .json({ message: customerCheck.message });
    }

    const duplicateLicense = await findDuplicateLicense(
      code1,
      code2,
      code3,
    );

    if (duplicateLicense) {
      return res.status(400).json({
        message: buildDuplicateLicenseMessage(duplicateLicense),
      });
    }

    const newLicense = await db.License.create({
      systemName,
      version,
      code1,
      code2,
      code3,
      expireDate: parseDateOrNull(expireDate),
      isActive: canManageAll(req)
        ? isActive !== undefined
          ? isActive
          : true
        : true,
      customerId,
      licenseId,
    });

    // دوباره fetch با relation
    const licenseWithCustomer = await db.License.findByPk(newLicense.id, {
      include: [
        {
          model: db.Customer,
          as: "customer",
          attributes: ["id", "fullName", "phone","company"],
        },
      ],
    });

    res.status(201).json(licenseWithCustomer);
  } catch (err) {
    logApiError("License create failed", err, {
      body: req.body,
      user: { id: req.user?.id, role: req.user?.role },
    });
    res
      .status(500)
      .json({ message: parseApiError(err, "خطا در ایجاد لایسنس") });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!canManageAll(req)) {
      return res
        .status(403)
        .json({ message: "فقط ادمین یا کاربر مجاز به ویرایش لایسنس است" });
    }

    const license = await db.License.findByPk(req.params.id);
    if (!license) {
      return res.status(404).json({ message: "لایسنس یافت نشد" });
    }

    const customerId = resolveCustomerId(req.body) || license.customerId;
    if (!customerId) {
      return res.status(400).json({ message: "شناسه مشتری الزامی است" });
    }

    if (customerId !== license.customerId) {
      const customerCheck = await checkCustomerLicenseCapacity(
        customerId,
        license.id,
      );
      if (!customerCheck.ok) {
        return res
          .status(customerCheck.status)
          .json({ message: customerCheck.message });
      }
    }

    const nextCode1 = Object.prototype.hasOwnProperty.call(req.body, "code1")
      ? normalizeLicenseCode(req.body.code1)
      : license.code1;
    const nextCode2 = Object.prototype.hasOwnProperty.call(req.body, "code2")
      ? normalizeLicenseCode(req.body.code2)
      : license.code2;
    const nextCode3 = Object.prototype.hasOwnProperty.call(req.body, "code3")
      ? normalizeLicenseCode(req.body.code3)
      : license.code3;

    const duplicateLicense = await findDuplicateLicense(
      nextCode1,
      nextCode2,
      nextCode3,
      license.id,
    );

    if (duplicateLicense) {
      return res.status(400).json({
        message: buildDuplicateLicenseMessage(duplicateLicense),
      });
    }

    const updatePayload = {
      ...req.body,
      customerId,
      code1: nextCode1,
      code2: nextCode2,
      code3: nextCode3,
    };

    if (Object.prototype.hasOwnProperty.call(updatePayload, "userId")) {
      delete updatePayload.userId;
    }

    if (Object.prototype.hasOwnProperty.call(updatePayload, "expireDate")) {
      updatePayload.expireDate = parseDateOrNull(updatePayload.expireDate);
    }

    await license.update(updatePayload);
    return res.json(license);
  } catch (error) {
    console.error("License update failed:", error);
    return res
      .status(500)
      .json({ message: parseApiError(error, "خطا در ویرایش لایسنس") });
  }
});

// حذف لایسنس
router.delete("/:id", async (req, res) => {
  try {
    if (!canManageAll(req)) {
      return res
        .status(403)
        .json({ message: "فقط ادمین یا کاربر مجاز به حذف لایسنس است" });
    }

    const license = await db.License.findByPk(req.params.id);
    if (!license) {
      return res.status(404).json({ message: "لایسنس یافت نشد" });
    }
    await license.destroy();
    res.json({ message: "لایسنس با موفقیت حذف شد" });
  } catch (err) {
    console.error("License delete failed:", err);
    res
      .status(500)
      .json({ message: parseApiError(err, "خطا در حذف لایسنس") });
  }
});

module.exports = router;
