import { ROLE_DEFAULT_PAGE_PERMISSIONS } from "../constants/pagePermissions";

export const clearAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("authUser");
};

export const getAuthUser = () => {
  try {
    const raw = localStorage.getItem("authUser");
    if (!raw) return null;

    const user = JSON.parse(raw);
    if (!user) return null;

    const role = String(user.role || "").toLowerCase();
    const fallback = ROLE_DEFAULT_PAGE_PERMISSIONS[role] || [
      "dashboard",
      "messages",
    ];

    const pagePermissions = Array.isArray(user.pagePermissions)
      ? [
          ...new Set(
            user.pagePermissions
              .map((item) => String(item || "").trim())
              .filter(Boolean)
          ),
        ]
      : fallback;

    return {
      ...user,
      role,
      pagePermissions:
        role === "admin"
          ? ROLE_DEFAULT_PAGE_PERMISSIONS.admin
          : pagePermissions,
    };
  } catch (error) {
    clearAuth();
    return null;
  }
};

export const isTokenExpired = (token) => {
  if (!token) return true;

  try {
    const payloadBase64 = token.split(".")[1];

    if (!payloadBase64) {
      return true;
    }

    const base64 = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(window.atob(base64));

    if (!payload.exp) {
      return false;
    }

    return Date.now() >= payload.exp * 1000;
  } catch (error) {
    return true;
  }
};

export const isAuthenticated = () => {
  const token = localStorage.getItem("token");
  const user = getAuthUser();

  if (!token || !user || isTokenExpired(token)) {
    clearAuth();
    return false;
  }

  return true;
};

export const canAccessPage = (user, pageKey) => {
  if (!user || !pageKey) return false;

  const role = String(user.role || "").toLowerCase();

  if (role === "admin") return true;

  return (
    Array.isArray(user.pagePermissions) &&
    user.pagePermissions.includes(pageKey)
  );
};