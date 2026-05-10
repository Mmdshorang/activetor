// routes/user.routes.js
const router = require("express").Router();
const db = require("../models");
const bcrypt = require("bcryptjs");
const { auth, allowRoles } = require("../middleware/authorize");
const { parseApiError } = require("../utils/apiError");

router.use(auth);
router.use(allowRoles("admin", "user"));

// دریافت لیست کاربران (بدون نمایش رمز عبور)
router.get("/", async (req, res) => {
  try {
    const users = await db.User.findAll({
      attributes: { exclude: ["password"] },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: parseApiError(error, "خطا در دریافت لیست کاربران") });
  }
});

// افزودن کاربر جدید
router.post("/", async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    const allowedRoles = ["admin", "user", "agent"];

    if (password === undefined || password === null || String(password) === "") {
      return res.status(400).json({ message: "رمز عبور الزامی است" });
    }

    if (rest.role && !allowedRoles.includes(rest.role)) {
      return res.status(400).json({ message: "نقش نامعتبر است" });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);

    const newUser = await db.User.create({
      ...rest,
      role: rest.role || "user",
      password: hashedPassword,
    });

    const { password: _, ...userWithoutPassword } = newUser.toJSON();
    res.status(201).json(userWithoutPassword);
  } catch (err) {
    res.status(500).json({ message: parseApiError(err, "خطا در ایجاد کاربر") });
  }
});

// ویرایش کاربر
router.put("/:id", async (req, res) => {
  try {
    const { password, ...rest } = req.body;
    const allowedRoles = ["admin", "user", "agent"];
    const user = await db.User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "کاربر یافت نشد" });
    }

    const updatedData = { ...rest };

    if (updatedData.role && !allowedRoles.includes(updatedData.role)) {
      return res.status(400).json({ message: "نقش نامعتبر است" });
    }

    if (password !== undefined && password !== null && String(password) !== "") {
      updatedData.password = await bcrypt.hash(String(password), 10);
    }

    await user.update(updatedData);

    const { password: _, ...updatedUser } = user.toJSON();
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: parseApiError(err, "خطا در ویرایش کاربر") });
  }
});

module.exports = router;


