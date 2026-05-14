const router = require("express").Router();
const db = require("../models");
const { auth, allowRoles } = require("../middleware/authorize");
const { parseApiError } = require("../utils/apiError");
const { getSetting, setSetting } = require("../utils/settings");
const { SETTING_KEY, buildDefaultSettingFromEnv, runContractExpirySmsJob } = require("../jobs/contractExpirySmsJob");

router.use(auth);
router.use(allowRoles("admin"));

const parseBooleanValue = (value) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return null;
};

router.get("/sms-contract-expiry", async (req, res) => {
  try {
    const defaults = buildDefaultSettingFromEnv();
    const current = (await getSetting(db, SETTING_KEY, defaults)) || defaults;
    return res.json({
      key: SETTING_KEY,
      enabled: current.enabled === true,
      daysBeforeEnd: Number(current.daysBeforeEnd ?? defaults.daysBeforeEnd) || defaults.daysBeforeEnd,
      template: current.template || defaults.template || null,
      lastRunAt: current.lastRunAt || null,
      cron: process.env.SMS_CONTRACT_EXPIRY_CRON || "0 9 * * *",
      timezone: process.env.SMS_CRON_TZ || "Asia/Tehran",
    });
  } catch (err) {
    return res.status(500).json({ message: parseApiError(err, "خطا در دریافت تنظیمات پیامک") });
  }
});

router.put("/sms-contract-expiry", async (req, res) => {
  try {
    const defaults = buildDefaultSettingFromEnv();
    const current = (await getSetting(db, SETTING_KEY, defaults)) || defaults;

    const enabled = parseBooleanValue(req.body?.enabled);
    if (enabled === null) {
      return res.status(400).json({ message: "enabled باید true/false باشد" });
    }

    let daysBeforeEnd = current.daysBeforeEnd ?? defaults.daysBeforeEnd;
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "daysBeforeEnd")) {
      const parsed = Number(req.body.daysBeforeEnd);
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 60) {
        return res.status(400).json({ message: "daysBeforeEnd نامعتبر است (1 تا 60)" });
      }
      daysBeforeEnd = parsed;
    }

    const template = Object.prototype.hasOwnProperty.call(req.body || {}, "template")
      ? (req.body.template ? String(req.body.template).trim() : null)
      : (current.template || defaults.template || null);

    const updated = {
      ...current,
      enabled,
      daysBeforeEnd,
      template,
    };

    await setSetting(db, SETTING_KEY, updated);
    return res.json({
      key: SETTING_KEY,
      enabled: updated.enabled === true,
      daysBeforeEnd: updated.daysBeforeEnd,
      template: updated.template || null,
      lastRunAt: updated.lastRunAt || null,
    });
  } catch (err) {
    return res.status(500).json({ message: parseApiError(err, "خطا در بروزرسانی تنظیمات پیامک") });
  }
});

// Manual run (admin only) for testing
router.post("/sms-contract-expiry/run", async (req, res) => {
  try {
    const result = await runContractExpirySmsJob(db);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: parseApiError(err, "خطا در اجرای دستی پیامک") });
  }
});

module.exports = router;

