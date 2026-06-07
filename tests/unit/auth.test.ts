import { describe, it, expect, beforeEach } from "vitest";
import {
  sameSecret, createAuthSession, isAuthenticated,
  getAuthToken, verifyPassword, revokeAuthSession,
  hasValidAuthSession, clearExpiredAuthSessions,
  buildAuthCookie, buildCsrfCookie, createCsrfToken,
  getCookie, AUTH_COOKIE, CSRF_COOKIE, AUTH_SESSION_TTL_MS,
  authenticatedSessions, HOST_PASSWORD,
} from "../../src/server/auth";

// 妯℃嫙 HTTP 璇锋眰瀵硅薄
function mockReq(cookie = "", headers = {}) {
  return {
    headers: {
      cookie,
      host: "127.0.0.1:5173",
      ...headers,
    },
  };
}

describe("auth.ts", () => {
  beforeEach(() => {
    authenticatedSessions.clear();
  });

  describe("HOST_PASSWORD", () => {
    it("case 1", () => {
      expect(HOST_PASSWORD).toBe("123456");
    });
  });

  describe("sameSecret", () => {
    it("case 2", () => {
      expect(sameSecret("abc123", "abc123")).toBe(true);
    });

    it("case 3", () => {
      expect(sameSecret("abc123", "abc124")).toBe(false);
    });

    it("case 4", () => {
      expect(sameSecret("abc", "abcd")).toBe(false);
    });

    it("case 5", () => {
      expect(sameSecret("", undefined)).toBe(false);
    });
  });

  describe("verifyPassword", () => {
    it("case 6", () => {
      expect(verifyPassword(HOST_PASSWORD)).toBe(true);
    });

    it("case 7", () => {
      expect(verifyPassword("wrong-password")).toBe(false);
    });

    it("case 8", () => {
      expect(verifyPassword("")).toBe(false);
    });
  });

  describe("createAuthSession", () => {
    it("case 9", () => {
      const token = createAuthSession();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it("case 10", () => {
      const token = createAuthSession();
      expect(authenticatedSessions.has(token)).toBe(true);
    });

    it("case 11", () => {
      const token = createAuthSession();
      const expiry = authenticatedSessions.get(token);
      const expected = Date.now() + AUTH_SESSION_TTL_MS;
      expect(Math.abs(expiry - expected)).toBeLessThan(100);
    });
  });

  describe("hasValidAuthSession", () => {
    it("case 12", () => {
      const token = createAuthSession();
      expect(hasValidAuthSession(token)).toBe(true);
    });

    it("case 13", () => {
      expect(hasValidAuthSession("invalid-token")).toBe(false);
    });

    it("case 14", () => {
      const token = createAuthSession();
      // 妯℃嫙鏃堕棿鍦ㄦ湭鏉?25 灏忔椂
      const future = Date.now() + AUTH_SESSION_TTL_MS + 3600000;
      expect(hasValidAuthSession(token, future)).toBe(false);
    });

    it("case 15", () => {
      const token = createAuthSession();
      const future = Date.now() + AUTH_SESSION_TTL_MS + 3600000;
      hasValidAuthSession(token, future);
      expect(authenticatedSessions.has(token)).toBe(false);
    });
  });

  describe("revokeAuthSession", () => {
    it("case 16", () => {
      const token = createAuthSession();
      expect(authenticatedSessions.has(token)).toBe(true);
      revokeAuthSession(token);
      expect(authenticatedSessions.has(token)).toBe(false);
    });

    it("case 17", () => {
      expect(() => revokeAuthSession("")).not.toThrow();
      expect(() => revokeAuthSession(null)).not.toThrow();
      expect(() => revokeAuthSession(undefined)).not.toThrow();
    });
  });

  describe("getAuthToken", () => {
    it("case 18", () => {
      const req = mockReq(`${AUTH_COOKIE}=test-token-123; other=value`);
      expect(getAuthToken(req)).toBe("test-token-123");
    });

    it("case 19", () => {
      const req = mockReq("");
      expect(getAuthToken(req)).toBe("");
    });

    it("case 20", () => {
      const req = mockReq("other=value");
      expect(getAuthToken(req)).toBe("");
    });
  });

  describe("isAuthenticated", () => {
    it("case 21", () => {
      const req = mockReq("");
      expect(isAuthenticated(req)).toBe(false);
    });

    it("case 22", () => {
      const token = createAuthSession();
      const req = mockReq(`${AUTH_COOKIE}=${token}`);
      expect(isAuthenticated(req)).toBe(true);
    });

    it("case 23", () => {
      const req = mockReq(`${AUTH_COOKIE}=fake-token`);
      expect(isAuthenticated(req)).toBe(false);
    });
  });

  describe("buildAuthCookie", () => {
    it("case 24", () => {
      const token = "test123";
      const req = mockReq("");
      const cookie = buildAuthCookie(token, req);
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toContain(`bbc_host_auth=${token}`);
    });

    it("case 25", () => {
      const cookie = buildAuthCookie("test", mockReq(""));
      expect(cookie).toContain("Max-Age=");
    });
  });

  describe("csrf helpers", () => {
    it("case 26", () => {
      const token = createCsrfToken();
      expect(token).toMatch(/^[0-9a-f]{48}$/);
    });

    it("case 27", () => {
      const cookie = buildCsrfCookie("csrf-token", mockReq(""));
      expect(cookie).toContain(`${CSRF_COOKIE}=csrf-token`);
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).not.toContain("HttpOnly");
    });

    it("case 28", () => {
      const req = mockReq("", { "x-forwarded-proto": "https" });
      const cookie = buildCsrfCookie("csrf-token", req);
      expect(cookie).toContain("Secure");
    });

    it("case 29", () => {
      const req = mockReq("foo=bar; bbc_csrf=token123; x=y");
      expect(getCookie(req, CSRF_COOKIE)).toBe("token123");
    });
  });

  describe("clearExpiredAuthSessions", () => {
    it("case 30", () => {
      const token1 = createAuthSession();
      const token2 = createAuthSession();
      const future = Date.now() + AUTH_SESSION_TTL_MS + 1000;
      clearExpiredAuthSessions(future);
      expect(authenticatedSessions.size).toBe(0);
    });
  });
});
