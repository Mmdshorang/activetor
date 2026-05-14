const normalizeIranPhone = (value) => {
  if (value === undefined || value === null) return null;

  let phone = String(value).trim();
  if (!phone) return null;

  phone = phone.replace(/\s+/g, "").replace(/-/g, "");

  if (phone.startsWith("+98")) {
    phone = `0${phone.slice(3)}`;
  } else if (phone.startsWith("0098")) {
    phone = `0${phone.slice(4)}`;
  } else if (phone.startsWith("98") && phone.length === 12) {
    phone = `0${phone.slice(2)}`;
  }

  if (!/^09\d{9}$/.test(phone)) {
    return null;
  }

  return phone;
};

module.exports = {
  normalizeIranPhone,
};
