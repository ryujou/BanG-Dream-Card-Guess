import sharp from "sharp";
import { fileURLToPath } from "node:url";

const images = [
  ...[1, 2, 3, 4].map((n) => [`avatars/member-${n}`, 192]),
  ...[1, 2, 3, 4].map((n) => [`photos/photo-${n}`, 640]),
  ["bilibili-cover", 640],
];
for (const [name, width] of images) {
  const source = fileURLToPath(new URL(`../public/community/${name}.jpg`, import.meta.url));
  await sharp(source).resize({ width, withoutEnlargement: true }).webp({ quality: 82 })
    .toFile(source.replace(/\.jpg$/, "-thumb.webp"));
}
