const { sendKavenegarLookup } = require("./kavenegarLookup");
const { sendKavenegarSms } = require("./kavenegarSms");

const resolveOtpMode = () => {
  const mode = String(process.env.KAVENEGAR_OTP_MODE || "sms").trim().toLowerCase();
  if (mode === "sms") return "sms";
  if (mode === "lookup") return "lookup";
  // Backward compatible default.
  return "lookup";
};

const buildOtpMessage = (token) => {
  const rawTemplate = process.env.KAVENEGAR_OTP_MESSAGE_TEMPLATE;
  if (rawTemplate && String(rawTemplate).trim()) {
    return String(rawTemplate).replace(/\{token\}/g, String(token));
  }
  return `کد تایید شما: ${token}`;
};

const sendKavenegarOtp = async ({ receptor, token }) => {
  const mode = resolveOtpMode();

  if (mode === "sms") {
    return sendKavenegarSms({
      receptor,
      message: buildOtpMessage(token),
    });
  }

  const template = process.env.KAVENEGAR_TEMPLATE ||"verify";
  if (!template) {
    throw new Error("KAVENEGAR_TEMPLATE تنظیم نشده است");
  }

  return sendKavenegarLookup({ receptor, template, token });
};

module.exports = {
  sendKavenegarOtp,
};
