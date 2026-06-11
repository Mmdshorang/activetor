const {
  ValidationError,
  UniqueConstraintError,
  ForeignKeyConstraintError,
} = require("sequelize");

const fieldLabels = {
  username: "نام کاربری",
  password: "رمز عبور",
  fullName: "نام و نام خانوادگی",
  phone: "شماره موبایل",
  company: "نام شرکت",
  address: "آدرس",
  licenseLimit: "سقف لایسنس",
  contractStartDate: "تاریخ شروع قرارداد",
  contractEndDate: "تاریخ پایان قرارداد",
  userId: "کاربر مالک",
  customerId: "مشتری",
  systemName: "نام سیستم",
  version: "نسخه",
  code1: "کد اول",
  code2: "کد دوم",
  code3: "کد سوم",
  licenseId: "شناسه لایسنس",
  expireDate: "تاریخ انقضا",
};

const normalizeField = (field) => fieldLabels[field] || field || "فیلد";

const toPersianValidationMessage = (message, field) => {
  if (!message) return `${normalizeField(field)} نامعتبر است`;

  const lower = String(message).toLowerCase();

  if (lower.includes("cannot be null") || lower.includes("notnull")) {
    return `${normalizeField(field)} الزامی است`;
  }

  if (lower.includes("invalid date")) {
    return `${normalizeField(field)} معتبر نیست`;
  }

  if (lower.includes("validation")) {
    return `${normalizeField(field)} معتبر نیست`;
  }

  return message;
};

const parseApiError = (error, fallbackMessage) => {
  if (error instanceof UniqueConstraintError) {
    const uniqueFields = Object.keys(error?.fields || {});
    const parentDetail = String(error?.parent?.detail || "");

    if (
      ["code1", "code2", "code3"].every((field) =>
        uniqueFields.includes(field),
      ) ||
      parentDetail.includes("(code1, code2, code3)")
    ) {
      return "این ترکیب لایسنس قبلا ثبت شده است";
    }

    const field = error?.errors?.[0]?.path;
    if (field === "username") {
      return "این نام کاربری قبلا ثبت شده است";
    }
    return `${normalizeField(field)} تکراری است`;
  }

  if (error instanceof ForeignKeyConstraintError) {
    return "اطلاعات وابسته معتبر نیست";
  }

  if (error instanceof ValidationError) {
    const firstError = error?.errors?.[0];
    return toPersianValidationMessage(firstError?.message, firstError?.path);
  }

  if (error?.name === "SequelizeDatabaseError") {
    return "خطا در پردازش اطلاعات ارسالی";
  }

  // For non-DB/runtime errors (e.g. SMS provider), returning the raw message
  // helps debugging in development without leaking details in production.
  const nodeEnv = String(process.env.NODE_ENV || "").trim().toLowerCase() || "development";
  const isProduction = nodeEnv === "production";

  if (!isProduction && error?.message) {
    const message = String(error.message).trim();
    if (message) return message;
  }

  return fallbackMessage || "خطای داخلی سرور";
};

const sanitizeMetadata = (metadata = {}) => {
  const copy = { ...metadata };

  if (copy.body) {
    copy.body = {
      customerId: copy.body.customerId || copy.body.userId,
      systemName: copy.body.systemName,
      version: copy.body.version,
      hasCode1: Boolean(copy.body.code1),
      hasCode2: Boolean(copy.body.code2),
      hasCode3: Boolean(copy.body.code3),
      hasLicenseId: Boolean(copy.body.licenseId),
      expireDate: copy.body.expireDate,
    };
  }

  return copy;
};

const logApiError = (context, error, metadata = {}) => {
  const parent = error?.parent || error?.original || {};

  console.error(`${context}:`, {
    name: error?.name,
    message: error?.message,
    details: error?.errors?.map((item) => ({
      message: item.message,
      path: item.path,
      value: item.value,
      type: item.type,
    })),
    db: {
      code: parent.code,
      detail: parent.detail,
      constraint: parent.constraint,
      table: parent.table,
      column: parent.column,
    },
    sql: error?.sql,
    metadata: sanitizeMetadata(metadata),
    stack: error?.stack,
  });
};

module.exports = {
  parseApiError,
  logApiError,
};
