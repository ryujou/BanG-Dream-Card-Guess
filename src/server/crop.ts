// 卡面裁剪、智能评分、人脸感知
import { Jimp } from "jimp";
import { effectiveFaceCropMode, FACE_LABELS_BY_CLASS } from "./config.js";

export function faceBoxesFor(faceBoxStore: Record<string, any>, relativePath: string): Record<string, unknown>[] {
  const entry = faceBoxStore.images?.[relativePath.replaceAll("\\", "/")];
  if (!entry?.faces?.length) return [];
  const imageArea = Math.max(1, Number(entry.width || 0) * Number(entry.height || 0));
  return entry.faces
    .map((face: any) => ({
      x: Number(face.x),
      y: Number(face.y),
      w: Number(face.w),
      h: Number(face.h),
      conf: Number(face.conf || 0),
      cls: Number.isFinite(Number(face.cls)) ? Number(face.cls) : null,
      label: faceLabel(face),
    }))
    .filter((face: any) => {
      if (!Number.isFinite(face.x) || !Number.isFinite(face.y) || face.w <= 0 || face.h <= 0) return false;
      const areaRatio = (face.w * face.h) / imageArea;
      return !(face.label === "face" && areaRatio > 0.22 && face.conf < 0.9);
    });
}

function faceLabel(face: any): string {
  const value = String(face.label || FACE_LABELS_BY_CLASS[Number(face.cls) as keyof typeof FACE_LABELS_BY_CLASS] || "").toLowerCase();
  if (value.includes("eye")) return "eyes";
  if (value.includes("mouth")) return "mouth";
  if (value.includes("face")) return "face";
  return "face";
}

export async function smartCrop(image: any, size: number, settings: Record<string, unknown>, history: any[] = [], faceBoxes: any[] = []) {
  const cropSize = Math.max(60, Math.min(260, Math.floor(size)));
  const faceMode = effectiveFaceCropMode(settings);
  const randomPoints = Array.from({ length: Math.max(30, Number(settings.candidateCount) || 120) }, () => randomCropPoint(image, cropSize));
  const facePoints = faceMode === "prefer" || faceMode === "only" ? faceCropPoints(image, cropSize, faceBoxes) : [];
  const scoredCandidates = [...randomPoints, ...facePoints]
    .map((point) => ({ ...point, score: scoreCrop(image, point.x, point.y, cropSize, faceBoxes, faceMode) }))
    .sort((a, b) => b.score - a.score);
  const candidates = scoredCandidates.filter((crop) => crop.score > 0);

  const crop = pickCrop(candidates.length ? candidates : scoredCandidates, cropSize, history) || randomCropPoint(image, cropSize);
  const dataUrl = await cropToDataUrl(image, crop.x, crop.y, cropSize);
  return { x: crop.x, y: crop.y, size: cropSize, image: dataUrl };
}

export function randomCropPoint(image: any, size: number) {
  const maxX = Math.max(0, image.bitmap.width - size);
  const maxY = Math.max(0, image.bitmap.height - size);
  const marginX = Math.min(maxX, Math.floor(image.bitmap.width * 0.08));
  const marginY = Math.min(maxY, Math.floor(image.bitmap.height * 0.08));
  const xRange = Math.max(1, maxX - marginX * 2);
  const yRange = Math.max(1, maxY - marginY * 2);
  return {
    x: Math.min(maxX, marginX + Math.floor(Math.random() * xRange)),
    y: Math.min(maxY, marginY + Math.floor(Math.random() * yRange)),
  };
}

export function faceCropPoints(image: any, size: number, faceBoxes: any[]) {
  if (!faceBoxes.length) return [];
  const maxX = Math.max(0, image.bitmap.width - size);
  const maxY = Math.max(0, image.bitmap.height - size);
  const offsets = [
    [0, 0], [-0.28, 0], [0.28, 0], [0, -0.28], [0, 0.28],
    [-0.28, -0.28], [0.28, -0.28], [0.28, 0.28], [-0.28, 0.28],
  ];
  const points: {x: number, y: number}[] = [];
  for (const face of faceBoxes.slice(0, 8)) {
    for (const [ox, oy] of offsets) {
      const cx = Math.round(face.x + face.w * 0.5 - size * 0.5 + ox * size);
      const cy = Math.round(face.y + face.h * 0.5 - size * 0.5 + oy * size);
      points.push({ x: Math.max(0, Math.min(maxX, cx)), y: Math.max(0, Math.min(maxY, cy)) });
    }
  }
  return points;
}

