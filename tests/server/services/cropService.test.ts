import { describe, expect, it } from "vitest";
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
});
