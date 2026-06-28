import { ROLE_DEFAULT_PAGE_PERMISSIONS } from "../constants/pagePermissions";

const TOKEN_KEY = "token";
const AUTH_USER_KEY = "authUser";

const clearLegacyAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
};

export const getAuthToken = () => {
  clearLegacyAuth();
  return sessionStorage.getItem(TOKEN_KEY);
};

export const setAuth = ({ token, user }) => {
  clearLegacyAuth();
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user || null));
};

export const getAuthUser = () => {
  try {
    clearLegacyAuth();
    const raw = sessionStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw);
    if (!user) return null;

    const role = String(user.role || "").toLowerCase();
    const fallback = ROLE_DEFAULT_PAGE_PERMISSIONS[role] || ["dashboard", "messages"];
    const pagePermissions = Array.isArray(user.pagePermissions)
      ? [...new Set(user.pagePermissions.map((item) => String(item || "").trim()).filter(Boolean))]
      : fallback;

    return {
      ...user,
      pagePermissions: role === "admin" ? ROLE_DEFAULT_PAGE_PERMISSIONS.admin : pagePermissions,
    };
  } catch (error) {
    return null;
  }
};

export const canAccessPage = (user, pageKey) => {
  if (!user || !pageKey) return false;
  if (user.role === "admin") return true;
  return Array.isArray(user.pagePermissions) && user.pagePermissions.includes(pageKey);
};

export const clearAuth = () => {
  clearLegacyAuth();
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(AUTH_USER_KEY);
};
