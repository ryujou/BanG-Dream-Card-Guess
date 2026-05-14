"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serveStatic = serveStatic;
exports.streamFile = streamFile;
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
// @ts-ignore
const config_mjs_1 = require("../../../src/server/config.mjs");
const http_js_1 = require("../utils/http.js");
async function serveStatic(requestUrl, res, publicDir, distDir) {
    const cleanPath = decodeURIComponent(requestUrl.split("?")[0]);
    const staticPath = cleanPath === "/" ? "index.html" : cleanPath.replace(/^\/+/, "");
    let filePath = node_path_1.default.join(publicDir, staticPath);
    if (filePath.startsWith(publicDir) && (0, node_fs_1.existsSync)(filePath) && !(await (0, promises_1.stat)(filePath).catch(() => null))?.isDirectory()) {
        streamFile(filePath, res);
        return;
    }
    filePath = node_path_1.default.join(distDir, cleanPath === "/" ? "index.html" : cleanPath);
    if (!filePath.startsWith(distDir)) {
        res.writeHead(403, (0, http_js_1.securityHeaders)());
        res.end("Forbidden");
        return;
    }
    if (!(0, node_fs_1.existsSync)(filePath) || (await (0, promises_1.stat)(filePath).catch(() => null))?.isDirectory()) {
        filePath = node_path_1.default.join(distDir, "index.html");
    }
    streamFile(filePath, res);
}
function streamFile(filePath, res) {
    const ext = node_path_1.default.extname(filePath).toLowerCase();
    res.writeHead(200, {
        ...(0, http_js_1.securityHeaders)(),
        "Content-Type": config_mjs_1.MIME[ext] || "application/octet-stream",
        "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=3600",
    });
    (0, node_fs_1.createReadStream)(filePath).on("error", () => {
        if (!res.headersSent) {
            res.writeHead(404, (0, http_js_1.securityHeaders)());
            res.end("Not found");
        }
    }).pipe(res);
}
