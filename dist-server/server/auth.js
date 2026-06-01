// 主持登录认证
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(rootDir, "data");
const passwordFilePath = path.join(dataDir, "host-password");
function loadOrCreateHostPassword() {
    if (process.env.HOST_PASSWORD)
        return process.env.HOST_PASSWORD;
    try {
        return readFileSync(passwordFilePath, "utf8").trim();
    }
    catch {
        // File doesn't exist or can't be read — generate and persist
    }
    const generated = randomBytes(16).toString("hex");
    try {
        mkdirSync(dataDir, { recursive: true });
        writeFileSync(passwordFilePath, generated, "utf8");
    }
    catch {
        // Ignore write failures — still use the generated password for this session
    }
    return generated;
}
export const HOST_PASSWORD = loadOrCreateHostPassword();
export const AUTH_COOKIE = "bbc_host_auth";
export const CSRF_COOKIE = "bbc_csrf";
export const AUTH_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const authenticatedSessions = new Map();
export function sameSecret(a, b) {
    const sa = String(a);
    const sb = String(b);
    if (sa.length !== sb.length)
        return false;
    return timingSafeEqual(Buffer.from(sa), Buffer.from(sb));
}
export function isAuthenticated(req) {
    const token = getAuthToken(req);
    if (!token)
        return false;
    return hasValidAuthSession(token);
}
export function getAuthToken(req) {
    const headers = req?.headers || {};
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
export function revokeAuthSession(token) {
    if (!token)
        return;
    authenticatedSessions.delete(token);
}
export function clearExpiredAuthSessions(now = Date.now()) {
    for (const [token, expiresAt] of authenticatedSessions.entries()) {
        if (expiresAt <= now)
            authenticatedSessions.delete(token);
    }
}
export function hasValidAuthSession(token, now = Date.now()) {
    clearExpiredAuthSessions(now);
    const expiresAt = authenticatedSessions.get(token);
    if (!expiresAt)
        return false;
    if (expiresAt <= now) {
        authenticatedSessions.delete(token);
        return false;
    }
    return true;
}
export function buildAuthCookie(token, req) {
    const headers = req?.headers || {};
    const secure = String(headers["x-forwarded-proto"] || "").toLowerCase() === "https";
    const host = String(headers.host || "").split(":")[0].toLowerCase();
    const domain = host.endsWith("xtbang.top") ? "; Domain=.xtbang.top" : "";
    return `${AUTH_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(AUTH_SESSION_TTL_MS / 1000)}${domain}${secure ? "; Secure" : ""}`;
}
export function buildCsrfCookie(token, req) {
    const headers = req?.headers || {};
    const secure = String(headers["x-forwarded-proto"] || "").toLowerCase() === "https";
    const host = String(headers.host || "").split(":")[0].toLowerCase();
    const domain = host.endsWith("xtbang.top") ? "; Domain=.xtbang.top" : "";
    return `${CSRF_COOKIE}=${token}; Path=/; SameSite=Lax; Max-Age=${Math.floor(AUTH_SESSION_TTL_MS / 1000)}${domain}${secure ? "; Secure" : ""}`;
}
function parseCookies(header) {
    const result = {};
    if (!header)
        return result;
    for (const part of header.split(";")) {
        const idx = part.indexOf("=");
        if (idx > 0)
            result[part.slice(0, idx).trim()] = String(part.slice(idx + 1)).trim();
    }
    return result;
}
export function getCookie(req, name) {
    const headers = req?.headers || {};
    const cookies = parseCookies(headers.cookie || "");
    return cookies[name] || "";
}
export function verifyPassword(password) {
    return sameSecret(password, HOST_PASSWORD);
}
//# sourceMappingURL=auth.js.map