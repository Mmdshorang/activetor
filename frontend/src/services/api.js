import axios from "axios";
import { clearAuth, getAuthToken } from "../utils/auth";

// In dev you can set REACT_APP_API_BASE_URL=http://localhost:5000/api
// In production (nginx) we use /api which proxies to backend.
const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || "/api";

const api = axios.create({
  baseURL: apiBaseUrl,
});

api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();

    config.headers = config.headers || {};

    if (token && !isAuthEndpoint(config.url)) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

let isRedirectingToLogin = false;

const authFailureStatuses = new Set([401, 403]);

const isAuthEndpoint = (url = "") => String(url).startsWith("/auth/");

const getAuthorizationHeader = (headers) => {
  if (!headers) return null;

  if (typeof headers.get === "function") {
    return headers.get("Authorization") || headers.get("authorization");
  }

  return headers.Authorization || headers.authorization;
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const isAuthRequest = isAuthEndpoint(error?.config?.url);
    const requestHadToken = Boolean(getAuthorizationHeader(error?.config?.headers));
    const isInsideApp = window.location.pathname !== "/";

    if (authFailureStatuses.has(status) && !isAuthRequest && (requestHadToken || isInsideApp)) {
      clearAuth();

      if (isInsideApp && !isRedirectingToLogin) {
        isRedirectingToLogin = true;
        window.location.replace("/");
        return new Promise(() => {});
      }
    }

    return Promise.reject(error);
  }
);

export default api;
