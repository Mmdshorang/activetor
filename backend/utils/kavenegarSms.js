const normalizeReceptors = (receptor) => {
  if (!receptor) return "";
  if (Array.isArray(receptor)) {
    return receptor
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join(",");
  }
  return String(receptor).trim();
};

// Kavenegar "simple send" API:
// https://api.kavenegar.com/v1/{API-KEY}/sms/send.json
const sendKavenegarSms = async ({
  receptor,
  message,
  sender,
  date,
  type,
  localid,
  hide,
  tag,
  policy,
}) => {
  const apiKey =
    process.env.KAVENEGAR_API_KEY || "694A787A667A38326858303244707147527776314F413D3D";
  if (!apiKey) {
    throw new Error("KAVENEGAR_API_KEY تنظیم نشده است");
  }

  const normalizedReceptor = normalizeReceptors(receptor);
  if (!normalizedReceptor) {
    throw new Error("receptor الزامی است");
  }

  const normalizedMessage = String(message || "").trim();
  if (!normalizedMessage) {
    throw new Error("message الزامی است");
  }

  const payload = new URLSearchParams({
    receptor: normalizedReceptor,
    message: normalizedMessage,
  });

  const resolvedSender = sender || process.env.KAVENEGAR_SENDER;
  if (resolvedSender) payload.set("sender", String(resolvedSender));
  if (date) payload.set("date", String(date));
  if (type) payload.set("type", String(type));
  if (localid) payload.set("localid", String(localid));
  if (hide !== undefined && hide !== null) payload.set("hide", String(hide));
  if (tag) payload.set("tag", String(tag));
  if (policy) payload.set("policy", String(policy));

  const endpoint = `https://api.kavenegar.com/v1/${apiKey}/sms/send.json`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=utf-8",
    },
    body: payload.toString(),
  });
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
    const messageText = body?.return?.message || "خطا در ارسال پیامک";
    throw new Error(`Kavenegar ${status}: ${messageText}`);
  }

  return body;
};

module.exports = {
  sendKavenegarSms,
};
