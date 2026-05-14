const router = require("express").Router();
const db = require("../models");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const { auth, allowRoles } = require("../middleware/authorize");
const { parseApiError } = require("../utils/apiError");
const { normalizeIranPhone } = require("../utils/phone");

router.use(auth);
router.use(allowRoles("admin", "user", "agent"));

const isAdmin = (req) => req.user?.role === "admin";

const sanitizeCustomer = (customer) => {
  const json = customer.toJSON ? customer.toJSON() : customer;
  delete json.password;
  return json;
};

const parseDateOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const parseBooleanValue = (value) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return null;
};

const calcDaysRemaining = (endDate) => {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
};

const ensureUniqueMobile = async (phone, excludeCustomerId = null) => {
  const where = {
    [Op.or]: [{ phone }, { username: phone }],
  };

  if (excludeCustomerId) {
    where.id = { [Op.ne]: excludeCustomerId };
  }

  return db.Customer.findOne({ where });
};

router.post("/upload-customers", async (req, res) => {
  try {
    if (req.user.role === "agent") {
      return res.status(403).json({ message: "نماینده مجاز به ثبت گروهی مشتری نیست" });
    }

    const customersData = req.body;
    if (!Array.isArray(customersData)) {
      return res.status(400).json({
        message: "ورودی باید یک آرایه از مشتریان باشد.",
      });
    }

    const currentUserId = req.user.id;
    const createdCustomers = [];
    const errors = [];

    for (const customerData of customersData) {
      try {
        const {
          fullName,
          phone,
          company,
          address,
          supportStatus,
          expireDate,
          licenseLimit,
          contractStartDate,
          contractEndDate,
          isActive,
        } = customerData;

        if (!fullName || !phone) {
          errors.push({
            customer: customerData,
            message: "نام و موبایل الزامی است",
          });
          continue;
        }

        const normalizedPhone = normalizeIranPhone(phone);
        if (!normalizedPhone) {
          errors.push({
            customer: customerData,
            message: "شماره موبایل معتبر نیست",
          });
          continue;
        }

        const normalizedLimit = Number(licenseLimit ?? 1);
        if (!Number.isInteger(normalizedLimit) || normalizedLimit < 1) {
          errors.push({
            customer: customerData,
            message: "سقف لایسنس باید یک عدد صحیح بزرگ‌تر از صفر باشد",
          });
          continue;
        }

        const duplicated = await ensureUniqueMobile(normalizedPhone);
        if (duplicated) {
          errors.push({
            customer: customerData,
            message: "این شماره موبایل قبلا ثبت شده است",
          });
          continue;
        }

        const normalizedIsActive = parseBooleanValue(isActive);
        if (isActive !== undefined && normalizedIsActive === null) {
          errors.push({
            customer: customerData,
            message: "وضعیت فعال بودن معتبر نیست",
          });
          continue;
        }

        const hashedPassword = await bcrypt.hash(String(normalizedPhone), 10);

        const newCustomer = await db.Customer.create({
          fullName,
          phone: normalizedPhone,
          company: company || null,
          address: address || null,
          supportStatus: isAdmin(req) ? supportStatus || null : null,
          expireDate: parseDateOrNull(expireDate),
          username: normalizedPhone,
          password: hashedPassword,
          licenseLimit: normalizedLimit,
          contractStartDate: parseDateOrNull(contractStartDate),
          contractEndDate: parseDateOrNull(contractEndDate || expireDate),
          userId: currentUserId,
          isActive: normalizedIsActive !== null ? normalizedIsActive : true,
        });

        createdCustomers.push(sanitizeCustomer(newCustomer));
      } catch (err) {
        errors.push({
          customer: customerData,
          message: parseApiError(err, "خطا در ایجاد مشتری"),
        });
      }
    }

    if (errors.length > 0) {
      return res.status(errors.length === customersData.length ? 400 : 207).json({
        message: "برخی از مشتریان با خطا پردازش شدند.",
        createdCustomers,
        errors,
      });
    }

    return res.status(201).json({
      message: "مشتریان با موفقیت ایجاد شدند.",
      createdCustomers,
    });
  } catch (err) {
    return res.status(500).json({
      message: parseApiError(err, "خطای کلی در پردازش درخواست"),
    });
  }
});

