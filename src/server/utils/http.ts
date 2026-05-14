// @ts-ignore - Ignore types for auth.mjs for now
import { isAuthenticated } from "../../../src/server/auth.mjs";
import type { IncomingMessage, ServerResponse } from "node:http";

export function sendJson(res: ServerResponse, value: any, status: number = 200): void {
  res.writeHead(status, { ...securityHeaders(), "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

export function securityHeaders(): Record<string, string> {
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

export function requestIp(req: IncomingMessage): string {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "unknown";
}

export function isMutatingMethod(method: string | undefined): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(String(method || "").toUpperCase());
}

export function requiresCsrfCheck(req: IncomingMessage, pathname: string): boolean {
  if (pathname === "/api/login") return false;
  if (pathname === "/api/queue-scores") return false;
  if (pathname.startsWith("/note-shooter-api/")) return false;
  return isAuthenticated(req);
}
