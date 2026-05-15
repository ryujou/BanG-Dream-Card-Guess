import { readFileSync } from "node:fs";
import { BAND_BY_CHARACTER, BESTDORI_BASE, effectiveFaceCropMode, readFaceBoxStore } from "../config.js";
import { faceBoxesFor } from "../crop.js";
import type { CardCache } from "./cardCache.js";
import type { CropService } from "./cropService.js";
import type { RandomService } from "./randomService.js";

export interface CardProvider {
  loadCards(): void;
  getRandomCard(settings: Record<string, any>, recentCards?: string[], recentCharacters?: number[]): any;
  resolveCardImage(card: any, settings: Record<string, any>): Promise<any>;
  createRound(settings: Record<string, any>, recentCards?: string[], recentCharacters?: number[]): Promise<any>;
  filteredCardPool(settings: Record<string, any>): any[];
  getCacheInfo(): { cachedSets: number; cachePercent: number };
  faceBoxStore: Record<string, any>;
  cardPool: any[];
}

export interface CardProviderOptions {
  cardsPath: string;
  nicknamesPath: string;
  cardCache: CardCache;
  cropService: CropService;
  randomService: RandomService;
  faceBoxStore?: Record<string, any>;
  fetchImpl?: typeof fetch;
}

export function createCardProvider(options: CardProviderOptions): CardProvider {
  const fetchImpl = options.fetchImpl || fetch;
  const faceBoxStore = options.faceBoxStore || readFaceBoxStore();
  let cards: Record<string, any> = {};
  let nicknames: Record<string, any[]> = {};
  let cardPool: any[] = [];

  const provider: CardProvider = {
    faceBoxStore,
    get cardPool() {
      return cardPool;
    },
    loadCards() {
      cards = JSON.parse(readFileSync(options.cardsPath, "utf-8"));
      nicknames = JSON.parse(readFileSync(options.nicknamesPath, "utf-8"));
      cardPool = Object.entries(cards)
        .map(([id, card]): any => ({ ...(card as Record<string, any>), id }))
        .filter((card) => card?.resourceSetName && nicknames[String(card.characterId)]?.length);
    },
    filteredCardPool(settings) {
      const bandSet = new Set(settings.cardBands || []);
      const raritySet = new Set((settings.cardRarities || []).map(Number));
      const attributeSet = new Set(settings.cardAttributes || []);
      const filtered = cardPool.filter((card) => {
        const band = BAND_BY_CHARACTER.get(Number(card.characterId));
        if (bandSet.size && !bandSet.has(band)) return false;
        if (raritySet.size && !raritySet.has(Number(card.rarity))) return false;
        if (attributeSet.size && !attributeSet.has(card.attribute)) return false;
        const allowedVariants = settings.cardVariants || ["normal", "trained"];
        if (allowedVariants.length === 1 && allowedVariants[0] === "trained" && !card.stat?.training) return false;

        const variants: string[] = [];
        if (allowedVariants.includes("normal")) variants.push("card_normal.png");
        if (allowedVariants.includes("trained") && card.stat?.training) variants.push("card_after_training.png");
        if (!variants.length) return false;

        const allowedLimits = settings.cardCharacterLimits || ["single", "multiple"];
        if (allowedLimits.length < 2) {
          let match = false;
          for (const file of variants) {
            const cacheRelativePath = `${card.resourceSetName}_rip/${file}`;
            const faces = faceBoxesFor(faceBoxStore, cacheRelativePath);
            const personCount = faces.filter((face: any) => face.label === "face").length;
            if (allowedLimits.includes("single") && personCount === 1) match = true;
            if (allowedLimits.includes("multiple") && personCount > 1) match = true;
          }
          if (!match) return false;
        }
        return true;
      });
      return filtered.length ? filtered : cardPool;
    },
    getRandomCard(settings, recentCards = [], recentCharacters = []) {
      const pool = provider.filteredCardPool(settings);
      const recentCardSet = new Set(recentCards.slice(0, settings.avoidRecentCards));
      const recentCharacterSet = new Set(recentCharacters.slice(0, settings.avoidRecentCharacters));
      const passes = [
        (card: any) => !recentCardSet.has(String(card.id)) && !recentCharacterSet.has(Number(card.characterId)),
        (card: any) => !recentCardSet.has(String(card.id)),
        () => true,
      ];
      for (const pass of passes) {
        const candidates = pool.filter(pass);
        if (candidates.length) return options.randomService.pickOne(candidates);
      }
      return options.randomService.pickOne(pool);
    },
    async resolveCardImage(card, settings) {
      const allowedVariants = settings.cardVariants || ["normal", "trained"];
      let variants: string[] = [];
      if (allowedVariants.includes("normal")) variants.push("card_normal.png");
      if (allowedVariants.includes("trained") && card.stat?.training) variants.push("card_after_training.png");

      const allowedLimits = settings.cardCharacterLimits || ["single", "multiple"];
      if (allowedLimits.length < 2) {
        variants = variants.filter((file) => {
          const cacheRelativePath = `${card.resourceSetName}_rip/${file}`;
          const faces = faceBoxesFor(faceBoxStore, cacheRelativePath);
          const personCount = faces.filter((face: any) => face.label === "face").length;
          if (allowedLimits.includes("single") && personCount === 1) return true;
          if (allowedLimits.includes("multiple") && personCount > 1) return true;
          return false;
        });
      }

      if (variants.length === 0) {
        variants = ["card_normal.png"];
        if (card.stat?.training) variants.push("card_after_training.png");
      }
      if (variants.length > 1 && options.randomService.random() > 0.5) {
        variants = [variants[1], variants[0]];
      }

      for (const file of variants) {
        const cacheRelativePath = `${card.resourceSetName}_rip/${file}`;
        const imageUrl = options.cardCache.imageUrl(cacheRelativePath);
        const cached = options.cardCache.readCache(cacheRelativePath);
        if (cached) {
          return {
            buffer: cached,
            imageUrl,
            cacheRelativePath: cacheRelativePath.replaceAll("\\", "/"),
            variant: file === "card_after_training.png" ? "trained" : "normal",
          };
        }

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000);
          let buffer: Buffer;
          try {
            const response = await fetchImpl(`${BESTDORI_BASE}/${card.resourceSetName}_rip/${file}`, { signal: controller.signal });
            const contentType = response.headers.get("content-type") || "";
            if (!response.ok || !contentType.includes("image")) continue;
            buffer = Buffer.from(await response.arrayBuffer());
          } finally {
            clearTimeout(timeoutId);
          }
          await options.cardCache.writeCache(cacheRelativePath, buffer);
          return {
            buffer,
            imageUrl,
            cacheRelativePath: cacheRelativePath.replaceAll("\\", "/"),
            variant: file === "card_after_training.png" ? "trained" : "normal",
          };
        } catch {
          continue;
        }
      }
      throw new Error("下载卡面失败");
    },
    async createRound(settings, recentCards = [], recentCharacters = []) {
      const card = provider.getRandomCard(settings, recentCards, recentCharacters);
      if (!card) throw new Error("题库为空");
      const names = nicknames[String(card.characterId)];
      const { buffer, imageUrl, variant, cacheRelativePath } = await provider.resolveCardImage(card, settings);
      const faceBoxes = faceBoxesFor(faceBoxStore, cacheRelativePath);
      const { image, crop } = await options.cropService.cropCard(buffer, settings, faceBoxes);
      return {
        cardId: card.id,
        characterId: card.characterId,
        displayName: names[7] || names[0],
        acceptedAnswers: names,
        imageUrl,
        variant,
        rarity: card.rarity,
        attribute: card.attribute,
        band: BAND_BY_CHARACTER.get(Number(card.characterId)) || "",
        faceBoxes,
        faceCropMode: effectiveFaceCropMode(settings),
        imageWidth: image.bitmap.width,
        imageHeight: image.bitmap.height,
        sourceBuffer: buffer,
        crop,
      };
    },
    getCacheInfo() {
      return options.cardCache.getCacheInfo(cardPool.length);
    },
  };

  provider.loadCards();
  return provider;
}

export function createFakeCardProvider(rounds: any[] = []): CardProvider {
  let index = 0;
  const faceBoxStore = { images: {} };
  return {
    faceBoxStore,
    cardPool: rounds,
    loadCards() {},
    getRandomCard() {
      return rounds[index % Math.max(1, rounds.length)];
    },
    async resolveCardImage() {
      return { buffer: Buffer.from("fake"), imageUrl: "/cards/fake.png", cacheRelativePath: "fake.png", variant: "normal" };
    },
    async createRound() {
      if (!rounds.length) throw new Error("题库为空");
      const round = rounds[index % rounds.length];
      index += 1;
      return round;
    },
    filteredCardPool() {
      return rounds;
    },
    getCacheInfo() {
      return { cachedSets: 0, cachePercent: 0 };
    },
  };
}