router.get("/", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "کاربر احراز هویت نشده است" });
    }

    const userId = req.user.id;
    const userRole = req.user.role;
    const whereCondition = userRole === "agent" ? { userId } : {};

    const customers = await db.Customer.findAll({
      where: whereCondition,
      order: [["createdAt", "DESC"]],
    });

    const enrichedCustomers = await Promise.all(
      customers.map(async (customer) => {
        const safeCustomer = sanitizeCustomer(customer);
        if (!isAdmin(req)) {
          delete safeCustomer.supportStatus;
        }
        const [latestContract, contractsCount] = await Promise.all([
          db.Contract.findOne({
            where: { customerId: customer.id },
            order: [["endDate", "DESC"]],
          }),
          db.Contract.count({ where: { customerId: customer.id } }),
        ]);

        return {
          ...safeCustomer,
          contractsCount,
          latestContractAmount: latestContract ? Number(latestContract.amount) : null,
          latestContractStartDate: latestContract ? latestContract.startDate : null,
          latestContractEndDate: latestContract ? latestContract.endDate : null,
          latestContractDaysRemaining: latestContract
            ? calcDaysRemaining(latestContract.endDate)
            : null,
        };
      }),
    );

    return res.json(enrichedCustomers);
  } catch (error) {
    return res
      .status(500)
      .json({ message: parseApiError(error, "خطا در دریافت لیست مشتریان") });
  }
});

router.post("/", async (req, res) => {
  try {
    if (req.user.role === "agent") {
      return res.status(403).json({ message: "نماینده فقط می‌تواند درخواست مشتری ثبت کند" });
    }

    const {
      fullName,
      phone,
      company,
      address,
      supportStatus,
      expireDate,
      licenseLimit,
      contractStartDate,
      contractEndDate,
      isActive,
    } = req.body;

    if (!fullName || !phone) {
      return res.status(400).json({
        message: "نام و موبایل الزامی است",
      });
    }

    const normalizedPhone = normalizeIranPhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ message: "شماره موبایل معتبر نیست" });
    }

    const normalizedLimit = Number(licenseLimit ?? 1);
    if (!Number.isInteger(normalizedLimit) || normalizedLimit < 1) {
      return res.status(400).json({
        message: "سقف لایسنس باید یک عدد صحیح بزرگ‌تر از صفر باشد",
      });
    }

    const duplicated = await ensureUniqueMobile(normalizedPhone);
    if (duplicated) {
      return res.status(400).json({ message: "این شماره موبایل قبلا ثبت شده است" });
    }

    const normalizedIsActive = parseBooleanValue(isActive);
    if (isActive !== undefined && normalizedIsActive === null) {
      return res.status(400).json({ message: "وضعیت فعال بودن معتبر نیست" });
    }

    const hashedPassword = await bcrypt.hash(String(normalizedPhone), 10);
    const currentUserId = req.user.id;

    const newCustomer = await db.Customer.create({
      fullName,
      phone: normalizedPhone,
      company: company || null,
      address: address || null,
      supportStatus: isAdmin(req) ? supportStatus || null : null,
      expireDate: parseDateOrNull(expireDate),
      username: normalizedPhone,
      password: hashedPassword,
      licenseLimit: normalizedLimit,
      contractStartDate: parseDateOrNull(contractStartDate),
      contractEndDate: parseDateOrNull(contractEndDate || expireDate),
      userId: currentUserId,
      isActive: normalizedIsActive !== null ? normalizedIsActive : true,
    });

    return res.status(201).json(sanitizeCustomer(newCustomer));
  } catch (err) {
    return res.status(500).json({ message: parseApiError(err, "خطا در ایجاد مشتری") });
  }
});

