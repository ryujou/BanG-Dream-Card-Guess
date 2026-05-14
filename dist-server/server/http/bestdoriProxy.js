"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.proxyBestdori = proxyBestdori;
const http_js_1 = require("../utils/http.js");
// @ts-ignore
const config_mjs_1 = require("../config.mjs");
async function proxyBestdori(url, res) {
    const targetPath = url.pathname.replace(/^\/bestdori/, "");
    const target = `${config_mjs_1.BESTDORI_ORIGIN}${targetPath}`;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10_000);
        const response = await fetch(target, { signal: controller.signal });
        clearTimeout(timeoutId);
        res.writeHead(response.status, {
            ...(0, http_js_1.securityHeaders)(),
            "Content-Type": response.headers.get("content-type") || "application/octet-stream",
            "Cache-Control": "public, max-age=86400",
        });
        res.end(Buffer.from(await response.arrayBuffer()));
    }
    catch {
        (0, http_js_1.sendJson)(res, { error: "Upstream timeout" }, 504);
    }
}
