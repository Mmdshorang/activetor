const { Op } = require("sequelize");
const { sendKavenegarLookup } = require("../utils/kavenegarLookup");
const { normalizeIranPhone } = require("../utils/phone");
const { getSetting, setSetting } = require("../utils/settings");

const SETTING_KEY = "sms.contract_expiry_reminder";
const SMS_TYPE = "contract_expire_soon";

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const addDays = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const toIsoDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

const buildDefaultSettingFromEnv = () => {
  const enabledDefault = String(process.env.SMS_CONTRACT_EXPIRY_ENABLED_DEFAULT || "false").toLowerCase();
  const enabled = enabledDefault === "true" || enabledDefault === "1";
  const daysBeforeEnd = Number(process.env.SMS_CONTRACT_EXPIRY_DAYS_BEFORE_END || 5);
  const template = process.env.KAVENEGAR_CONTRACT_EXPIRE_TEMPLATE || null;
  return {
    enabled,
    daysBeforeEnd: Number.isFinite(daysBeforeEnd) && daysBeforeEnd > 0 ? Math.min(daysBeforeEnd, 60) : 5,
    template,
    lastRunAt: null,
  };
};

const runContractExpirySmsJob = async (db) => {
  const defaults = buildDefaultSettingFromEnv();
  const current = (await getSetting(db, SETTING_KEY, defaults)) || defaults;
  const enabled = current.enabled === true;
  const daysBeforeEnd = Number(current.daysBeforeEnd ?? defaults.daysBeforeEnd) || defaults.daysBeforeEnd;
  const template = current.template || defaults.template;

  if (!enabled) {
    return { ok: true, skipped: true, reason: "disabled" };
  }
  if (!template) {
    return { ok: false, skipped: true, reason: "missing_template" };
  }

  const today = startOfDay(new Date());
  const targetDay = addDays(today, daysBeforeEnd);
  const from = startOfDay(targetDay);
  const to = endOfDay(targetDay);

  const contracts = await db.Contract.findAll({
    where: {
      status: "active",
      endDate: { [Op.between]: [from, to] },
    },
    include: [{ model: db.Customer, as: "customer", attributes: ["id", "fullName", "phone", "username", "isActive"] }],
    order: [["endDate", "ASC"]],
    limit: 500,
  });

  let sent = 0;
  let failed = 0;
  let skippedNoPhone = 0;
  let skippedInactive = 0;
  let skippedDuplicate = 0;

  for (const contract of contracts) {
    const json = contract.toJSON ? contract.toJSON() : contract;
    const customer = json.customer;

    if (!customer || customer.isActive === false) {
      skippedInactive += 1;
      continue;
    }

    const rawPhone = customer.phone || customer.username;
    const phone = normalizeIranPhone(rawPhone);
    if (!phone) {
      skippedNoPhone += 1;
      continue;
    }

    const exists = await db.SmsLog.findOne({
      where: { type: SMS_TYPE, contractId: json.id },
      attributes: ["id"],
    });
    if (exists) {
      skippedDuplicate += 1;
      continue;
    }

    // Template tokens strategy:
    // token: daysBeforeEnd
    // token2: contract title (or customer name)
    // token3: contract end date (yyyy-mm-dd)
    const token = String(daysBeforeEnd);
    const token2 = String(json.title || customer.fullName || "قرارداد");
    const token3 = toIsoDate(json.endDate) || "";

    try {
      const providerResponse = await sendKavenegarLookup({
        receptor: phone,
        template,
        token,
        token2,
        token3,
      });

      await db.SmsLog.create({
        type: SMS_TYPE,
        phone,
        contractId: json.id,
        customerId: customer.id,
        status: "success",
        provider: "kavenegar",
        providerResponse,
      });

      sent += 1;
    } catch (err) {
      failed += 1;
      await db.SmsLog.create({
        type: SMS_TYPE,
        phone,
        contractId: json.id,
        customerId: customer.id,
        status: "failed",
        provider: "kavenegar",
        errorMessage: err?.message || String(err),
      });
    }
  }

  const updated = {
    ...current,
    lastRunAt: new Date().toISOString(),
  };
  await setSetting(db, SETTING_KEY, updated);

  return {
    ok: true,
    skipped: false,
    daysBeforeEnd,
    from,
    to,
    totals: { found: contracts.length, sent, failed, skippedNoPhone, skippedInactive, skippedDuplicate },
  };
};

module.exports = {
  SETTING_KEY,
  SMS_TYPE,
  runContractExpirySmsJob,
  buildDefaultSettingFromEnv,
};