router.put("/:id", async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ message: "فقط ادمین می‌تواند اطلاعات مشتری را ویرایش کند" });
    }

    const customer = await db.Customer.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: "مشتری یافت نشد" });
    }

    const updatePayload = { ...req.body };
    if (!isAdmin(req)) {
      delete updatePayload.supportStatus;
    }

    if (Object.prototype.hasOwnProperty.call(updatePayload, "isActive")) {
      const normalizedIsActive = parseBooleanValue(updatePayload.isActive);
      if (normalizedIsActive === null) {
        return res.status(400).json({ message: "وضعیت فعال بودن معتبر نیست" });
      }
      updatePayload.isActive = normalizedIsActive;
    }

    if (Object.prototype.hasOwnProperty.call(updatePayload, "password")) {
      if (
        updatePayload.password === undefined ||
        updatePayload.password === null ||
        String(updatePayload.password) === ""
      ) {
        delete updatePayload.password;
      } else {
        updatePayload.password = await bcrypt.hash(String(updatePayload.password), 10);
      }
    }

    if (Object.prototype.hasOwnProperty.call(updatePayload, "username")) {
      updatePayload.phone = updatePayload.username;
    }

    if (Object.prototype.hasOwnProperty.call(updatePayload, "phone")) {
      const normalizedPhone = normalizeIranPhone(updatePayload.phone);
      if (!normalizedPhone) {
        return res.status(400).json({ message: "شماره موبایل معتبر نیست" });
      }

      const duplicated = await ensureUniqueMobile(normalizedPhone, customer.id);
      if (duplicated) {
        return res.status(400).json({ message: "این شماره موبایل قبلا ثبت شده است" });
      }

      updatePayload.phone = normalizedPhone;
      updatePayload.username = normalizedPhone;
    }

    if (Object.prototype.hasOwnProperty.call(updatePayload, "licenseLimit")) {
      const normalizedLimit = Number(updatePayload.licenseLimit);
      if (!Number.isInteger(normalizedLimit) || normalizedLimit < 1) {
        return res.status(400).json({
          message: "سقف لایسنس باید یک عدد صحیح بزرگ‌تر از صفر باشد",
        });
      }
      updatePayload.licenseLimit = normalizedLimit;
    }

    if (Object.prototype.hasOwnProperty.call(updatePayload, "contractStartDate")) {
      updatePayload.contractStartDate = parseDateOrNull(updatePayload.contractStartDate);
    }

    if (Object.prototype.hasOwnProperty.call(updatePayload, "contractEndDate")) {
      updatePayload.contractEndDate = parseDateOrNull(updatePayload.contractEndDate);
      updatePayload.expireDate = updatePayload.contractEndDate;
    } else if (Object.prototype.hasOwnProperty.call(updatePayload, "expireDate")) {
      updatePayload.expireDate = parseDateOrNull(updatePayload.expireDate);
    }

    await customer.update(updatePayload);
    return res.json(sanitizeCustomer(customer));
  } catch (err) {
    return res.status(500).json({ message: parseApiError(err, "خطا در ویرایش مشتری") });
  }
});

router.patch("/:id/activation", async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ message: "فقط ادمین می‌تواند وضعیت مشتری را تغییر دهد" });
    }

    const customer = await db.Customer.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: "مشتری یافت نشد" });
    }

    const normalizedIsActive = parseBooleanValue(req.body?.isActive);
    if (normalizedIsActive === null) {
      return res.status(400).json({ message: "وضعیت فعال بودن معتبر نیست" });
    }

    await customer.update({ isActive: normalizedIsActive });
    return res.json(sanitizeCustomer(customer));
  } catch (err) {
    return res.status(500).json({ message: parseApiError(err, "خطا در تغییر وضعیت مشتری") });
  }
});

router.get("/:id/license-info", async (req, res) => {
  try {
    const customer = await db.Customer.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: "مشتری یافت نشد" });
    }

    const count = await db.License.count({
      where: { customerId: customer.id },
    });

    return res.json({
      customerId: customer.id,
      limit: customer.licenseLimit || 0,
      count,
      remaining: Math.max((customer.licenseLimit || 0) - count, 0),
    });
  } catch (error) {
    return res.status(500).json({
      message: parseApiError(error, "خطا در دریافت وضعیت لایسنس مشتری"),
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const customer = await db.Customer.findByPk(req.params.id, {
      paranoid: false,
    });
    const role = req.user.role;

    if (!customer) {
      return res.status(404).json({ message: "مشتری یافت نشد" });
    }
    if (role !== "admin") {
      return res.status(403).json({ message: "شما اجاره این کار رو ندارید" });
    }

    await customer.destroy();
    return res.json({ message: "مشتری با موفقیت حذف شد" });
  } catch (err) {
    return res.status(500).json({ message: parseApiError(err, "خطا در حذف مشتری") });
  }
});

module.exports = router;
