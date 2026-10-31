import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type Block = { id: string; type: string; x: number; y: number };
type Move = { id: string; dx: number; dy: number };
const dimensions: Record<string, [number, number]> = {
  "2x2": [2, 2],
  "1x2": [1, 2],
  "2x1": [2, 1],
  "1x1": [1, 1],
};
const initial: Block[] = [
  { id: "michelle", type: "2x2", x: 1, y: 0 },
  { id: "nyamu", type: "1x2", x: 0, y: 0 },
  { id: "moca", type: "1x2", x: 3, y: 0 },
  { id: "arisa", type: "1x2", x: 0, y: 2 },
  { id: "yukina", type: "2x1", x: 1, y: 2 },
  { id: "eve", type: "1x2", x: 3, y: 2 },
  { id: "saya", type: "1x1", x: 1, y: 3 },
  { id: "box", type: "1x1", x: 2, y: 3 },
  { id: "otae", type: "1x1", x: 0, y: 4 },
  { id: "tsukushi", type: "1x1", x: 3, y: 4 },
];

describe("华容道原始求解器", () => {
  it("从初始局面产生完整且每一步都合法的通关路径", () => {
    let result: { success: boolean; moves: Move[] } | undefined;
    const self = {
      onmessage: (_event: { data: Block[] }) => {},
      postMessage: (value: typeof result) => {
        result = value;
      },
    };
    runInNewContext(
      readFileSync(
        new URL(
          "../../public/games/bang-klotski/solver-worker.js",
          import.meta.url,
        ),
        "utf8",
      ),
      { self },
    );
    self.onmessage({ data: initial });
    expect(result?.success).toBe(true);
    expect(result!.moves.length).toBeGreaterThan(0);
    const blocks = initial.map((block) => ({ ...block }));
    for (const move of result!.moves) {
      expect(Math.abs(move.dx) + Math.abs(move.dy)).toBe(1);
      const moving = blocks.find((block) => block.id === move.id)!;
      moving.x += move.dx;
      moving.y += move.dy;
      const cells = new Set<string>();
      for (const block of blocks) {
        const [width, height] = dimensions[block.type];
        expect(block.x).toBeGreaterThanOrEqual(0);
        expect(block.y).toBeGreaterThanOrEqual(0);
        expect(block.x + width).toBeLessThanOrEqual(4);
        expect(block.y + height).toBeLessThanOrEqual(5);
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++) {
            const cell = `${block.x + x}:${block.y + y}`;
            expect(cells.has(cell)).toBe(false);
            cells.add(cell);
          }
      }
    }
    expect(blocks.find((block) => block.id === "michelle")).toMatchObject({
      x: 1,
      y: 3,
    });
  });
});
