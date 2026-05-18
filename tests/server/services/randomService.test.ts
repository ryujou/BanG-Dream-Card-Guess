import { describe, expect, it } from "vitest";
import { createFakeRandomService, createRandomService } from "../../../src/server/services/randomService";

describe("random service", () => {
  it("fake random makes picks reproducible", () => {
    const random = createFakeRandomService([0, 0.7]);
    expect(random.pickOne(["a", "b", "c"])).toBe("a");
    expect(random.pickOne(["a", "b", "c"])).toBe("c");
  });

  it("production random keeps valid integer bounds", () => {
    const random = createRandomService(() => 0.999);
    expect(random.randomInt(2, 4)).toBe(4);
    expect(random.pickOne([])).toBeUndefined();
  });
});
