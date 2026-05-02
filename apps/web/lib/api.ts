"use client";

const REALTIME =
  process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4000";

export interface AuthState {
  token: string;
  user: { id: string; displayName: string; vibeScore: number };
}

const TOKEN_KEY = "gs.token";
const USER_KEY = "gs.user";

export function getStoredAuth(): AuthState | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(TOKEN_KEY);
  const userStr = localStorage.getItem(USER_KEY);
  if (!token || !userStr) return null;
  try {
    return { token, user: JSON.parse(userStr) };
  } catch {
    return null;
  }
}

export function setStoredAuth(a: AuthState) {
  localStorage.setItem(TOKEN_KEY, a.token);
  localStorage.setItem(USER_KEY, JSON.stringify(a.user));
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Mint an anonymous account if we don't have one. */
export async function ensureAuth(): Promise<AuthState> {
  const existing = getStoredAuth();
  if (existing) return existing;
  const res = await fetch(`${REALTIME}/auth/anon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`auth failed: ${res.status}`);
  const data: AuthState = await res.json();
  setStoredAuth(data);
  return data;
}
