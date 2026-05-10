const router = require("express").Router();
const db = require("../models");
const bcrypt = require("bcryptjs");
const { auth, allowRoles } = require("../middleware/authorize");
const { parseApiError } = require("../utils/apiError");

router.use(auth);
router.use(allowRoles("admin", "user"));

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

const resolveOwnerUserId = async (providedUserId) => {
  if (providedUserId) {
    return providedUserId;
  }
  const fallbackUser = await db.User.findOne({ order: [["id", "ASC"]] });
  return fallbackUser ? fallbackUser.id : null;
};

const calcDaysRemaining = (endDate) => {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  end.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
};
router.post("/upload-customers", async (req, res) => {
  try {
    const customersData = req.body; // فرض می‌کنیم req.body خودش یک آرایه از داده‌های مشتریان است

    // بررسی می‌کنیم که ورودی یک آرایه باشد
    if (!Array.isArray(customersData)) {
      return res.status(400).json({
        message: "ورودی باید یک آرایه از مشتریان باشد.",
      });
    }

    const createdCustomers = [];
    const errors = [];

    // اگر ورودی یک آرایه است، روی آن حلقه می‌زنیم
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
          userId,
          isActive,
        } = customerData;

        // اعتبارسنجی ورودی برای هر مشتری
        if (!fullName || !phone) {
          errors.push({
            customer: customerData,
            message: "نام و موبایل الزامی است",
          });
          continue; // رفتن به مشتری بعدی در صورت خطا
        }

        const normalizedLimit = Number(licenseLimit ?? 1);
        if (!Number.isInteger(normalizedLimit) || normalizedLimit < 1) {
          errors.push({
            customer: customerData,
            message: "سقف لایسنس باید یک عدد صحیح بزرگ‌تر از صفر باشد",
          });
          continue;
        }

        // فرض می‌کنیم userId برای همه مشتریان در آرایه یکسان است یا باید از هر کدام جداگانه خوانده شود.
        // در این مثال، از userId اولین مشتری یا مقدار پیش‌فرض استفاده می‌کنیم.
        // اگر userId برای هر مشتری متفاوت است، باید آن را از customerData بخوانید.
        const currentUserId = customerData.userId || userId; // یا از customerData.userId استفاده کنید اگر برای هر مشتری متفاوت است
        const ownerUserId = await resolveOwnerUserId(currentUserId);
        if (!ownerUserId) {
          errors.push({
            customer: customerData,
            message: "ابتدا یک کاربر ادمین ثبت کنید",
          });
          continue;
        }

        const existingPhone = await db.Customer.findOne({ where: { phone } });
        if (existingPhone) {
          errors.push({
            customer: customerData,
            message: "این شماره موبایل قبلا ثبت شده است",
          });
          continue;
        }

        const hashedPassword = await bcrypt.hash(String(phone), 10);

        const newCustomer = await db.Customer.create({
          fullName,
          phone,
          company: company || null,
          address: address || null,
          supportStatus: supportStatus || null,
          expireDate: parseDateOrNull(expireDate),
          username: phone || null,
          password: hashedPassword,
          licenseLimit: normalizedLimit,
          contractStartDate: parseDateOrNull(contractStartDate),
          contractEndDate: parseDateOrNull(contractEndDate || expireDate),
          userId: ownerUserId,
          isActive: isActive !== undefined ? Boolean(isActive) : true,
        });

        createdCustomers.push(sanitizeCustomer(newCustomer));
      } catch (err) {
        // خطاهای احتمالی دیگر در هنگام پردازش یک مشتری خاص
        errors.push({
          customer: customerData,
          message: parseApiError(err, "خطا در ایجاد مشتری"),
        });
      }
    }

    // ارسال پاسخ نهایی
    if (errors.length > 0) {
      // اگر خطایی رخ داده است، هم مشتریان موفق و هم خطاها را برمی‌گردانیم
      return res
        .status(errors.length === customersData.length ? 400 : 207)
        .json({
          message: "برخی از مشتریان با خطا پردازش شدند.",
          createdCustomers: createdCustomers,
          errors: errors,
        });
    } else {
      // اگر همه چیز موفقیت‌آمیز بود
      res.status(201).json({
        message: "مشتریان با موفقیت ایجاد شدند.",
        createdCustomers: createdCustomers,
      });
    }
  } catch (err) {
    // خطای کلی که ممکن است خارج از حلقه رخ دهد (مثلاً در resolveOwnerUserId اگر برای همه مشتریان یکسان باشد و مشکل داشته باشد)
    res
      .status(500)
      .json({ message: parseApiError(err, "خطای کلی در پردازش درخواست") });
  }
});
// دریافت لیست مشتریان
router.get("/", async (req, res) => {
  try {
    const customers = await db.Customer.findAll({
      order: [["createdAt", "DESC"]],
    });

    const enrichedCustomers = await Promise.all(
      customers.map(async (customer) => {
        const safeCustomer = sanitizeCustomer(customer);
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
          latestContractAmount: latestContract
            ? Number(latestContract.amount)
            : null,
          latestContractStartDate: latestContract
            ? latestContract.startDate
            : null,
          latestContractEndDate: latestContract ? latestContract.endDate : null,
          latestContractDaysRemaining: latestContract
            ? calcDaysRemaining(latestContract.endDate)
            : null,
        };
      }),
    );

    res.json(enrichedCustomers);
  } catch (error) {
    res
      .status(500)
      .json({ message: parseApiError(error, "خطا در دریافت لیست مشتریان") });
  }
});

