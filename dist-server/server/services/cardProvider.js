import { readFileSync } from "node:fs";
import { BAND_BY_CHARACTER, BESTDORI_BASE, effectiveFaceCropMode, readFaceBoxStore } from "../config.js";
import { faceBoxesFor } from "../crop.js";
import { normalizeBestdoriCard } from "../types/card.js";
export function createCardProvider(options) {
    const fetchImpl = options.fetchImpl || fetch;
    const faceBoxStore = options.faceBoxStore || readFaceBoxStore();
    let cards = {};
    let nicknames = {};
    let cardPool = [];
    const provider = {
        faceBoxStore,
        get cardPool() {
            return cardPool;
        },
        loadCards() {
            cards = JSON.parse(readFileSync(options.cardsPath, "utf-8"));
            nicknames = normalizeNicknames(JSON.parse(readFileSync(options.nicknamesPath, "utf-8")));
            cardPool = Object.entries(cards)
                .map(([id, card]) => normalizeBestdoriCard(id, card, nicknames))
                .filter((card) => card !== null);
        },
        filteredCardPool(settings) {
            const bandSet = new Set(settings.cardBands || []);
            const raritySet = new Set((settings.cardRarities || []).map(Number));
            const attributeSet = new Set(settings.cardAttributes || []);
            const filtered = cardPool.filter((card) => {
                const band = BAND_BY_CHARACTER.get(Number(card.characterId));
                if (bandSet.size && !bandSet.has(band))
                    return false;
                if (raritySet.size && !raritySet.has(Number(card.rarity)))
                    return false;
                if (attributeSet.size && !attributeSet.has(card.attribute))
                    return false;
                const allowedVariants = stringArray(settings.cardVariants, ["normal", "trained"]);
                if (allowedVariants.length === 1 && allowedVariants[0] === "trained" && !card.stat?.training)
                    return false;
                const variants = [];
                if (allowedVariants.includes("normal"))
                    variants.push("card_normal.png");
                if (allowedVariants.includes("trained") && card.stat?.training)
                    variants.push("card_after_training.png");
                if (!variants.length)
                    return false;
                const allowedLimits = stringArray(settings.cardCharacterLimits, ["single", "multiple"]);
                if (allowedLimits.length < 2) {
                    let match = false;
                    for (const file of variants) {
                        const cacheRelativePath = `${card.resourceSetName}_rip/${file}`;
                        const faces = faceBoxesFor(faceBoxStore, cacheRelativePath);
                        const personCount = faces.filter((face) => face.label === "face").length;
                        if (allowedLimits.includes("single") && personCount === 1)
                            match = true;
                        if (allowedLimits.includes("multiple") && personCount > 1)
                            match = true;
                    }
                    if (!match)
                        return false;
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
                (card) => !recentCardSet.has(String(card.id)) && !recentCharacterSet.has(Number(card.characterId)),
                (card) => !recentCardSet.has(String(card.id)),
                () => true,
            ];
            for (const pass of passes) {
                const candidates = pool.filter(pass);
                if (candidates.length)
                    return options.randomService.pickOne(candidates);
            }
            return options.randomService.pickOne(pool);
        },
        async resolveCardImage(card, settings) {
            const allowedVariants = stringArray(settings.cardVariants, ["normal", "trained"]);
            let variants = [];
            if (allowedVariants.includes("normal"))
                variants.push("card_normal.png");
            if (allowedVariants.includes("trained") && card.stat?.training)
                variants.push("card_after_training.png");
            const allowedLimits = stringArray(settings.cardCharacterLimits, ["single", "multiple"]);
            if (allowedLimits.length < 2) {
                variants = variants.filter((file) => {
                    const cacheRelativePath = `${card.resourceSetName}_rip/${file}`;
                    const faces = faceBoxesFor(faceBoxStore, cacheRelativePath);
                    const personCount = faces.filter((face) => face.label === "face").length;
                    if (allowedLimits.includes("single") && personCount === 1)
                        return true;
                    if (allowedLimits.includes("multiple") && personCount > 1)
                        return true;
                    return false;
                });
            }
            if (variants.length === 0) {
                variants = ["card_normal.png"];
                if (card.stat?.training)
                    variants.push("card_after_training.png");
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
                    let buffer;
                    try {
                        const response = await fetchImpl(`${BESTDORI_BASE}/${card.resourceSetName}_rip/${file}`, { signal: controller.signal });
                        const contentType = response.headers.get("content-type") || "";
                        if (!response.ok || !contentType.includes("image"))
                            continue;
                        buffer = Buffer.from(await response.arrayBuffer());
                    }
                    finally {
                        clearTimeout(timeoutId);
                    }
                    await options.cardCache.writeCache(cacheRelativePath, buffer);
                    return {
                        buffer,
                        imageUrl,
                        cacheRelativePath: cacheRelativePath.replaceAll("\\", "/"),
                        variant: file === "card_after_training.png" ? "trained" : "normal",
                    };
                }
                catch {
                    continue;
                }
            }
            throw new Error("下载卡面失败");
        },
        async createRound(settings, recentCards = [], recentCharacters = []) {
            const card = provider.getRandomCard(settings, recentCards, recentCharacters);
            if (!card)
                throw new Error("题库为空");
            const names = nicknames[String(card.characterId)];
            const { buffer, imageUrl, variant, cacheRelativePath } = await provider.resolveCardImage(card, settings);
            const faceBoxes = faceBoxesFor(faceBoxStore, cacheRelativePath);
            const { image, crop } = await options.cropService.cropCard(buffer, settings, faceBoxes);
            const bitmap = image.bitmap;
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
export function createFakeCardProvider(rounds = []) {
    let index = 0;
    const faceBoxStore = { images: {} };
    const pool = rounds;
    return {
        faceBoxStore,
        cardPool: pool,
        loadCards() { },
        getRandomCard() {
            return pool[index % Math.max(1, pool.length)];
        },
        async resolveCardImage() {
            return { buffer: Buffer.from("fake"), imageUrl: "/cards/fake.png", cacheRelativePath: "fake.png", variant: "normal" };
        },
        async createRound() {
            if (!rounds.length)
                throw new Error("题库为空");
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
function normalizeNicknames(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return {};
    const result = {};
    for (const [key, item] of Object.entries(value)) {
        if (Array.isArray(item))
            result[key] = item.map((name) => String(name));
    }
    return result;
}
function stringArray(value, fallback) {
    return Array.isArray(value) ? value.map(String) : fallback;
}
//# sourceMappingURL=cardProvider.js.map