export function safeUrl(value: string | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "#";
  try {
    let normalized = raw;
    if (/^\/\//.test(normalized)) {
      normalized = `https:${normalized}`;
    } else if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(normalized) && /^[^/\s]+\.[^/\s]+(?:[/?#]|$)/.test(normalized)) {
      normalized = `https://${normalized}`;
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const url = new URL(normalized, origin);
    if (!["http:", "https:"].includes(url.protocol)) return "#";
    return url.href;
  } catch {
    return "#";
  }
}
