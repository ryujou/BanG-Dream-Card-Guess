// @ts-ignore qrcode does not ship local TypeScript declarations in this project.
import QRCode from "qrcode";

export interface QRCodeService {
  createQrPayload(text: string): string;
  createQrImage(text: string, options?: Record<string, unknown>): Promise<string>;
}

export function createQRCodeService(): QRCodeService {
  return {
    createQrPayload(text) {
      return text;
    },
    createQrImage(text, options = {}) {
      return QRCode.toString(text, options);
    },
  };
}

export function createFakeQRCodeService(svg = "<svg></svg>"): QRCodeService {
  return {
    createQrPayload(text) {
      return text;
    },
    async createQrImage() {
      return svg;
    },
  };
}
