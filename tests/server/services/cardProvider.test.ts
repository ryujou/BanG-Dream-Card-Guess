import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createMemoryCardCache } from "../../../src/server/services/cardCache";
import { createCardProvider } from "../../../src/server/services/cardProvider";
import { createFakeCropService } from "../../../src/server/services/cropService";
import { createFakeRandomService } from "../../../src/server/services/randomService";

async function makeProviderFiles() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bbc-card-provider-"));
  const cardsPath = path.join(dir, "cards.json");
  const nicknamesPath = path.join(dir, "nicknames.json");
  await writeFile(cardsPath, JSON.stringify({
    "1": { resourceSetName: "res001", characterId: 1, rarity: 4, attribute: "cool", stat: { training: true } },
  }));
  await writeFile(nicknamesPath, JSON.stringify({ "1": ["Kasumi", "Toyama Kasumi"] }));
  return { dir, cardsPath, nicknamesPath };
}

describe("card provider service", () => {
  it("creates a deterministic round with fake random and cached image", async () => {
    const files = await makeProviderFiles();
    try {
      const cardCache = createMemoryCardCache({ "res001_rip/card_normal.png": Buffer.from("cached-image") });
      const provider = createCardProvider({
        cardsPath: files.cardsPath,
        nicknamesPath: files.nicknamesPath,
        cardCache,
        cropService: createFakeCropService({ x: 0, y: 0, width: 100, height: 100, image: "crop" }),
        randomService: createFakeRandomService([0]),
        faceBoxStore: { images: {} },
      });

      const round = await provider.createRound({ cardVariants: ["normal"], cardCharacterLimits: ["single", "multiple"], cropSize: 100 });
      expect(round.cardId).toBe("1");
      expect(round.imageUrl).toBe("/cards/res001_rip/card_normal.png");
      expect(round.crop).toMatchObject({ x: 0, y: 0 });
      expect(round.sourceBuffer.toString()).toBe("cached-image");
    } finally {
      await rm(files.dir, { recursive: true, force: true });
    }
  });

  it("download failures are surfaced without crashing the provider", async () => {
    const files = await makeProviderFiles();
    try {
      const provider = createCardProvider({
        cardsPath: files.cardsPath,
        nicknamesPath: files.nicknamesPath,
        cardCache: createMemoryCardCache(),
        cropService: createFakeCropService(),
        randomService: createFakeRandomService([0]),
        faceBoxStore: { images: {} },
        fetchImpl: async () => new Response("missing", { status: 404, headers: { "content-type": "text/plain" } }),
      });

      const card = provider.getRandomCard({ cardVariants: ["normal"], cardCharacterLimits: ["single", "multiple"] });
      await expect(provider.resolveCardImage(card, { cardVariants: ["normal"], cardCharacterLimits: ["single", "multiple"] })).rejects.toThrow();
    } finally {
      await rm(files.dir, { recursive: true, force: true });
    }
  });
});
