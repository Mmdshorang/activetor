const { Op } = require("sequelize");
const { sendKavenegarLookup } = require("../utils/kavenegarLookup");
const { normalizeIranPhone } = require("../utils/phone");
const { getSetting, setSetting } = require("../utils/settings");
const { parseDateOnly, todayUtcYmd, addDaysUtcYmd } = require("../utils/dateOnly");

const SETTING_KEY = "694A787A667A38326858303244707147527776314F413D3D";
const SMS_TYPE = "sms";

const toIsoDate = (value) => {
  return parseDateOnly(value);
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

  const today = todayUtcYmd();
  const targetDay = addDaysUtcYmd(today, daysBeforeEnd);

  const contracts = await db.Contract.findAll({
    where: {
      status: "active",
      endDate: targetDay,
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
    targetDay,
    totals: { found: contracts.length, sent, failed, skippedNoPhone, skippedInactive, skippedDuplicate },
  };
};

module.exports = {
  SETTING_KEY,
  SMS_TYPE,
  runContractExpirySmsJob,
  buildDefaultSettingFromEnv,
};
