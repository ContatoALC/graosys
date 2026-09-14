import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3333",
  timeout: 30000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("@graosys:token");
      localStorage.removeItem("@graosys:user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
