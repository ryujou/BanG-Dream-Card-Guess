// 主持登录认证
import { randomBytes, timingSafeEqual } from "node:crypto";

export const HOST_PASSWORD = process.env.HOST_PASSWORD || randomBytes(16).toString("hex");
export const AUTH_COOKIE = "bbc_host_auth";
export const CSRF_COOKIE = "bbc_csrf";
export const AUTH_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const authenticatedSessions = new Map();

export function sameSecret(a: unknown, b: unknown): boolean {
  const sa = String(a);
  const sb = String(b);
  if (sa.length !== sb.length) return false;
  return timingSafeEqual(Buffer.from(sa), Buffer.from(sb));
}

export function isAuthenticated(req: unknown): boolean {
  const token = getAuthToken(req);
  if (!token) return false;
  return hasValidAuthSession(token);
}

export function getAuthToken(req: unknown): string {
  const headers = (req as { headers?: Record<string, string> })?.headers || {};
  const cookies = parseCookies(headers.cookie || "");
  return cookies[AUTH_COOKIE] || "";
}

export function createAuthSession() {
  const token = randomBytes(32).toString("hex");
  authenticatedSessions.set(token, Date.now() + AUTH_SESSION_TTL_MS);
  return token;
}

export function createCsrfToken() {
  return randomBytes(24).toString("hex");
}

export function revokeAuthSession(token: string) {
  if (!token) return;
  authenticatedSessions.delete(token);
}

export function clearExpiredAuthSessions(now = Date.now()) {
  for (const [token, expiresAt] of authenticatedSessions.entries()) {
    if (expiresAt <= now) authenticatedSessions.delete(token);
  }
}

export function hasValidAuthSession(token: string, now = Date.now()): boolean {
  clearExpiredAuthSessions(now);
  const expiresAt = authenticatedSessions.get(token);
  if (!expiresAt) return false;
  if (expiresAt <= now) {
    authenticatedSessions.delete(token);
    return false;
  }
  return true;
}

export function buildAuthCookie(token: string, req: unknown): string {
  const headers = (req as { headers?: Record<string, string> })?.headers || {};
  const secure = String(headers["x-forwarded-proto"] || "").toLowerCase() === "https";
  const host = String(headers.host || "").split(":")[0].toLowerCase();
  const domain = host.endsWith("xtbang.top") ? "; Domain=.xtbang.top" : "";
  return `${AUTH_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(AUTH_SESSION_TTL_MS / 1000)}${domain}${secure ? "; Secure" : ""}`;
}

export function buildCsrfCookie(token: string, req: unknown): string {
  const headers = (req as { headers?: Record<string, string> })?.headers || {};
  const secure = String(headers["x-forwarded-proto"] || "").toLowerCase() === "https";
  const host = String(headers.host || "").split(":")[0].toLowerCase();
  const domain = host.endsWith("xtbang.top") ? "; Domain=.xtbang.top" : "";
  return `${CSRF_COOKIE}=${token}; Path=/; SameSite=Lax; Max-Age=${Math.floor(AUTH_SESSION_TTL_MS / 1000)}${domain}${secure ? "; Secure" : ""}`;
}

function parseCookies(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) result[part.slice(0, idx).trim()] = String(part.slice(idx + 1)).trim();
  }
  return result;
}

export function getCookie(req: unknown, name: string): string {
  const headers = (req as { headers?: Record<string, string> })?.headers || {};
  const cookies = parseCookies(headers.cookie || "");
  return cookies[name] || "";
}

export function verifyPassword(password: string): boolean {
  return sameSecret(password, HOST_PASSWORD);
}
