"use client";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TOKEN_KEY = "rr_token";
const USER_KEY = "rr_user";

export type AuthUser = {
  id: string;
  email: string;
  phone?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: "user" | "admin";
  referralCode: string;
  /** True once the user has set a login password. Legacy OTP-only accounts have this false until they finish /set-password. */
  hasPassword?: boolean;
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setUser(user: AuthUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {}
}

export function clearAuth() {
  setToken(null);
  setUser(null);
}

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    throw new ApiError(data?.error || `HTTP ${res.status}`, res.status, data);
  }
  return data as T;
}

export const formatINR = (n: number | string | null | undefined) => {
  const v = Number(n ?? 0);
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

/**
 * Download a file from an authed API endpoint (CSV, PDF blob, etc.).
 * The server's Content-Disposition header decides the saved filename when
 * `suggestedFilename` is omitted.
 */
export async function downloadFile(path: string, suggestedFilename?: string) {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { headers, cache: "no-store" });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg = (await res.json())?.error || msg; } catch {}
    throw new ApiError(msg, res.status, null);
  }
  // Try to parse filename from Content-Disposition: attachment; filename="..."
  const cd = res.headers.get("content-disposition") || "";
  const m = /filename="?([^"]+)"?/i.exec(cd);
  const filename = m?.[1] || suggestedFilename || "download.bin";
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
