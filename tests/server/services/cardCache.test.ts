import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createCardCache, createMemoryCardCache } from "../../../src/server/services/cardCache";

describe("card cache service", () => {
  it("reads and writes cache files without changing URL format", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "bbc-card-cache-"));
    try {
      const cache = createCardCache(dir);
      await cache.writeCache("set_rip/card_normal.png", Buffer.from("image"));
      expect(cache.hasUsableCache("set_rip/card_normal.png")).toBe(true);
      expect(cache.readCache("set_rip/card_normal.png")?.toString()).toBe("image");
      expect(cache.imageUrl("set_rip/card_normal.png")).toBe("/cards/set_rip/card_normal.png");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("damaged cache metadata falls back to zero cache info", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "bbc-card-cache-"));
    try {
      await writeFile(path.join(dir, ".cache-meta.json"), "{not-json");
      const cache = createCardCache(dir);
      expect(cache.getCacheInfo(10)).toEqual({ cachedSets: 0, cachePercent: 0 });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("memory cache is usable by offline tests", async () => {
    const cache = createMemoryCardCache();
    await cache.writeCache("a/b.png", Buffer.from("x"));
    expect(cache.readCache("a/b.png")?.toString()).toBe("x");
  });
});
