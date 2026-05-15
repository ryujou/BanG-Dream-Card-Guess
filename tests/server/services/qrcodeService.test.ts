import { describe, expect, it } from "vitest";
import { createFakeQRCodeService } from "../../../src/server/services/qrcodeService";

describe("qrcode service", () => {
  it("keeps QR payload text unchanged for fake service tests", async () => {
    const service = createFakeQRCodeService("<svg data-test=\"qr\"></svg>");
    expect(service.createQrPayload("http://127.0.0.1:5173/player")).toBe("http://127.0.0.1:5173/player");
    await expect(service.createQrImage("x")).resolves.toContain("svg");
  });
});
