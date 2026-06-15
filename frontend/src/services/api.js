import axios from "axios";
import { clearAuth } from "../utils/auth";

// In dev you can set REACT_APP_API_BASE_URL=http://localhost:5000/api
// In production (nginx) we use /api which proxies to backend.
const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || "/api";

const api = axios.create({
  baseURL: apiBaseUrl,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    config.headers = config.headers || {};

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

let isRedirectingToLogin = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401 && !isRedirectingToLogin) {
      isRedirectingToLogin = true;

      clearAuth();

      if (window.location.pathname !== "/") {
        window.location.replace("/");
      }
    }

    return Promise.reject(error);
  }
);

export default api;