// افزودن مشتری جدید
router.post("/", async (req, res) => {
  try {
    const {
      fullName,
      phone,
      company,
      address,
      supportStatus,
      expireDate,
      username,
      password,
      licenseLimit,
      contractStartDate,
      contractEndDate,
      userId,
      isActive,
    } = req.body;

    if (
      !fullName ||
      !phone ||
      !username ||
      password === undefined ||
      password === null ||
      String(password) === ""
    ) {
      return res.status(400).json({
        message: "نام، موبایل، نام کاربری و رمز عبور الزامی است",
      });
    }

    const normalizedLimit = Number(licenseLimit ?? 1);
    if (!Number.isInteger(normalizedLimit) || normalizedLimit < 1) {
      return res.status(400).json({
        message: "سقف لایسنس باید یک عدد صحیح بزرگ‌تر از صفر باشد",
      });
    }

    const ownerUserId = await resolveOwnerUserId(userId);
    if (!ownerUserId) {
      return res.status(400).json({
        message: "ابتدا یک کاربر ادمین ثبت کنید",
      });
    }

    const existingUsername = await db.Customer.findOne({ where: { username } });
    if (existingUsername) {
      return res
        .status(400)
        .json({ message: "این نام کاربری قبلا ثبت شده است" });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);

    const newCustomer = await db.Customer.create({
      fullName,
      phone,
      company: company || null,
      address: address || null,
      supportStatus: supportStatus || null,
      expireDate: parseDateOrNull(expireDate),
      username,
      password: hashedPassword,
      licenseLimit: normalizedLimit,
      contractStartDate: parseDateOrNull(contractStartDate),
      contractEndDate: parseDateOrNull(contractEndDate || expireDate),
      userId: ownerUserId,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    res.status(201).json(sanitizeCustomer(newCustomer));
  } catch (err) {
    res.status(500).json({ message: parseApiError(err, "خطا در ایجاد مشتری") });
  }
});

// ویرایش مشتری (برای تغییر وضعیت یا اطلاعات)
router.put("/:id", async (req, res) => {
  try {
    const customer = await db.Customer.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: "مشتری یافت نشد" });
    }

    const updatePayload = { ...req.body };

    if (Object.prototype.hasOwnProperty.call(updatePayload, "password")) {
      if (
        updatePayload.password === undefined ||
        updatePayload.password === null ||
        String(updatePayload.password) === ""
      ) {
        delete updatePayload.password;
      } else {
        updatePayload.password = await bcrypt.hash(
          String(updatePayload.password),
          10,
        );
      }
    }

    if (Object.prototype.hasOwnProperty.call(updatePayload, "username")) {
      if (!updatePayload.username) {
        return res
          .status(400)
          .json({ message: "نام کاربری نمی‌تواند خالی باشد" });
      }
      const duplicateUsername = await db.Customer.findOne({
        where: { username: updatePayload.username },
      });
      if (duplicateUsername && duplicateUsername.id !== customer.id) {
        return res
          .status(400)
          .json({ message: "این نام کاربری قبلا ثبت شده است" });
      }
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

    if (
      Object.prototype.hasOwnProperty.call(updatePayload, "contractStartDate")
    ) {
      updatePayload.contractStartDate = parseDateOrNull(
        updatePayload.contractStartDate,
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(updatePayload, "contractEndDate")
    ) {
      updatePayload.contractEndDate = parseDateOrNull(
        updatePayload.contractEndDate,
      );
      updatePayload.expireDate = updatePayload.contractEndDate;
    }

    await customer.update(updatePayload);
    res.json(sanitizeCustomer(customer));
  } catch (err) {
    res
      .status(500)
      .json({ message: parseApiError(err, "خطا در ویرایش مشتری") });
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

// حذف مشتری
router.delete("/:id", async (req, res) => {
  try {
    const customer = await db.Customer.findByPk(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: "مشتری یافت نشد" });
    }

    await customer.destroy();
    res.json({ message: "مشتری با موفقیت حذف شد" });
  } catch (err) {
    res.status(500).json({ message: parseApiError(err, "خطا در حذف مشتری") });
  }
});

module.exports = router;
