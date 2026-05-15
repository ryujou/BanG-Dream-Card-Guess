import { Jimp } from "jimp";
import { smartCrop } from "../crop.js";

export interface CropService {
  cropCard(buffer: Buffer, settings: Record<string, unknown>, faceBoxes: unknown[]): Promise<{ image: unknown; crop: unknown }>;
  recropCard(current: unknown, settings: Record<string, unknown>, cropHistory: unknown[]): Promise<unknown>;
  validateCropResult(result: unknown): boolean;
}

export function createCropService(): CropService {
  return {
    async cropCard(buffer: Buffer, settings: Record<string, unknown>, faceBoxes: unknown[]) {
      const image = await Jimp.read(buffer);
      const crop = await smartCrop(image, (settings.cropSize as number), settings, [], faceBoxes);
      return { image, crop };
    },
    async recropCard(current: any, settings: Record<string, unknown>, cropHistory: unknown[]) {
      const image = await Jimp.read(current.sourceBuffer);
      return smartCrop(image, (settings.cropSize as number), settings, cropHistory, current.faceBoxes || []);
    },
    validateCropResult(result: any) {
      return !!result && Number.isFinite(result.x) && Number.isFinite(result.y);
    },
  };
}

export function createFakeCropService(crop: unknown = { x: 0, y: 0, image: "" }): CropService {
  return {
    async cropCard() {
      return { image: { bitmap: { width: 100, height: 100 } }, crop };
    },
    async recropCard() {
      return crop;
    },
    validateCropResult(result: any) {
      return !!result;
    },
  };
}
