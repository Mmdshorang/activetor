const sendKavenegarLookup = async ({
  receptor,
  template,
  token,
  token2,
  token3,
  type,
}) => {
  const apiKey =
    process.env.KAVENEGAR_API_KEY || "694A787A667A38326858303244707147527776314F413D3D";
  const lookupType = type || process.env.KAVENEGAR_TYPE;

  if (!apiKey) {
    throw new Error("KAVENEGAR_API_KEY تنظیم نشده است");
  }
  if (!template) {
    throw new Error("KAVENEGAR template تنظیم نشده است");
  }
  if (!receptor) {
    throw new Error("receptor الزامی است");
  }
  if (!token) {
    throw new Error("token الزامی است");
  }

  const query = new URLSearchParams({
    receptor,
    token,
    template,
    type: lookupType,
  });
  if (token2) query.set("token2", token2);
  if (token3) query.set("token3", token3);
  console.log("Sending Kavenegar lookup with query:", query.toString());
  const endpoint = `https://api.kavenegar.com/v1/${apiKey}/verify/lookup.json?${query.toString()}`;
  const response = await fetch(endpoint, { method: "GET" });
  const text = await response.text();
  console.log("KAVENEGAR STATUS:", response.status);
  console.log("KAVENEGAR RESPONSE:", text);
  if (!response.ok) {
    throw new Error(`Kavenegar HTTP ${response.status}`);
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch (_) {
    throw new Error("پاسخ نامعتبر از سرویس پیامک");
  }

  if (body?.return?.status !== 200) {
    const status = body?.return?.status || "unknown";
    const message = body?.return?.message || "خطا در ارسال پیامک";
    throw new Error(`Kavenegar ${status}: ${message}`);
  }

  return body;
};

module.exports = {
  sendKavenegarLookup,
};
