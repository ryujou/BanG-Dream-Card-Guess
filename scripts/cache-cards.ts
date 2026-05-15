import { readFileSync, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const cards = JSON.parse(readFileSync(path.join(rootDir, "resource", "all5_2.json"), "utf-8")) as Record<string, any>;
const cardCacheDir = path.join(rootDir, "public", "cards");
const BESTDORI_BASE = "https://bestdori.com/assets/jp/characters/resourceset";
const concurrency = Number(process.env.CONCURRENCY || 8);

const seen = new Set();
const jobs = Object.values(cards)
  .filter((card) => card?.resourceSetName)
  .flatMap((card) => ["card_normal.png", "card_after_training.png"].map((file) => ({
      resourceSetName: card.resourceSetName,
      file,
    })))
  .filter((job) => {
    const key = `${job.resourceSetName}/${job.file}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

let done = 0;
let saved = 0;
let skipped = 0;
let failed = 0;
let cursor = 0;

await mkdir(cardCacheDir, { recursive: true });
await Promise.all(Array.from({ length: concurrency }, worker));

console.log(`完成：已缓存 ${saved}，已存在 ${skipped}，失�?不存�?${failed}，总任�?${jobs.length}`);

async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor++];
    await download(job);
    done += 1;
    if (done % 50 === 0 || done === jobs.length) {
      console.log(`${done}/${jobs.length} saved=${saved} skipped=${skipped} failed=${failed}`);
    }
  }
}

async function download({ resourceSetName, file }) {
  const relativePath = path.join(`${resourceSetName}_rip`, file);
  const targetPath = path.join(cardCacheDir, relativePath);

  if (existsSync(targetPath)) {
    skipped += 1;
    return;
  }

  const url = `${BESTDORI_BASE}/${resourceSetName}_rip/${file}`;
  try {
    const response = await fetch(url);
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.includes("image")) {
      failed += 1;
      return;
    }

    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, Buffer.from(await response.arrayBuffer()));
    saved += 1;
  } catch {
    failed += 1;
  }
}
