export function normalizeBestdoriCard(id, value, nicknames) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return null;
    const raw = value;
    const resourceSetName = String(raw.resourceSetName || "").trim();
    const characterId = Number(raw.characterId);
    if (!resourceSetName || !Number.isFinite(characterId) || !nicknames[String(characterId)]?.length)
        return null;
    const stat = raw.stat && typeof raw.stat === "object" && !Array.isArray(raw.stat)
        ? raw.stat
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
//# sourceMappingURL=card.js.map