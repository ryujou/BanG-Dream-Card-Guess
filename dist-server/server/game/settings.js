export const defaultSettings = {
    mode: "single",
    difficulty: "normal",
    faceCropMode: "auto",
    cardCharacterLimits: ["single", "multiple"],
    cardVariants: ["normal", "trained"],
    roundSeconds: 60,
    questionsPerPlayer: 3,
    allowRecrop: true,
    showPlayerRecrop: true,
    soundEnabled: true,
    maxRecrops: 3,
    cropSize: 180,
    candidateCount: 120,
    avoidRecentCards: 20,
    avoidRecentCharacters: 8,
    cardBands: ["poppin-party", "afterglow", "hello-happy-world", "pastel-palettes", "roselia", "morfonica", "raise-a-suilen", "mygo"],
    cardRarities: [1, 2, 3, 4, 5],
    cardAttributes: ["cool", "happy", "powerful", "pure"],
    correctPoints: 1,
    wrongPenalty: 0,
    streakBonus: false,
    showTimer: true,
    revealAfterJudge: true,
    autoNext: false,
    autoNextDelay: 1800,
    currentTeam: "A",
    stopwatchTargetSeconds: 10,
    stopwatchToleranceSeconds: 0.02,
};
export function mergeSettings(base, persisted = {}) {
    return { ...base, ...(persisted || {}) };
}
export function sanitizeSettings(current, next = {}, deps) {
    const prevDifficulty = current.difficulty;
    const prevMode = current.mode;
    if (next.mode !== undefined)
        current.mode = ["single", "versus"].includes(next.mode) ? next.mode : current.mode;
    if (next.difficulty !== undefined)
        current.difficulty = ["easy", "normal", "hard"].includes(next.difficulty) ? next.difficulty : current.difficulty;
    if (next.faceCropMode !== undefined)
        current.faceCropMode = deps.faceCropModes.includes(next.faceCropMode) ? next.faceCropMode : current.faceCropMode;
    if (next.roundSeconds !== undefined)
        current.roundSeconds = Math.max(5, Math.min(600, Number(next.roundSeconds) || Number(current.roundSeconds) || 60));
    if (next.questionsPerPlayer !== undefined)
        current.questionsPerPlayer = Math.max(1, Math.min(50, Number(next.questionsPerPlayer) || Number(current.questionsPerPlayer) || 3));
    if (next.cropSize !== undefined)
        current.cropSize = Math.max(60, Math.min(260, Number(next.cropSize) || Number(current.cropSize) || 180));
    if (next.candidateCount !== undefined)
        current.candidateCount = Math.max(10, Math.min(500, Number(next.candidateCount) || Number(current.candidateCount) || 120));
    if (next.maxRecrops !== undefined)
        current.maxRecrops = Math.max(0, Math.min(10, Number(next.maxRecrops) || 0));
    if (next.correctPoints !== undefined)
        current.correctPoints = Math.max(0, Number(next.correctPoints) || 0);
    if (next.wrongPenalty !== undefined)
        current.wrongPenalty = Math.max(0, Number(next.wrongPenalty) || 0);
    if (next.autoNextDelay !== undefined)
        current.autoNextDelay = Math.max(500, Math.min(30000, Number(next.autoNextDelay) || 1800));
    if (next.stopwatchTargetSeconds !== undefined) {
        const target = Number(next.stopwatchTargetSeconds);
        if (Number.isFinite(target))
            current.stopwatchTargetSeconds = Math.max(1, Math.min(99.99, target));
    }
    if (next.stopwatchToleranceSeconds !== undefined) {
        const tolerance = Number(next.stopwatchToleranceSeconds);
        if (Number.isFinite(tolerance))
            current.stopwatchToleranceSeconds = Math.max(0.01, Math.min(99.99, tolerance));
    }
    if (Number(current.stopwatchToleranceSeconds) > Number(current.stopwatchTargetSeconds)) {
        current.stopwatchToleranceSeconds = current.stopwatchTargetSeconds;
    }
    for (const key of ["allowRecrop", "showPlayerRecrop", "soundEnabled", "streakBonus", "showTimer", "revealAfterJudge", "autoNext"]) {
        if (next[key] !== undefined)
            current[key] = !!next[key];
    }
    if (next.cardBands !== undefined)
        current.cardBands = deps.arraySetting(next.cardBands, deps.defaultSettings.cardBands, deps.bandIds);
    if (next.cardRarities !== undefined)
        current.cardRarities = deps.numberArraySetting(next.cardRarities, deps.defaultSettings.cardRarities, deps.rarities);
    if (next.cardAttributes !== undefined)
        current.cardAttributes = deps.arraySetting(next.cardAttributes, deps.defaultSettings.cardAttributes, deps.attributes);
    if (next.cardCharacterLimits !== undefined)
        current.cardCharacterLimits = deps.arraySetting(next.cardCharacterLimits, deps.defaultSettings.cardCharacterLimits, deps.cardCharacterLimits);
    if (next.cardVariants !== undefined)
        current.cardVariants = deps.arraySetting(next.cardVariants, deps.defaultSettings.cardVariants, deps.cardVariants);
    if (next.avoidRecentCards !== undefined)
        current.avoidRecentCards = Math.max(0, Math.min(200, Number(next.avoidRecentCards) || 0));
    if (next.avoidRecentCharacters !== undefined)
        current.avoidRecentCharacters = Math.max(0, Math.min(100, Number(next.avoidRecentCharacters) || 0));
    if (next.currentTeam !== undefined)
        current.currentTeam = ["A", "B"].includes(next.currentTeam) ? next.currentTeam : current.currentTeam;
    const difficultyChanged = prevDifficulty !== current.difficulty;
    const modeChanged = prevMode !== current.mode;
    if (difficultyChanged) {
        const preset = deps.difficultyPresets[current.difficulty];
        if (preset) {
            current.cropSize = preset.cropSize;
            current.candidateCount = preset.candidateCount;
        }
    }
    return { settings: current, difficultyChanged, modeChanged };
}
export function importSettings(current, next, deps) {
    return sanitizeSettings(current, next, deps);
}
export function exportSettings(settings, teams) {
    return { settings, teams };
}
//# sourceMappingURL=settings.js.map