import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "@/services/api";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  tenant_id: string;
  tenant_name: string;
  permissions: Record<string, string[]>;
}

interface AuthContextData {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("@graosys:token");
    const storedUser = localStorage.getItem("@graosys:user");
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      api.defaults.headers.common["Authorization"] = `Bearer ${storedToken}`;
    }
    setIsLoading(false);
  }, []);

  // Batimento de presença: alimenta o painel de usuários online.
  useEffect(() => {
    if (!user) return;
    const beat = () => { if (document.visibilityState === "visible") api.post("/api/auth/heartbeat").catch(() => undefined); };
    beat();
    const timer = setInterval(beat, 60_000);
    document.addEventListener("visibilitychange", beat);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", beat); };
  }, [user?.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await api.post("/api/auth/login", { email, password });
    const { token: newToken, user: newUser } = response.data;

    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("@graosys:token", newToken);
    localStorage.setItem("@graosys:user", JSON.stringify(newUser));
    api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
  }, []);

  const signOut = useCallback(() => {
    // Registra o encerramento da sessão (melhor esforço; não bloqueia a saída).
    api.post("/api/auth/logout").catch(() => undefined);
    setToken(null);
    setUser(null);
    localStorage.removeItem("@graosys:token");
    localStorage.removeItem("@graosys:user");
    delete api.defaults.headers.common["Authorization"];
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!user, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
