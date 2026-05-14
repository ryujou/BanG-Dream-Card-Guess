"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendJson = sendJson;
exports.securityHeaders = securityHeaders;
exports.requestIp = requestIp;
exports.isMutatingMethod = isMutatingMethod;
exports.requiresCsrfCheck = requiresCsrfCheck;
// @ts-ignore - Ignore types for auth.mjs for now
const auth_mjs_1 = require("../auth.mjs");
function sendJson(res, value, status = 200) {
    res.writeHead(status, { ...securityHeaders(), "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(value));
}
function securityHeaders() {
    return {
        "Content-Security-Policy": [
            "default-src 'self'",
            "img-src 'self' data: https:",
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
            "connect-src 'self' ws: wss:",
            "font-src 'self' data: https:",
            "frame-ancestors 'self'",
            "base-uri 'self'",
            "object-src 'none'",
        ].join("; "),
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "X-XSS-Protection": "1; mode=block",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    };
}
function requestIp(req) {
    const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    return forwarded || req.socket?.remoteAddress || "unknown";
}
function isMutatingMethod(method) {
    return ["POST", "PUT", "PATCH", "DELETE"].includes(String(method || "").toUpperCase());
}
function requiresCsrfCheck(req, pathname) {
    if (pathname === "/api/login")
        return false;
    if (pathname === "/api/queue-scores")
        return false;
    if (pathname.startsWith("/note-shooter-api/"))
        return false;
    return (0, auth_mjs_1.isAuthenticated)(req);
}
