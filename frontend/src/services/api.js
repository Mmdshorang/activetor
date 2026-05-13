import axios from "axios";

// const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || "/api";
const apiBaseUrl = "http://localhost:5000/api";


const api = axios.create({
  baseURL: apiBaseUrl
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem("token");
  if (token) config.headers.authorization = `Bearer ${token}`;
  return config;
});

export default api;
