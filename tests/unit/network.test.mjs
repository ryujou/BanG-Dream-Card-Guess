import { describe, it, expect } from "vitest";
import {
  lanHosts, originList, pageUrls, networkState, currentOriginFromRequest,
} from "../../src/server/network.mjs";
import { networkInterfaces } from "node:os";

describe("network.mjs", () => {
  describe("lanHosts", () => {
    it("应返回数组", () => {
      expect(Array.isArray(lanHosts())).toBe(true);
    });

    it("不应包含 127.0.0.1", () => {
      const hosts = lanHosts();
      expect(hosts).not.toContain("127.0.0.1");
    });

    it("每个值应为有效 IP 格式", () => {
      const hosts = lanHosts();
      for (const host of hosts) {
        expect(host).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
      }
    });

    it("不应有重复", () => {
      const hosts = lanHosts();
      expect(new Set(hosts).size).toBe(hosts.length);
    });
  });

  describe("originList", () => {
    it("应包含 localhost origin", () => {
      const origins = originList(5173);
      expect(origins.some((o) => o.includes("127.0.0.1:5173"))).toBe(true);
    });

    it("所有 origin 应以 http:// 开头", () => {
      const origins = originList(5173);
      for (const origin of origins) {
        expect(origin).toMatch(/^http:\/\/.+/);
      }
    });
  });

  describe("pageUrls", () => {
    it("应生成所有页面 URL", () => {
      const urls = pageUrls("http://127.0.0.1:5173");
      expect(urls).toHaveProperty("player");
      expect(urls).toHaveProperty("host");
      expect(urls).toHaveProperty("settings");
      expect(urls).toHaveProperty("login");
      expect(urls).toHaveProperty("solo");
      expect(urls).toHaveProperty("qr");
      expect(urls).toHaveProperty("noteShooter");
    });

    it("页面 URL 应包含 origin", () => {
      const urls = pageUrls("http://test:8080");
      for (const url of Object.values(urls)) {
        expect(url).toContain("http://test:8080");
      }
    });
  });

  describe("currentOriginFromRequest", () => {
    it("应从请求头提取 origin", () => {
      const req = { headers: { host: "example.com:3000" } };
      expect(currentOriginFromRequest(req)).toBe("http://example.com:3000");
    });

    it("应使用 x-forwarded-proto", () => {
      const req = { headers: { host: "example.com", "x-forwarded-proto": "https" } };
      expect(currentOriginFromRequest(req)).toBe("https://example.com");
    });

    it("无 host 时应使用 127.0.0.1", () => {
      const req = { headers: {} };
      expect(currentOriginFromRequest(req)).toContain("127.0.0.1");
    });
  });

  describe("networkState", () => {
    it("应返回包含必要字段的对象", () => {
      const req = { headers: { host: "localhost:5173" } };
      const state = networkState(req);
      expect(state).toHaveProperty("port");
      expect(state).toHaveProperty("currentOrigin");
      expect(state).toHaveProperty("lanHosts");
      expect(state).toHaveProperty("requestHost");
    });
  });
});
