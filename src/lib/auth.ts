// Client-side auth helpers, ported from the legacy SPA's
// src/store/helpers/common.js (parseJwt/isTokenValid). Same contract as the
// live API: a JWT issued by POST /login or POST /signup, stored in
// localStorage, sent back as an X-Auth-Token header -- there is no
// server-side session/cookie on this backend, so this must stay
// client-side (these helpers are only ever called from "use client"
// components).
//
// Customer and staff sessions use separate storage keys ("token" vs
// "staff_token") -- the legacy SPA reused a single "token" slot for both,
// which meant a staff login silently overwrote/masked a customer session
// (or vice versa) and the header nav had no way to tell which kind of
// session was active. Keeping them independent means someone can hold both
// at once, and the nav can show the right affordance for each.

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
    return undefined;
  }
}

function isJwtLive(token: string | null): boolean {
  if (!token) return false;
  const decoded = parseJwt(token);
  if (!decoded || !decoded.exp) return false;
  return decoded.exp * 1000 > Date.now();
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
  if (!isJwtLive(token)) {
    clearToken();
    return false;
  }
  return true;
}

export function authHeaders(): HeadersInit {
  return { "X-Auth-Token": getToken() ?? "" };
}

// Same magic role string the legacy SPA checks (App.js route guards,
// Dashboard.jsx) against the JWT's `urxrs` claim -- not a real-looking role
// name, but it's the actual value the API issues for staff accounts, so it's
// reused verbatim rather than re-derived.
const ADMIN_ROLE = "$aHF667#79+57h%45";

export function getStaffToken(): string | null {
  return localStorage.getItem("staff_token");
}

export function setStaffToken(token: string) {
  localStorage.setItem("staff_token", token);
}

export function clearStaffToken() {
  localStorage.removeItem("staff_token");
}

// Staff/admin pages need both a live token AND the admin role -- a valid
// customer session must not grant access to /dashboard etc.
export function isAdminTokenValid(): boolean {
  const token = getStaffToken();
  if (!isJwtLive(token)) {
    clearStaffToken();
    return false;
  }
  return parseJwt(token)?.urxrs === ADMIN_ROLE;
}

export function staffAuthHeaders(): HeadersInit {
  return { "X-Auth-Token": getStaffToken() ?? "" };
}
