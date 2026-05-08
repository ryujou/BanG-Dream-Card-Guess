// 主持登录认证
import { randomBytes, timingSafeEqual } from "node:crypto";

export const HOST_PASSWORD = process.env.HOST_PASSWORD || randomBytes(16).toString("hex");
export const AUTH_COOKIE = "bbc_host_auth";
export const AUTH_TOKEN = randomBytes(32).toString("hex");
export const authenticatedSessions = new Set();

export function sameSecret(a, b) {
  const sa = String(a);
  const sb = String(b);
  if (sa.length !== sb.length) return false;
  return timingSafeEqual(Buffer.from(sa), Buffer.from(sb));
}

export function isAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = cookies[AUTH_COOKIE];
  return token === AUTH_TOKEN || authenticatedSessions.has(token);
}

function parseCookies(header) {
  const result = {};
  if (!header) return result;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx > 0) result[part.slice(0, idx).trim()] = String(part.slice(idx + 1)).trim();
  }
  return result;
}

export function verifyPassword(password) {
  return sameSecret(password, HOST_PASSWORD);
}
