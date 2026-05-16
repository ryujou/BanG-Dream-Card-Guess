import { describe, expect, it } from "vitest";
import { faceBoxesFor } from "../../../src/server/crop";
import { createFakeCropService } from "../../../src/server/services/cropService";

describe("crop service", () => {
  it("fake crop returns the existing crop shape", async () => {
    const service = createFakeCropService({ x: 4, y: 5, width: 100, height: 100, image: "data" });
    const result = await service.cropCard(Buffer.from("image"), { cropSize: 100 }, []);
    expect(result.crop).toMatchObject({ x: 4, y: 5, width: 100, height: 100 });
    expect(service.validateCropResult(result.crop)).toBe(true);
  });

  it("recrop does not mutate the source round", async () => {
    const crop = { x: 1, y: 2, width: 100, height: 100, image: "data" };
    const service = createFakeCropService(crop);
    const current = { sourceBuffer: Buffer.from("image"), crop: { x: 9, y: 9 } };
    const next = await service.recropCard(current, { cropSize: 100 }, []);
    expect(next).toEqual(crop);
    expect(current.crop).toEqual({ x: 9, y: 9 });
  });

  it("normalizes invalid face boxes without changing fallback behavior", () => {
    const faces = faceBoxesFor({ images: { "card.png": { width: 100, height: 100, faces: [{ x: 1, y: 2, w: 10, h: 12, label: "face" }, { x: 0, y: 0, w: 0, h: 1 }] } } }, "card.png");
    expect(faces).toHaveLength(1);
    expect(faces[0]).toMatchObject({ x: 1, y: 2, w: 10, h: 12, label: "face" });
    expect(faceBoxesFor({ images: {} }, "missing.png")).toEqual([]);
  });
});
