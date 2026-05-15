import { mkdirSync, rmSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactsDir = path.join(root, "artifacts");
const outFile = path.join(artifactsDir, "bang-dream-card-guess-local.tar.gz");

mkdirSync(artifactsDir, { recursive: true });
if (existsSync(outFile)) rmSync(outFile, { force: true });

const excludes = [
  ".git",
  "node_modules",
  "dist",
  "dist-server",
  ".server-build",
  "data/settings.json",
  "data/*scores*.json",
  "test-results",
  "playwright-report",
  "coverage",
  "artifacts",
  "*.tar.gz",
  "*.tgz",
  "*.zip",
  "*.log",
  "npm-debug.log",
  "yarn-debug.log",
  "yarn-error.log",
];

const args = [
  ...excludes.flatMap((item) => [`--exclude=${item}`]),
  "-czf",
  outFile,
  ".",
];

const result = spawnSync("tar", args, {
  cwd: root,
  stdio: "inherit",
});

if (result.status !== 0) {
  throw new Error("Failed to create local release package. Ensure the tar command is available.");
}

console.log(`Local release package created: ${outFile}`);
