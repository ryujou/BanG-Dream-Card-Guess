// 网络地址检测与 URL 生成
import { networkInterfaces } from "node:os";
import { unique } from "./config.js";

export function currentOriginFromRequest(req: unknown) {
  const headers = (req as { headers?: Record<string, string> })?.headers || {};
  const host = headers.host || "127.0.0.1";
  const proto = headers["x-forwarded-proto"] || "http";
  return `${proto}://${host}`;
}

export function originList(activePort: number) {
  const origins = [`http://127.0.0.1:${activePort}`];
  for (const host of lanHosts()) {
    origins.push(`http://${host}:${activePort}`);
  }
  return origins;
}

export function lanHosts() {
  const hosts: string[] = [];
  for (const items of Object.values(networkInterfaces())) {
    for (const item of items || []) {
      if (item.family === "IPv4" && !item.internal) {
        hosts.push(item.address);
      }
    }
  }
  return unique(hosts);
}

export function pageUrls(origin: string) {
  return {
    player: `${origin}/player`,
    noteShooter: `${origin}/note-shooter`,
    stopwatchChallenge: `${origin}/games/stopwatch-challenge`,
    queue: `${origin}/note-shooter`,
    scores: `${origin}/scores`,
    login: `${origin}/login`,
    host: `${origin}/host`,
    settings: `${origin}/settings`,
    solo: `${origin}/solo`,
    qr: `${origin}/qr`,
  };
}

export function networkState(req: unknown) {
  const headers = (req as { headers?: Record<string, string> })?.headers || {};
  return {
    port: Number(process.env.PORT || 5173),
    currentOrigin: currentOriginFromRequest(req),
    lanHosts: lanHosts(),
    requestHost: headers.host || "",
  };
}
