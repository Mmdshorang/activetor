// Utilities for handling date-only values (no time, no timezone).
// We store and transport these as "YYYY-MM-DD" strings to avoid timezone shifts.

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const pad2 = (n) => String(n).padStart(2, "0");

const isValidYmd = (ymd) => {
  if (!DATE_ONLY_RE.test(ymd)) return false;
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  // Construct a UTC date and ensure it round-trips.
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
};

/**
 * Parse various date inputs into a canonical date-only string: "YYYY-MM-DD".
 * Accepts:
 * - "YYYY-MM-DD"
 * - ISO datetime strings (we take the UTC date component)
 * - Date instances
 */
const parseDateOnly = (value) => {
  if (value === undefined || value === null) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (isValidYmd(trimmed)) return trimmed;

    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
  }

  return null;
};

// Compute day difference using UTC midnight to avoid timezone issues.
const daysBetweenUtc = (fromYmd, toYmd) => {
  if (!fromYmd || !toYmd) return null;
  if (!isValidYmd(fromYmd) || !isValidYmd(toYmd)) return null;
  const [fy, fm, fd] = fromYmd.split("-").map(Number);
  const [ty, tm, td] = toYmd.split("-").map(Number);
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.ceil((to - from) / (1000 * 60 * 60 * 24));
};

const todayUtcYmd = () => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}`;
};

const addDaysUtcYmd = (ymd, days) => {
  if (!isValidYmd(ymd)) return null;
  const n = Number(days);
  if (!Number.isFinite(n)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);
  const next = new Date(base + n * 24 * 60 * 60 * 1000);
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
};

module.exports = {
  parseDateOnly,
  isValidYmd,
  daysBetweenUtc,
  todayUtcYmd,
  addDaysUtcYmd,
};
