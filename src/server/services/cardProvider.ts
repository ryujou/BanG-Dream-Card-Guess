import { readFileSync } from "node:fs";
import { BAND_BY_CHARACTER, BESTDORI_BASE, effectiveFaceCropMode, readFaceBoxStore } from "../config.js";
import { faceBoxesFor } from "../crop.js";
import type { CardImageInfo, CardRound, NormalizedCard } from "../types/card.js";
import { normalizeBestdoriCard } from "../types/card.js";
import type { JimpLikeImage } from "../types/crop.js";
import type { CardCache } from "./cardCache.js";
import type { CropService } from "./cropService.js";
import type { RandomService } from "./randomService.js";

export interface CardProvider {
  loadCards(): void;
  getRandomCard(settings: Record<string, unknown>, recentCards?: string[], recentCharacters?: number[]): NormalizedCard | undefined;
  resolveCardImage(card: NormalizedCard, settings: Record<string, unknown>): Promise<CardImageInfo>;
  createRound(settings: Record<string, unknown>, recentCards?: string[], recentCharacters?: number[]): Promise<CardRound | null>;
  filteredCardPool(settings: Record<string, unknown>): NormalizedCard[];
  getCacheInfo(): { cachedSets: number; cachePercent: number };
  faceBoxStore: Record<string, unknown>;
  cardPool: NormalizedCard[];
}

export interface CardProviderOptions {
  cardsPath: string;
  nicknamesPath: string;
  cardCache: CardCache;
  cropService: CropService;
  randomService: RandomService;
  faceBoxStore?: Record<string, unknown>;
  fetchImpl?: typeof fetch;
}

export function createCardProvider(options: CardProviderOptions): CardProvider {
  const fetchImpl = options.fetchImpl || fetch;
  const faceBoxStore = options.faceBoxStore || readFaceBoxStore();
  let cards: Record<string, unknown> = {};
  let nicknames: Record<string, string[]> = {};
  let cardPool: NormalizedCard[] = [];

  const provider: CardProvider = {
    faceBoxStore,
    get cardPool() {
      return cardPool;
    },
    loadCards() {
      cards = JSON.parse(readFileSync(options.cardsPath, "utf-8"));
      nicknames = normalizeNicknames(JSON.parse(readFileSync(options.nicknamesPath, "utf-8")));
      cardPool = Object.entries(cards)
        .map(([id, card]) => normalizeBestdoriCard(id, card, nicknames))
        .filter((card): card is NormalizedCard => card !== null);
    },
    filteredCardPool(settings: Record<string, unknown>): NormalizedCard[] {
      const bandSet = new Set((settings.cardBands as unknown[]) || []);
      const raritySet = new Set(((settings.cardRarities as number[]) || []).map(Number));
      const attributeSet = new Set((settings.cardAttributes as unknown[]) || []);
      const filtered = cardPool.filter((card) => {
        const band = BAND_BY_CHARACTER.get(Number(card.characterId));
        if (bandSet.size && !bandSet.has(band)) return false;
        if (raritySet.size && !raritySet.has(Number(card.rarity))) return false;
        if (attributeSet.size && !attributeSet.has(card.attribute)) return false;
        const allowedVariants = stringArray(settings.cardVariants, ["normal", "trained"]);
        if (allowedVariants.length === 1 && allowedVariants[0] === "trained" && !card.stat?.training) return false;

        const variants: string[] = [];
        if (allowedVariants.includes("normal")) variants.push("card_normal.png");
        if (allowedVariants.includes("trained") && card.stat?.training) variants.push("card_after_training.png");
        if (!variants.length) return false;

        const allowedLimits = stringArray(settings.cardCharacterLimits, ["single", "multiple"]);
        if (allowedLimits.length < 2) {
          let match = false;
          for (const file of variants) {
            const cacheRelativePath = `${card.resourceSetName}_rip/${file}`;
            const faces = faceBoxesFor(faceBoxStore, cacheRelativePath);
            const personCount = faces.filter((face) => face.label === "face").length;
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
      const pool = provider.filteredCardPool(settings as Record<string, unknown>);
      const recentCardSet = new Set(recentCards.slice(0, (settings.avoidRecentCards as number)));
      const recentCharacterSet = new Set(recentCharacters.slice(0, (settings.avoidRecentCharacters as number)));
      const passes = [
        (card: NormalizedCard) => !recentCardSet.has(String(card.id)) && !recentCharacterSet.has(Number(card.characterId)),
        (card: NormalizedCard) => !recentCardSet.has(String(card.id)),
        () => true,
      ];
      for (const pass of passes) {
        const candidates = pool.filter(pass);
        if (candidates.length) return options.randomService.pickOne(candidates);
      }
      return options.randomService.pickOne(pool);
    },
    async resolveCardImage(card: NormalizedCard, settings: Record<string, unknown>) {
      const allowedVariants = stringArray(settings.cardVariants, ["normal", "trained"]);
      let variants: string[] = [];
      if (allowedVariants.includes("normal")) variants.push("card_normal.png");
      if (allowedVariants.includes("trained") && card.stat?.training) variants.push("card_after_training.png");

      const allowedLimits = stringArray(settings.cardCharacterLimits, ["single", "multiple"]);
      if (allowedLimits.length < 2) {
        variants = variants.filter((file) => {
          const cacheRelativePath = `${card.resourceSetName}_rip/${file}`;
          const faces = faceBoxesFor(faceBoxStore, cacheRelativePath);
          const personCount = faces.filter((face) => face.label === "face").length;
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
    async createRound(settings, recentCards = [], recentCharacters = []): Promise<CardRound | null> {
      const card = provider.getRandomCard(settings, recentCards, recentCharacters);
      if (!card) throw new Error("题库为空");
      const names = nicknames[String(card.characterId)];
      const { buffer, imageUrl, variant, cacheRelativePath } = await provider.resolveCardImage(card, settings);
      const faceBoxes = faceBoxesFor(faceBoxStore, cacheRelativePath);
      const { image, crop } = await options.cropService.cropCard(buffer, settings, faceBoxes);
      const bitmap = (image as JimpLikeImage).bitmap;
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
        imageWidth: bitmap.width,
        imageHeight: bitmap.height,
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

export function createFakeCardProvider(rounds: CardRound[] = []): CardProvider {
  let index = 0;
  const faceBoxStore = { images: {} };
  const pool = rounds as unknown as NormalizedCard[];
  return {
    faceBoxStore,
    cardPool: pool,
    loadCards() {},
    getRandomCard() {
      return pool[index % Math.max(1, pool.length)];
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
      return pool;
    },
    getCacheInfo() {
      return { cachedSets: 0, cachePercent: 0 };
    },
  };
}

function normalizeNicknames(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string[]> = {};
  for (const [key, item] of Object.entries(value)) {
    if (Array.isArray(item)) result[key] = item.map((name) => String(name));
  }
  return result;
}

function stringArray(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value) ? value.map(String) : fallback;
}
