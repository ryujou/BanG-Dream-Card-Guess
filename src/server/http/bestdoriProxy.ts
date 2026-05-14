import type { ServerResponse } from "node:http";
import { securityHeaders, sendJson } from "../utils/http.js";
// @ts-ignore
import { BESTDORI_ORIGIN } from "../../../src/server/config.mjs";

export async function proxyBestdori(url: URL, res: ServerResponse): Promise<void> {
  const targetPath = url.pathname.replace(/^\/bestdori/, "");
  const target = `${BESTDORI_ORIGIN}${targetPath}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(target, { signal: controller.signal });
    clearTimeout(timeoutId);
    res.writeHead(response.status, {
      ...securityHeaders(),
      "Content-Type": response.headers.get("content-type") || "application/octet-stream",
      "Cache-Control": "public, max-age=86400",
    });
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    sendJson(res, { error: "Upstream timeout" }, 504);
  }
}
