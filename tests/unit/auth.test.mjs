import { describe, it, expect, beforeEach } from "vitest";
import {
  sameSecret, createAuthSession, isAuthenticated,
  getAuthToken, verifyPassword, revokeAuthSession,
  hasValidAuthSession, clearExpiredAuthSessions,
  buildAuthCookie, buildCsrfCookie, createCsrfToken,
  getCookie, AUTH_COOKIE, CSRF_COOKIE, AUTH_SESSION_TTL_MS,
  authenticatedSessions, HOST_PASSWORD,
} from "../../src/server/auth.mjs";

// 模拟 HTTP 请求对象
function mockReq(cookie = "", headers = {}) {
  return {
    headers: {
      cookie,
      host: "127.0.0.1:5173",
      ...headers,
    },
  };
}

describe("auth.mjs", () => {
  beforeEach(() => {
    authenticatedSessions.clear();
  });

  describe("HOST_PASSWORD", () => {
    it("应该是 32 位十六进制字符串", () => {
      expect(HOST_PASSWORD).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  describe("sameSecret", () => {
    it("相同密码应返回 true", () => {
      expect(sameSecret("abc123", "abc123")).toBe(true);
    });

    it("不同密码应返回 false", () => {
      expect(sameSecret("abc123", "abc124")).toBe(false);
    });

    it("不同长度密码应返回 false", () => {
      expect(sameSecret("abc", "abcd")).toBe(false);
    });

    it("空字符串和 undefined 应返回 false", () => {
      expect(sameSecret("", undefined)).toBe(false);
    });
  });

  describe("verifyPassword", () => {
    it("正确密码应返回 true", () => {
      expect(verifyPassword(HOST_PASSWORD)).toBe(true);
    });

    it("错误密码应返回 false", () => {
      expect(verifyPassword("wrong-password")).toBe(false);
    });

    it("空密码应返回 false", () => {
      expect(verifyPassword("")).toBe(false);
    });
  });

  describe("createAuthSession", () => {
    it("应返回 64 位十六进制 token", () => {
      const token = createAuthSession();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it("应将会话存入 Map", () => {
      const token = createAuthSession();
      expect(authenticatedSessions.has(token)).toBe(true);
    });

    it("TTL 应设置为 24 小时", () => {
      const token = createAuthSession();
      const expiry = authenticatedSessions.get(token);
      const expected = Date.now() + AUTH_SESSION_TTL_MS;
      expect(Math.abs(expiry - expected)).toBeLessThan(100);
    });
  });

  describe("hasValidAuthSession", () => {
    it("有效 token 应返回 true", () => {
      const token = createAuthSession();
      expect(hasValidAuthSession(token)).toBe(true);
    });

    it("无效 token 应返回 false", () => {
      expect(hasValidAuthSession("invalid-token")).toBe(false);
    });

    it("过期 token 应返回 false", () => {
      const token = createAuthSession();
      // 模拟时间在未来 25 小时
      const future = Date.now() + AUTH_SESSION_TTL_MS + 3600000;
      expect(hasValidAuthSession(token, future)).toBe(false);
    });

    it("过期 token 应从 Map 中删除", () => {
      const token = createAuthSession();
      const future = Date.now() + AUTH_SESSION_TTL_MS + 3600000;
      hasValidAuthSession(token, future);
      expect(authenticatedSessions.has(token)).toBe(false);
    });
  });

  describe("revokeAuthSession", () => {
    it("应删除指定 token", () => {
      const token = createAuthSession();
      expect(authenticatedSessions.has(token)).toBe(true);
      revokeAuthSession(token);
      expect(authenticatedSessions.has(token)).toBe(false);
    });

    it("空 token 不应报错", () => {
      expect(() => revokeAuthSession("")).not.toThrow();
      expect(() => revokeAuthSession(null)).not.toThrow();
      expect(() => revokeAuthSession(undefined)).not.toThrow();
    });
  });

  describe("getAuthToken", () => {
    it("应从 Cookie 中提取 AUTH token", () => {
      const req = mockReq(`${AUTH_COOKIE}=test-token-123; other=value`);
      expect(getAuthToken(req)).toBe("test-token-123");
    });

    it("无 Cookie 时返回空字符串", () => {
      const req = mockReq("");
      expect(getAuthToken(req)).toBe("");
    });

    it("无 AUTH Cookie 时返回空字符串", () => {
      const req = mockReq("other=value");
      expect(getAuthToken(req)).toBe("");
    });
  });

  describe("isAuthenticated", () => {
    it("未登录请求应返回 false", () => {
      const req = mockReq("");
      expect(isAuthenticated(req)).toBe(false);
    });

    it("有效 token 应返回 true", () => {
      const token = createAuthSession();
      const req = mockReq(`${AUTH_COOKIE}=${token}`);
      expect(isAuthenticated(req)).toBe(true);
    });

    it("无效 token 应返回 false", () => {
      const req = mockReq(`${AUTH_COOKIE}=fake-token`);
      expect(isAuthenticated(req)).toBe(false);
    });
  });

  describe("buildAuthCookie", () => {
    it("应包含 HttpOnly 和 SameSite=Lax", () => {
      const token = "test123";
      const req = mockReq("");
      const cookie = buildAuthCookie(token, req);
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).toContain(`bbc_host_auth=${token}`);
    });

    it("应包含 Max-Age", () => {
      const cookie = buildAuthCookie("test", mockReq(""));
      expect(cookie).toContain("Max-Age=");
    });
  });

  describe("csrf helpers", () => {
    it("createCsrfToken should return hex token", () => {
      const token = createCsrfToken();
      expect(token).toMatch(/^[0-9a-f]{48}$/);
    });

    it("buildCsrfCookie should include cookie name and SameSite", () => {
      const cookie = buildCsrfCookie("csrf-token", mockReq(""));
      expect(cookie).toContain(`${CSRF_COOKIE}=csrf-token`);
      expect(cookie).toContain("SameSite=Lax");
      expect(cookie).not.toContain("HttpOnly");
    });

    it("buildCsrfCookie should include Secure behind https proxy", () => {
      const req = mockReq("", { "x-forwarded-proto": "https" });
      const cookie = buildCsrfCookie("csrf-token", req);
      expect(cookie).toContain("Secure");
    });

    it("getCookie should read expected value", () => {
      const req = mockReq("foo=bar; bbc_csrf=token123; x=y");
      expect(getCookie(req, CSRF_COOKIE)).toBe("token123");
    });
  });

  describe("clearExpiredAuthSessions", () => {
    it("应清除过期会话", () => {
      const token1 = createAuthSession();
      const token2 = createAuthSession();
      const future = Date.now() + AUTH_SESSION_TTL_MS + 1000;
      clearExpiredAuthSessions(future);
      expect(authenticatedSessions.size).toBe(0);
    });
  });
});
