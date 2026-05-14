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

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
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

// 🔥 مهم‌ترین بخش (Fix اصلی مشکل تو)
db.sequelize
  .sync({ alter: true }) // 👈 این باعث ساخت/آپدیت جدول‌ها میشه
  .then(() => {
    console.log("🟢 Database synced successfully");

    scheduleJobs(db);

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("🔴 DB Sync Error:", err);
  });
