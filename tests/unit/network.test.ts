import { describe, it, expect } from "vitest";
import {
  lanHosts, originList, pageUrls, networkState, currentOriginFromRequest,
} from "../../src/server/network";
import { networkInterfaces } from "node:os";

describe("network.ts", () => {
  describe("lanHosts", () => {
    it("case 1", () => {
      expect(Array.isArray(lanHosts())).toBe(true);
    });

    it("case 2", () => {
      const hosts = lanHosts();
      expect(hosts).not.toContain("127.0.0.1");
    });

    it("case 3", () => {
      const hosts = lanHosts();
      for (const host of hosts) {
        expect(host).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
      }
    });

    it("case 4", () => {
      const hosts = lanHosts();
      expect(new Set(hosts).size).toBe(hosts.length);
    });
  });

  describe("originList", () => {
    it("case 5", () => {
      const origins = originList(5173);
      expect(origins.some((o) => o.includes("127.0.0.1:5173"))).toBe(true);
    });

    it("case 6", () => {
      const origins = originList(5173);
      for (const origin of origins) {
        expect(origin).toMatch(/^http:\/\/.+/);
      }
    });
  });

  describe("pageUrls", () => {
    it("case 7", () => {
      const urls = pageUrls("http://127.0.0.1:5173");
      expect(urls).toHaveProperty("player");
      expect(urls).toHaveProperty("host");
      expect(urls).toHaveProperty("settings");
      expect(urls).toHaveProperty("login");
      expect(urls).toHaveProperty("solo");
      expect(urls).toHaveProperty("qr");
      expect(urls).toHaveProperty("noteShooter");
    });

    it("case 8", () => {
      const urls = pageUrls("http://test:8080");
      for (const url of Object.values(urls)) {
        expect(url).toContain("http://test:8080");
      }
    });
  });

  describe("currentOriginFromRequest", () => {
    it("case 9", () => {
      const req = { headers: { host: "example.com:3000" } };
      expect(currentOriginFromRequest(req)).toBe("http://example.com:3000");
    });

    it("case 10", () => {
      const req = { headers: { host: "example.com", "x-forwarded-proto": "https" } };
      expect(currentOriginFromRequest(req)).toBe("https://example.com");
    });

    it("case 11", () => {
      const req = { headers: {} };
      expect(currentOriginFromRequest(req)).toContain("127.0.0.1");
    });
  });

  describe("networkState", () => {
    it("case 12", () => {
      const req = { headers: { host: "localhost:5173" } };
      const state = networkState(req);
      expect(state).toHaveProperty("port");
      expect(state).toHaveProperty("currentOrigin");
      expect(state).toHaveProperty("lanHosts");
      expect(state).toHaveProperty("requestHost");
    });
  });
});
