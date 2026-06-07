export function sendJson(res, value, status = 200, extraHeaders = {}) {
    res.writeHead(status, {
        ...securityHeaders(),
        "Content-Type": "application/json; charset=utf-8",
        ...extraHeaders,
    });
    res.end(JSON.stringify(value));
}
export function securityHeaders() {
    return {
        "Content-Security-Policy": [
            "default-src 'self'",
            "img-src 'self' data: https:",
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
            "connect-src 'self' ws: wss:",
            "font-src 'self' data: https:",
            "frame-src 'self' https://player.bilibili.com https://www.bilibili.com",
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
export function requestIp(req) {
    const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    return forwarded || req.socket?.remoteAddress || "unknown";
}
export function isMutatingMethod(method) {
    return ["POST", "PUT", "PATCH", "DELETE"].includes(String(method || "").toUpperCase());
}
export function requiresCsrfCheck(req, pathname) {
    void req;
    if (pathname === "/api/login")
        return false;
    return true;
}
//# sourceMappingURL=http.js.map