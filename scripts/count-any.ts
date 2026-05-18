import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const roots = ["src", "scripts", "tests"];
const ignoredDirs = new Set(["node_modules", "dist", "dist-server", "dist-scripts", "coverage", "artifacts", "test-results", "playwright-report"]);
const anyPattern = /\bany\b/g;

const results: Array<{ file: string; count: number }> = [];

for (const root of roots) {
  await scan(path.join(rootDir, root));
}

const total = results.reduce((sum, item) => sum + item.count, 0);
for (const item of results.sort((a, b) => b.count - a.count || a.file.localeCompare(b.file))) {
  console.log(`${item.count}\t${item.file}`);
}
console.log(`TOTAL\t${total}`);

async function scan(dir: string): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await scan(fullPath);
      continue;
    }
    if (!/\.(ts|tsx|vue)$/.test(entry.name)) continue;
    const text = await readFile(fullPath, "utf8");
    const count = (text.match(anyPattern) || []).length;
    if (count > 0) {
      results.push({ file: path.relative(rootDir, fullPath).replaceAll("\\", "/"), count });
    }
  }
}
