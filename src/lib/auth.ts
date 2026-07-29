// Client-side auth helpers, ported from the legacy SPA's
// src/store/helpers/common.js (parseJwt/isTokenValid). Same contract as the
// live API: a JWT issued by POST /login or POST /signup, stored in
// localStorage, sent back as an X-Auth-Token header -- there is no
// server-side session/cookie on this backend, so this must stay
// client-side (these helpers are only ever called from "use client"
// components).

export const API_BASE = "https://api.ukcarimports.ie/public";

interface DecodedToken {
  exp?: number;
  urxrs?: string;
  [key: string]: unknown;
}

export function parseJwt(token: string | null | undefined): DecodedToken | undefined {
  if (!token) return undefined;
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) throw new Error("malformed token");
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    // A corrupted/malformed token should never crash the page -- clear it
    // and treat the visitor as logged out, matching legacy behaviour.
    localStorage.removeItem("token");
    return undefined;
  }
}

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

// A token existing doesn't mean the session is still good -- check its own
// exp claim (24h TTL) rather than just presence, matching the fix already
// applied on the legacy site (see project-ukcarimports-infra memory).
export function isTokenValid(): boolean {
  const token = getToken();
  if (!token) return false;
  const decoded = parseJwt(token);
  if (!decoded || !decoded.exp) {
    clearToken();
    return false;
  }
  if (decoded.exp * 1000 <= Date.now()) {
    clearToken();
    return false;
  }
  return true;
}

export function authHeaders(): HeadersInit {
  return { "X-Auth-Token": getToken() ?? "" };
}
