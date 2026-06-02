import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useHydrated } from "@tanstack/react-router";

const AUTH_KEY = "rsports_auth";
const VALID_USER = "Admin";
const VALID_PASS = "RSports2025@#";

interface AuthCtx {
  isAuthenticated: boolean;
  login: (user: string, pass: string) => boolean;
  logout: () => void;
  ready: boolean;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const [isAuthenticated, setAuth] = useState(false);

  useEffect(() => {
    if (hydrated) {
      setAuth(localStorage.getItem(AUTH_KEY) === "1");
    }
  }, [hydrated]);

  const login = (user: string, pass: string) => {
    if (user === VALID_USER && pass === VALID_PASS) {
      localStorage.setItem(AUTH_KEY, "1");
      setAuth(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    setAuth(false);
  };

  return <Ctx.Provider value={{ isAuthenticated, login, logout, ready: hydrated }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
