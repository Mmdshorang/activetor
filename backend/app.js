const express = require("express");
const cors = require("cors");
require("./config/loadEnv")();
const db = require("./models");

const statsRoutes = require("./routes/stats.routes");
const licenseRoutes = require("./routes/license.routes");
const contractRoutes = require("./routes/contract.routes");
const renewalRequestRoutes = require("./routes/renewal-request.routes");
const customerRequestRoutes = require("./routes/customer-request.routes");
const settingsRoutes = require("./routes/settings.routes");
const { scheduleJobs } = require("./jobs/scheduler");
const {
  removeSingleCodeUniqueConstraints,
} = require("./utils/licenseConstraints");

const app = express();
const PORT = process.env.PORT || 5000;

// 👇 گرفتن مدل Log
const { Log } = db;

// -------------------- MIDDLEWARES --------------------
app.use(cors());
app.use(express.json());

/**
 * 🔥 LOG MIDDLEWARE (Production Safe)
 */
app.use((req, res, next) => {
  res.on("finish", () => {
    setImmediate(async () => {
      try {
        // فقط API ها رو لاگ کن (اختیاری ولی توصیه‌شده)
        if (!req.originalUrl.startsWith("/api")) return;

        // فقط درخواست‌های مهم (اختیاری)
        const shouldLog =
          res.statusCode >= 400 || req.method !== "GET";

        if (!shouldLog) return;

        await Log.create({
          level: res.statusCode >= 400 ? "ERROR" : "INFO",
          action: `${req.method} ${req.originalUrl}`,
          message: `Status: ${res.statusCode}`,
          userId: req.user?.id || null,
          ip: req.ip,
          requestBody: req.body ? JSON.stringify(req.body) : null,
        });
      } catch (err) {
        console.error("❌ Log failed:", err.message);
      }
    });
  });

  next();
});

// -------------------- ROUTES --------------------
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/users", require("./routes/user.routes"));
app.use("/api/customers", require("./routes/customer.routes"));
app.use("/api/versions", require("./routes/version.routes"));
app.use("/api/messages", require("./routes/message.routes"));
app.use("/api/stats", statsRoutes);
app.use("/api/licenses", licenseRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/renewal-requests", renewalRequestRoutes);
app.use("/api/customer-requests", customerRequestRoutes);
app.use("/api/settings", settingsRoutes);

// -------------------- DB + SERVER START --------------------
db.sequelize
  .sync({ alter: true })
  .then(async () => {
    await removeSingleCodeUniqueConstraints(db.sequelize);
    console.log("🟢 Database synced successfully");

    scheduleJobs(db);

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("🔴 DB Sync Error:", err);
  });
