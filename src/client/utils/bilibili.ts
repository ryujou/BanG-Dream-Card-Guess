export interface BilibiliUrlOptions {
  bvid?: unknown;
  aid?: unknown;
  cid?: unknown;
  page?: unknown;
  autoplay?: unknown;
  danmaku?: unknown;
  highQuality?: unknown;
  high_quality?: unknown;
  minimalMode?: unknown;
}

export function normalizeBvid(value: unknown): string {
  const raw = String(value || "").trim().replace(/\s+/g, "");
  if (!raw) return "";
  const withPrefix = /^BV/i.test(raw) ? raw : `BV${raw}`;
  const normalized = withPrefix.slice(0, 12);
  return /^BV[0-9A-Za-z]{10}$/.test(normalized) ? normalized : "";
}

export function normalizeAid(value: unknown): string {
  const raw = String(value || "").trim();
  return /^\d+$/.test(raw) ? raw : "";
}

export function isMobileBrowser(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

export function pickBilibiliCover(source: Record<string, unknown>): string {
  const candidates = [source.cover, source.poster, source.thumbnail, source.pic];
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) return value;
  }
  return "";
}

export function buildBilibiliEmbedUrl(options: BilibiliUrlOptions): string {
  const bvid = normalizeBvid(options.bvid);
  const aid = normalizeAid(options.aid);
  if (!bvid && !aid) return "";
  const params = new URLSearchParams();
  params.set("isOutside", "true");
  params.set("autoplay", toFlag(options.autoplay, false));
  params.set("danmaku", toFlag(options.danmaku, false));
  if (bvid) params.set("bvid", bvid);
  else params.set("aid", aid);

  const cid = normalizeAid(options.cid);
  if (cid) params.set("cid", cid);

  const page = normalizeAid(options.page) || "1";

  const highQuality = options.highQuality ?? options.high_quality;
  if (highQuality !== undefined) params.set("high_quality", toFlag(highQuality, true));
  const useMinimal = Boolean(options.minimalMode);
  if (useMinimal) {
    params.set("p", page);
    params.set("hideCoverInfo", "1");
    return `https://www.bilibili.com/blackboard/html5mobileplayer.html?${params.toString()}`;
  }
  params.set("page", page);
  return `https://player.bilibili.com/player.html?${params.toString()}`;
}

export function buildBilibiliVideoUrl(options: Pick<BilibiliUrlOptions, "bvid" | "aid">): string {
  const bvid = normalizeBvid(options.bvid);
  if (bvid) return `https://www.bilibili.com/video/${encodeURIComponent(bvid)}`;
  const aid = normalizeAid(options.aid);
  if (aid) return `https://www.bilibili.com/video/av${encodeURIComponent(aid)}`;
  return "";
}

function toFlag(value: unknown, fallback: boolean): string {
  const normalized = value === undefined ? fallback : Boolean(value);
  return normalized ? "1" : "0";
}
