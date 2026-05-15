import { Jimp } from "jimp";
// @ts-ignore
import { smartCrop } from "../../../src/server/crop.mjs";

export interface CropService {
  cropCard(buffer: Buffer, settings: Record<string, any>, faceBoxes: any[]): Promise<{ image: any; crop: any }>;
  recropCard(current: any, settings: Record<string, any>, cropHistory: any[]): Promise<any>;
  validateCropResult(result: any): boolean;
}

export function createCropService(): CropService {
  return {
    async cropCard(buffer, settings, faceBoxes) {
      const image = await Jimp.read(buffer);
      const crop = await smartCrop(image, settings.cropSize, settings, [], faceBoxes);
      return { image, crop };
    },
    async recropCard(current, settings, cropHistory) {
      const image = await Jimp.read(current.sourceBuffer);
      return smartCrop(image, settings.cropSize, settings, cropHistory, current.faceBoxes || []);
    },
    validateCropResult(result) {
      return !!result && Number.isFinite(result.x) && Number.isFinite(result.y);
    },
  };
}

export function createFakeCropService(crop: any = { x: 0, y: 0, image: "" }): CropService {
  return {
    async cropCard() {
      return { image: { bitmap: { width: 100, height: 100 } }, crop };
    },
    async recropCard() {
      return crop;
    },
    validateCropResult(result) {
      return !!result;
    },
  };
}

