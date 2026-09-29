import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3333",
  timeout: 30000,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 das rotas de autenticação (senha errada, link expirado) é tratado pela própria tela.
    const isAuthRoute = /\/api\/auth\/(login|forgot-password|reset-password-token)$/.test(error.config?.url || "");
    if (error.response?.status === 401 && !isAuthRoute) {
      // Motivo da saída (plano vencido, conta suspensa, sessão encerrada) exibido na tela de login.
      try { sessionStorage.setItem("@graosys:logout-reason", error.response.data?.error || ""); } catch { /* sem storage */ }
      localStorage.removeItem("@graosys:token");
      localStorage.removeItem("@graosys:user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
