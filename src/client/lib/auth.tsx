import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AuthState, User } from "../../shared/types";
import { api, clearSession, errorText } from "./api";

const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
} | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const result = await api<AuthState>("/api/auth/me");
      setUser(result.user);
      setError("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);
  async function login(username: string, password: string) {
    const result = await api<AuthState>("/api/auth/login", {
      method: "POST", body: { username, password },
    });
    setUser(result.user);
    setError("");
  }
  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    clearSession();
    setUser(null);
    setError("");
  }
  async function changePassword(currentPassword: string, newPassword: string) {
    await api("/api/auth/change-password", {
      method: "POST", body: { currentPassword, newPassword },
    });
    clearSession();
    setUser(null);
    setError("");
  }
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return (
    <AuthContext.Provider value={{ user, loading, error, refresh, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used within AuthProvider");
  return auth;
}
