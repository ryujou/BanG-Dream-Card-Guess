import path from "node:path";
import { existsSync, createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { MIME } from "../config.js";
import { securityHeaders } from "../utils/http.js";
export async function serveStatic(requestUrl, res, publicDir, distDir) {
    const cleanPath = decodeURIComponent(requestUrl.split("?")[0]);
    const staticPath = cleanPath === "/" ? "index.html" : cleanPath.replace(/^\/+/, "");
    let filePath = path.join(publicDir, staticPath);
    if (filePath.startsWith(publicDir) && existsSync(filePath) && !(await stat(filePath).catch(() => null))?.isDirectory()) {
        streamFile(filePath, res);
        return;
    }
    filePath = path.join(distDir, cleanPath === "/" ? "index.html" : cleanPath);
    if (!filePath.startsWith(distDir)) {
        res.writeHead(403, securityHeaders());
        res.end("Forbidden");
        return;
    }
    if (!existsSync(filePath) || (await stat(filePath).catch(() => null))?.isDirectory()) {
        filePath = path.join(distDir, "index.html");
    }
    streamFile(filePath, res);
}
export function streamFile(filePath, res) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
        ...securityHeaders(),
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
    });
    createReadStream(filePath).on("error", () => {
        if (!res.headersSent) {
            res.writeHead(404, securityHeaders());
            res.end("Not found");
        }
    }).pipe(res);
}
//# sourceMappingURL=static.js.map