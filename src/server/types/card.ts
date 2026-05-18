export interface RawBestdoriCard {
  resourceSetName?: unknown;
  characterId?: unknown;
  rarity?: unknown;
  attribute?: unknown;
  stat?: unknown;
}

export interface NormalizedCard {
  id: string;
  resourceSetName: string;
  characterId: number;
  rarity: number;
  attribute: string;
  stat?: {
    training?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface CardImageInfo {
  buffer: Buffer;
  imageUrl: string;
  cacheRelativePath: string;
  variant: "normal" | "trained";
}

export interface CardRound extends Record<string, unknown> {
  cardId: string;
  characterId: number;
  displayName: string;
  acceptedAnswers: string[];
  imageUrl: string;
  variant: "normal" | "trained";
  rarity: number;
  attribute: string;
  band: string;
  sourceBuffer: Buffer;
}

export function normalizeBestdoriCard(id: string, value: unknown, nicknames: Record<string, string[]>): NormalizedCard | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as RawBestdoriCard & Record<string, unknown>;
  const resourceSetName = String(raw.resourceSetName || "").trim();
  const characterId = Number(raw.characterId);
  if (!resourceSetName || !Number.isFinite(characterId) || !nicknames[String(characterId)]?.length) return null;
  const stat = raw.stat && typeof raw.stat === "object" && !Array.isArray(raw.stat)
    ? raw.stat as NormalizedCard["stat"]
    : undefined;
  return {
    ...raw,
    id,
    resourceSetName,
    characterId,
    rarity: Number(raw.rarity) || 0,
    attribute: String(raw.attribute || ""),
    stat,
  };
}
