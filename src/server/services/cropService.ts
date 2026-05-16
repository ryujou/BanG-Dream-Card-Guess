import { Jimp } from "jimp";
import { smartCrop } from "../crop.js";
import type { CropResult, FaceBox, JimpLikeImage } from "../types/crop.js";

export interface CropService {
  cropCard(buffer: Buffer, settings: Record<string, unknown>, faceBoxes: FaceBox[]): Promise<{ image: unknown; crop: CropResult }>;
  recropCard(current: unknown, settings: Record<string, unknown>, cropHistory: CropResult[]): Promise<CropResult>;
  validateCropResult(result: unknown): boolean;
}

export function createCropService(): CropService {
  return {
    async cropCard(buffer: Buffer, settings: Record<string, unknown>, faceBoxes: FaceBox[]) {
      const image = await Jimp.read(buffer) as JimpLikeImage;
      const crop = await smartCrop(image, (settings.cropSize as number), settings, [], faceBoxes);
      return { image, crop };
    },
    async recropCard(current: unknown, settings: Record<string, unknown>, cropHistory: CropResult[]) {
      const round = isRoundWithSource(current);
      const image = await Jimp.read(round.sourceBuffer) as JimpLikeImage;
      return smartCrop(image, (settings.cropSize as number), settings, cropHistory, round.faceBoxes);
    },
    validateCropResult(result: unknown) {
      return isCropLike(result);
    },
  };
}

export function createFakeCropService(crop: CropResult = { x: 0, y: 0, image: "" }): CropService {
  return {
    async cropCard() {
      return { image: { bitmap: { width: 100, height: 100 } }, crop };
    },
    async recropCard() {
      return crop;
    },
    validateCropResult(result: unknown) {
      return !!result;
    },
  };
}

function isCropLike(result: unknown): result is CropResult {
  return typeof result === "object" && result !== null
    && Number.isFinite(Number((result as Record<string, unknown>).x))
    && Number.isFinite(Number((result as Record<string, unknown>).y));
}

function isRoundWithSource(value: unknown): { sourceBuffer: Buffer; faceBoxes: FaceBox[] } {
  if (typeof value === "object" && value !== null && Buffer.isBuffer((value as Record<string, unknown>).sourceBuffer)) {
    const faceBoxes = Array.isArray((value as Record<string, unknown>).faceBoxes)
      ? (value as Record<string, unknown>).faceBoxes as FaceBox[]
      : [];
    return { sourceBuffer: (value as Record<string, unknown>).sourceBuffer as Buffer, faceBoxes };
  }
  throw new Error("Invalid current round");
}
