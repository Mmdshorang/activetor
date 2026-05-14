const jwt = require("jsonwebtoken");
const db = require("../models");
const { normalizePagePermissions } = require("../utils/pagePermissions");

module.exports = async (req, res, next) => {
  let token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Token is required"
    });
  }

  // Bearer token support
  if (token.startsWith("Bearer ")) {
    token = token.slice(7);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const isCustomer = decoded.userType === "customer" || decoded.role === "customer";

    if (isCustomer) {
      const customer = await db.Customer.findByPk(decoded.id, {
        attributes: ["id", "isActive"],
      });

      if (!customer) {
        return res.status(401).json({
          success: false,
          message: "حساب مشتری یافت نشد",
        });
      }

      if (customer.isActive === false) {
        return res.status(403).json({
          success: false,
          message: "حساب مشتری غیرفعال است",
        });
      }
    } else {
      const user = await db.User.findByPk(decoded.id, {
        attributes: ["id", "role", "isActive", "pagePermissions"],
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "حساب کاربر یافت نشد",
        });
      }

      if (user.isActive === false) {
        return res.status(403).json({
          success: false,
          message: "حساب کاربر غیرفعال است",
        });
      }

      decoded.role = user.role || decoded.role || "user";
      decoded.pagePermissions = normalizePagePermissions(user.pagePermissions, decoded.role);
    }

    req.user = decoded;

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
      error: err.message
    });
  }
};
