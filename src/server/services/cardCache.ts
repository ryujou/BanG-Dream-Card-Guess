import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export interface CardCacheInfo {
  cachedSets: number;
  cachePercent: number;
}

export interface CardCache {
  readCache(relativePath: string): Buffer | null;
  writeCache(relativePath: string, buffer: Buffer): Promise<void>;
  hasUsableCache(relativePath: string): boolean;
  getCacheInfo(totalCards: number): CardCacheInfo;
  imageUrl(relativePath: string): string;
}

export function createCardCache(cardCacheDir: string): CardCache {
  const normalize = (relativePath: string) => relativePath.replaceAll("\\", "/");
  const cachePath = (relativePath: string) => path.join(cardCacheDir, relativePath);

  return {
    readCache(relativePath) {
      const filePath = cachePath(relativePath);
      if (!existsSync(filePath)) return null;
      return readFileSync(filePath);
    },
    async writeCache(relativePath, buffer) {
      const filePath = cachePath(relativePath);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, buffer);
    },
    hasUsableCache(relativePath) {
      return existsSync(cachePath(relativePath));
    },
    getCacheInfo(totalCards) {
      let cachedSets = 0;
      try {
        const raw = readFileSync(path.join(cardCacheDir, ".cache-meta.json"), "utf-8");
        cachedSets = JSON.parse(raw).count || 0;
      } catch {
        cachedSets = 0;
      }
      return {
        cachedSets,
        cachePercent: cachedSets ? Math.round((Math.min(cachedSets, totalCards) / totalCards) * 100) : 0,
      };
    },
    imageUrl(relativePath) {
      return `/cards/${normalize(relativePath)}`;
    },
  };
}

export function createMemoryCardCache(initial: Record<string, Buffer> = {}): CardCache {
  const store = new Map(Object.entries(initial));
  return {
    readCache(relativePath) {
      return store.get(relativePath.replaceAll("\\", "/")) || null;
    },
    async writeCache(relativePath, buffer) {
      store.set(relativePath.replaceAll("\\", "/"), buffer);
    },
    hasUsableCache(relativePath) {
      return store.has(relativePath.replaceAll("\\", "/"));
    },
    getCacheInfo(totalCards) {
      const cachedSets = store.size;
      return {
        cachedSets,
        cachePercent: cachedSets ? Math.round((Math.min(cachedSets, totalCards) / totalCards) * 100) : 0,
      };
    },
    imageUrl(relativePath) {
      return `/cards/${relativePath.replaceAll("\\", "/")}`;
    },
  };
}

