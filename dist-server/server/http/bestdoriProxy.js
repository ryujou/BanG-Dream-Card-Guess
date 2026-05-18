import { securityHeaders, sendJson } from "../utils/http.js";
import { BESTDORI_ORIGIN } from "../config.js";
export async function proxyBestdori(url, res) {
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
    }
    catch {
        sendJson(res, { error: "Upstream timeout" }, 504);
    }
}
//# sourceMappingURL=bestdoriProxy.js.map