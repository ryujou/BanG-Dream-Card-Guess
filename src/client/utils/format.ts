export function formatQueueDuration(value: unknown): string {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return seconds ? `${seconds}s` : "-";
}

export function formatQueueTime(value: unknown): string {
  const time = Number(value);
  if (!Number.isFinite(time)) return "-";
  return new Date(time).toLocaleTimeString();
}
