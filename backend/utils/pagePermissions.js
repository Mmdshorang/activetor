const ALL_PAGE_KEYS = Object.freeze([
  "dashboard",
  "users",
  "customers",
  "versions",
  "licenses",
  "contracts",
  "messages",
  "renewalRequests",
]);

const ROLE_DEFAULT_PAGE_PERMISSIONS = Object.freeze({
  admin: [...ALL_PAGE_KEYS],
  user: [
    "dashboard",
    "users",
    "customers",
    "versions",
    "licenses",
    "contracts",
    "messages",
    "renewalRequests",
  ],
  agent: ["dashboard", "customers", "contracts", "messages", "renewalRequests"],
  customer: ["dashboard", "licenses", "contracts", "messages", "renewalRequests"],
});

const unique = (items) => [...new Set(items)];

const resolveDefaultPagePermissions = (role) => {
  const normalizedRole = (role || "").toLowerCase();
  return ROLE_DEFAULT_PAGE_PERMISSIONS[normalizedRole]
    ? [...ROLE_DEFAULT_PAGE_PERMISSIONS[normalizedRole]]
    : ["dashboard", "messages"];
};

const normalizePagePermissions = (value, role) => {
  const normalizedRole = (role || "").toLowerCase();
  if (normalizedRole === "admin") {
    return [...ALL_PAGE_KEYS];
  }

  if (!Array.isArray(value)) {
    return resolveDefaultPagePermissions(normalizedRole);
  }

  const cleaned = unique(
    value
      .map((item) => String(item || "").trim())
      .filter((item) => ALL_PAGE_KEYS.includes(item)),
  );

  if (cleaned.length === 0) {
    return resolveDefaultPagePermissions(normalizedRole);
  }

  return cleaned;
};

module.exports = {
  ALL_PAGE_KEYS,
  ROLE_DEFAULT_PAGE_PERMISSIONS,
  resolveDefaultPagePermissions,
  normalizePagePermissions,
};
