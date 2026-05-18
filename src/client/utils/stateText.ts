export function statusText(status: string | undefined): string {
  const statusMap: Record<string, string> = {
    idle: "READY",
    loading: "LOADING",
    playing: "PLAYING",
    revealed: "ANSWER",
    finished: "DONE",
  };
  return statusMap[status || ""] || "READY";
}
