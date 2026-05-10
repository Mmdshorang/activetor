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

  return fallbackMessage || "خطای داخلی سرور";
};

module.exports = {
  parseApiError,
};

