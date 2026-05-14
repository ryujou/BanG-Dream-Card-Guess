export function safeUrl(value: string | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "#";
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(raw, origin);
    if (!["http:", "https:"].includes(url.protocol)) return "#";
    return url.href;
  } catch {
    return "#";
  }
}
