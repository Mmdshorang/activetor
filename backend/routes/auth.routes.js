const router = require("express").Router();
const db = require("../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { parseApiError } = require("../utils/apiError");

const buildAuthResponse = (entity, role) => ({
  id: entity.id,
  fullName: entity.fullName || null,
  username: entity.username,
  role,
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || password === undefined || password === null || String(password) === "") {
      return res.status(400).json({
        success: false,
        message: "نام کاربری و رمز عبور الزامی است",
      });
    }

    const normalizedPassword = String(password);

    const user = await db.User.findOne({
      where: { username },
      attributes: { include: ["password"] },
    });

    if (user) {
      const valid = await bcrypt.compare(normalizedPassword, user.password);
      if (!valid) {
        return res.status(400).json({
          success: false,
          message: "نام کاربری یا رمز عبور اشتباه است",
        });
      }

      const token = jwt.sign(
        { id: user.id, role: user.role || "admin", userType: "user" },
        process.env.JWT_SECRET,
        { expiresIn: "7d" },
      );

      return res.json({
        success: true,
        token,
        user: buildAuthResponse(user, user.role || "admin"),
      });
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

    const validCustomer = await bcrypt.compare(normalizedPassword, customer.password);
    if (!validCustomer) {
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

    const token = jwt.sign(
      { id: customer.id, role: "customer", userType: "customer" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.json({
      success: true,
      token,
      user: buildAuthResponse(customer, "customer"),
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({
      success: false,
      message: parseApiError(err, "خطا در ورود به سیستم"),
    });
  }
});

module.exports = router;


