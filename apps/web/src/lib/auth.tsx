"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, AuthUser, clearAuth, getToken, getUser, setToken, setUser } from "./api";

type AuthState = {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signIn: (token: string, user: AuthUser) => void;
  signOut: () => void;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const t = getToken();
    if (!t) {
      setLoading(false);
      return;
    }
    try {
      const data = await api<{ user: AuthUser }>("/me");
      setUser(data.user);
      setUserState(data.user);
      setTokenState(t);
    } catch {
      clearAuth();
      setUserState(null);
      setTokenState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUserState(getUser());
    setTokenState(getToken());
    refresh();
  }, [refresh]);

  const signIn = useCallback((t: string, u: AuthUser) => {
    setToken(t);
    setUser(u);
    setTokenState(t);
    setUserState(u);
  }, []);

  const signOut = useCallback(() => {
    clearAuth();
    setUserState(null);
    setTokenState(null);
    router.push("/");
  }, [router]);

  const value = useMemo(
    () => ({ user, token, loading, refresh, signIn, signOut }),
    [user, token, loading, refresh, signIn, signOut]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
