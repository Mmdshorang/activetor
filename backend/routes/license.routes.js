const router = require("express").Router();
const db = require("../models");
const { Op } = require("sequelize");
const { auth } = require("../middleware/authorize");
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

const buildLicenseCode = () => {
  const suffix = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `LIC-${Date.now().toString(36).toUpperCase()}-${suffix}`;
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
    return res.status(500).json({ message: "خطا در دریافت اطلاعات لایسنس" });
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
    res.status(500).json({ message: "خطا در دریافت لایسنس ها" });
  }
});

// افزودن لایسنس جدید
router.post("/", async (req, res) => {
  try {
    let customerId = resolveCustomerId(req.body);
    const {
      systemName,
      version,
      code1,
      code2,
      code3,
      expireDate,
      isActive,
      licenseId,
    } = req.body;

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

    const finalCode1 = code1 || buildLicenseCode();
    const duplicateLicense = await db.License.findOne({
      where: {
        code1: finalCode1,
        code2: code2 ?? null,
        code3: code3 ?? null,
      },
      include: [
        {
          model: db.Customer,
          as: "customer",
          attributes: ["id", "fullName", "username"],
        },
      ],
    });

    if (duplicateLicense) {
      const customerName =
        duplicateLicense.customer?.fullName ||
        duplicateLicense.customer?.username ||
        `ID: ${duplicateLicense.customerId}`;

      return res.status(400).json({
        message: `این ترکیب لایسنس قبلاً برای ${customerName} ثبت شده است`,
        duplicate: {
          licenseId: duplicateLicense.id,
          code1: duplicateLicense.code1,
          code2: duplicateLicense.code2,
          code3: duplicateLicense.code3,
          customer: {
            id: duplicateLicense.customer?.id,
            name:
              duplicateLicense.customer?.fullName ||
              duplicateLicense.customer?.username,
          },
        },
      });
    }

    const newLicense = await db.License.create({
      systemName,
      version,
      code1: finalCode1,
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
    res.status(500).json({ message: "خطا در ایجاد لایسنس" });
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

    if (req.body.code1 && req.body.code1 !== license.code1) {
      const duplicateCode = await db.License.findOne({
        where: { code1: req.body.code1 },
      });
      if (duplicateCode) {
        return res
          .status(400)
          .json({ message: "کد فعال‌سازی قبلاً ثبت شده است." });
      }
    }

    const updatePayload = {
      ...req.body,
      customerId,
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
    return res.status(500).json({ message: "خطا در ویرایش لایسنس" });
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
    res.status(500).json({ message: "خطا در حذف لایسنس" });
  }
});

module.exports = router;
