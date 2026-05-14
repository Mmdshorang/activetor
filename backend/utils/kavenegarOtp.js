const { sendKavenegarLookup } = require("./kavenegarLookup");

const sendKavenegarOtp = async ({ receptor, token }) => {
  const template = process.env.KAVENEGAR_TEMPLATE;
  if (!template) {
    throw new Error("KAVENEGAR_TEMPLATE تنظیم نشده است");
  }

  return sendKavenegarLookup({ receptor, template, token });
};

module.exports = {
  sendKavenegarOtp,
};
