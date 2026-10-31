import type { Community } from "../../../shared/types";

export type CommunityPhoto = Exclude<Community["photos"][number], string>;
export type CommunityContent = Omit<Community, "photos" | "bilibili"> & {
  photos: CommunityPhoto[];
  bilibili: NonNullable<Community["bilibili"]>;
};

export function normalizeCommunity(value: Community): CommunityContent {
  return {
    ...value,
    photos: value.photos.map(photo => typeof photo === "string" ? { url: photo, title: "", desc: "" } : { ...photo }),
    bilibili: value.bilibili || [],
  };
}

export function moveCommunityItem<T>(items: T[], index: number, offset: number) {
  const next = [...items];
  [next[index], next[index + offset]] = [next[index + offset], next[index]];
  return next;
}

export function safeCommunityLink(value: string, origin: string) {
  if (!value.trim()) return "";
  try {
    const url = new URL(value, origin);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export function isPastEvent(date: string, now = new Date()) {
  const parts = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(date.trim());
  if (!parts) return false;
  const day = `${parts[1]}-${parts[2].padStart(2, "0")}-${parts[3].padStart(2, "0")}`;
  return day < now.toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" });
}

export function communityThumbnail(url: string) {
  return /^\/community\/(?:avatars\/member-[1-4]|photos\/photo-[1-4]|bilibili-cover)\.jpg$/.test(url)
    ? url.replace(/\.jpg$/, "-thumb.webp")
    : url;
}

export const communityError = (error: unknown) =>
  error instanceof Error ? error.message : "请求失败，请稍后再试。";