export function pickCrop(candidates: any[], size: number, history: any[] = []) {
  const passes = [size * 1.85, size * 1.2, 0];
  for (const minDistance of passes) {
    const crop = candidates.find((candidate) => {
      return history.every((old) => Math.hypot(old.x - candidate.x, old.y - candidate.y) >= minDistance);
    });
    if (crop) return crop;
  }
  return candidates[0];
}

export function scoreCrop(image: any, x: number, y: number, size: number, faceBoxes: any[] = [], faceMode = "none") {
  const { width, height } = image.bitmap;
  if (x < 0 || y < 0 || x + size > width || y + size > height) return 0;

  let score = 0;
  const step = Math.max(2, Math.floor(size / 25));
  let colorVariance = 0;
  let edgeCount = 0;
  let sampleCount = 0;
  let saturationSum = 0;

  try {
    const data = image.bitmap.data;
    for (let row = y; row < y + size; row += step) {
      for (let col = x; col < x + size; col += step) {
        const p = pixel(data, width, col, row);
        const next = col + step < x + size ? pixel(data, width, col + step, row) : p;
        colorVariance += Math.abs(p.r - next.r) + Math.abs(p.g - next.g) + Math.abs(p.b - next.b);
        const maxC = Math.max(p.r, p.g, p.b);
        const minC = Math.min(p.r, p.g, p.b);
        saturationSum += maxC === 0 ? 0 : (maxC - minC) / maxC;
        sampleCount++;
      }
    }
    for (let row = y; row < y + size; row += step) {
      for (let col = x; col < x + size; col += step) {
        if (col + step < x + size) {
          const a = pixel(data, width, col, row);
          const b = pixel(data, width, col + step, row);
          if (Math.abs(a.luma - b.luma) > 30) edgeCount++;
        }
        if (row + step < y + size) {
          const a = pixel(data, width, col, row);
          const b = pixel(data, width, col, row + step);
          if (Math.abs(a.luma - b.luma) > 30) edgeCount++;
        }
      }
    }

    const avgVariance = colorVariance / Math.max(1, sampleCount);
    const avgSaturation = saturationSum / Math.max(1, sampleCount);
    score = avgVariance * 0.5 + avgSaturation * 300 + (edgeCount / Math.max(1, sampleCount)) * 400;

    if (avgVariance < 12 || edgeCount < 3) score = 0;
    if (faceMode !== "none" && faceBoxes.length) {
      score += scoreFacePolicy({ x, y, w: size, h: size }, faceBoxes, faceMode);
    }
  } catch {
    return 0;
  }
  return score;
}

export function scoreFacePolicy(crop: any, faceBoxes: any[], mode: string) {
  let score = 0;
  for (const face of faceBoxes) {
    const zone = expandedFaceZone(face);
    const overlap = overlapArea(crop, zone);
    const zoneArea = zone.w * zone.h;
    const cropArea = crop.w * crop.h;
    const ratio = overlap / Math.min(zoneArea, cropArea);
    if (mode === "avoid" && ratio > 0) score -= ratio * 800;
    if (mode === "prefer" && ratio > 0.1) score += ratio * 600;
    if (mode === "only") score = ratio > 0.3 ? score + ratio * 500 : score - 200;
  }
  return score;
}

export function expandedFaceZone(face: any) {
  const label = face.label || faceLabel(face);
  const config =
    label === "eyes"
      ? { scaleX: 4.6, scaleY: 5.4, offsetY: 1.25 }
      : label === "mouth"
        ? { scaleX: 4.0, scaleY: 4.8, offsetY: -1.15 }
        : { scaleX: 1.85, scaleY: 1.95, offsetY: 0.08 };

  const cx = face.x + face.w / 2;
  const cy = face.y + face.h / 2 + face.h * config.offsetY;
  const w = face.w * config.scaleX;
  const h = face.h * config.scaleY;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

export function overlapArea(a: any, b: any) {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function pixel(data: Buffer, width: number, x: number, y: number) {
  const index = (y * width + x) * 4;
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  return { r, g, b, luma: 0.299 * r + 0.587 * g + 0.114 * b };
}

export async function cropToDataUrl(image: any, x: number, y: number, size: number) {
  const cropped = image.clone().crop({ x, y, w: size, h: size });
  const buffer = await cropped.getBuffer("image/jpeg");
  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}
