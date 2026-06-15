import { ROLE_DEFAULT_PAGE_PERMISSIONS } from "../constants/pagePermissions";

export const getAuthUser = () => {
  try {
    const raw = localStorage.getItem("authUser");
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
  localStorage.removeItem("token");
  localStorage.removeItem("authUser");
};
