export function safeNextPath(value: string | null | undefined): string {
  const next = String(value || "/host");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/host";
}
