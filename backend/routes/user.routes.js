// routes/user.routes.js
const router = require("express").Router();
const db = require("../models");
const bcrypt = require("bcryptjs");
const { auth, allowRoles } = require("../middleware/authorize");
const { parseApiError } = require("../utils/apiError");
const { ALL_PAGE_KEYS, normalizePagePermissions } = require("../utils/pagePermissions");

router.use(auth);
router.use(allowRoles("admin", "user"));

const parseBooleanValue = (value) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return null;
};

// دریافت لیست کاربران (بدون نمایش رمز عبور)
router.get("/", async (req, res) => {
  try {
    const users = await db.User.findAll({
      attributes: { exclude: ["password"] },
    });
    const normalizedUsers = users.map((user) => {
      const item = user.toJSON ? user.toJSON() : user;
      return {
        ...item,
        pagePermissions: normalizePagePermissions(item.pagePermissions, item.role),
      };
    });
    res.json(normalizedUsers);
  } catch (error) {
    res.status(500).json({ message: parseApiError(error, "خطا در دریافت لیست کاربران") });
  }
});

router.get("/page-permissions/options", (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "فقط ادمین مجاز است" });
  }

  return res.json({ pageKeys: ALL_PAGE_KEYS });
});

// افزودن کاربر جدید
router.post("/", async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    const allowedRoles = ["admin", "user", "agent"];
    const isAdminUser = req.user.role === "admin";

    if (password === undefined || password === null || String(password) === "") {
      return res.status(400).json({ message: "رمز عبور الزامی است" });
    }

    if (rest.role && !allowedRoles.includes(rest.role)) {
      return res.status(400).json({ message: "نقش نامعتبر است" });
    }
    if (!isAdminUser && Object.prototype.hasOwnProperty.call(rest, "pagePermissions")) {
      return res.status(403).json({ message: "فقط ادمین می‌تواند دسترسی صفحات را تنظیم کند" });
    }
    if (Object.prototype.hasOwnProperty.call(rest, "isActive")) {
      const normalizedIsActive = parseBooleanValue(rest.isActive);
      if (normalizedIsActive === null) {
        return res.status(400).json({ message: "وضعیت فعال بودن معتبر نیست" });
      }
      rest.isActive = normalizedIsActive;
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const role = rest.role || "user";
    const pagePermissions = normalizePagePermissions(
      isAdminUser ? rest.pagePermissions : undefined,
      role,
    );

    const newUser = await db.User.create({
      ...rest,
      role,
      password: hashedPassword,
      pagePermissions,
    });

    const { password: _, ...userWithoutPassword } = newUser.toJSON();
    res.status(201).json({
      ...userWithoutPassword,
      pagePermissions: normalizePagePermissions(userWithoutPassword.pagePermissions, userWithoutPassword.role),
      allowedPageKeys: ALL_PAGE_KEYS,
    });
  } catch (err) {
    res.status(500).json({ message: parseApiError(err, "خطا در ایجاد کاربر") });
  }
});

// ویرایش کاربر
router.put("/:id", async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    const allowedRoles = ["admin", "user", "agent"];
    const isAdminUser = req.user.role === "admin";
    const user = await db.User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "کاربر یافت نشد" });
    }

    const updatedData = { ...rest };

    if (updatedData.role && !allowedRoles.includes(updatedData.role)) {
      return res.status(400).json({ message: "نقش نامعتبر است" });
    }
    if (!isAdminUser && Object.prototype.hasOwnProperty.call(rest, "pagePermissions")) {
      return res.status(403).json({ message: "فقط ادمین می‌تواند دسترسی صفحات را تنظیم کند" });
    }
    if (Object.prototype.hasOwnProperty.call(rest, "isActive")) {
      const normalizedIsActive = parseBooleanValue(rest.isActive);
      if (normalizedIsActive === null) {
        return res.status(400).json({ message: "وضعیت فعال بودن معتبر نیست" });
      }
      updatedData.isActive = normalizedIsActive;
    }

    const targetRole = updatedData.role || user.role || "user";
    if (isAdminUser && Object.prototype.hasOwnProperty.call(rest, "pagePermissions")) {
      updatedData.pagePermissions = normalizePagePermissions(rest.pagePermissions, targetRole);
    } else if (updatedData.role && updatedData.role === "admin") {
      updatedData.pagePermissions = normalizePagePermissions([], "admin");
    }

    if (password !== undefined && password !== null && String(password) !== "") {
      updatedData.password = await bcrypt.hash(String(password), 10);
    }

    await user.update(updatedData);

    const { password: _, ...updatedUser } = user.toJSON();
    res.json({
      ...updatedUser,
      pagePermissions: normalizePagePermissions(updatedUser.pagePermissions, updatedUser.role),
      allowedPageKeys: ALL_PAGE_KEYS,
    });
  } catch (err) {
    res.status(500).json({ message: parseApiError(err, "خطا در ویرایش کاربر") });
  }
});

router.patch("/:id/activation", async (req, res) => {
  try {
    const normalizedIsActive = parseBooleanValue(req.body?.isActive);
    if (normalizedIsActive === null) {
      return res.status(400).json({ message: "وضعیت فعال بودن معتبر نیست" });
    }

    const user = await db.User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "کاربر یافت نشد" });
    }

    await user.update({ isActive: normalizedIsActive });

    const { password: _, ...updatedUser } = user.toJSON();
    return res.json({
      ...updatedUser,
      pagePermissions: normalizePagePermissions(updatedUser.pagePermissions, updatedUser.role),
      allowedPageKeys: ALL_PAGE_KEYS,
    });
  } catch (err) {
    return res.status(500).json({ message: parseApiError(err, "خطا در تغییر وضعیت کاربر") });
  }
});

module.exports = router;


