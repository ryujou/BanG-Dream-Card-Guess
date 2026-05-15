// Node startup compatibility entry.
// The backend implementation lives in src/server/index.ts and is loaded from
// the compiled dist-server/server/index.js output at runtime.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compiledEntry = path.join(__dirname, "dist-server", "server", "index.js");

if (!existsSync(compiledEntry)) {
  console.error("Missing compiled server entry. Run `npm run build:server` first.");
  process.exit(1);
}

await import(`./dist-server/server/index.js?ts=${Date.now()}`);
