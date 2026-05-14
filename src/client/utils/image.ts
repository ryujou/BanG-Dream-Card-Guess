export function safeUrl(value: string | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "#";
  try {
    const url = new URL(raw, window.location.origin);
    if (!["http:", "https:"].includes(url.protocol)) return "#";
    return url.href;
  } catch {
    return "#";
  }
}
