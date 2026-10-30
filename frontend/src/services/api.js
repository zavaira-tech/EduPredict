import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("edupredict-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("edupredict-token");
      window.dispatchEvent(new Event("edupredict:unauthorized"));
    }
    return Promise.reject(error);
  },
);

export default api;
