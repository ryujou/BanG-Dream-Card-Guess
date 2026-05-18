export function createInitialTeams(teamNames) {
    return {
        A: { name: teamNames.A, score: 0 },
        B: { name: teamNames.B, score: 0 },
    };
}
export function createInitialGameState(settings, teamNames) {
    return {
        status: "idle",
        leftSeconds: Number(settings.roundSeconds) || 60,
        loading: false,
        score: 0,
        streak: 0,
        total: 0,
        recrops: 0,
        cropHistory: [],
        recentCards: [],
        recentCharacters: [],
        undoStack: [],
        current: null,
        history: [],
        teams: createInitialTeams(teamNames),
        roundKey: "",
    };
}
export function createInitialAppState(settings, teamNames) {
    return {
        game: createInitialGameState(settings, teamNames),
        settings,
    };
}
export function resetGameState(game, settings, teamNames, message) {
    Object.assign(game, {
        status: "idle",
        leftSeconds: Number(settings.roundSeconds) || 60,
        loading: false,
        score: 0,
        streak: 0,
        total: 0,
        current: null,
        history: [],
        undoStack: [],
        recrops: 0,
        cropHistory: [],
        recentCards: [],
        recentCharacters: [],
        teams: createInitialTeams(teamNames),
        message,
    });
    return game;
}
export function markRoundLoading(game, settings, message) {
    Object.assign(game, {
        status: "loading",
        loading: true,
        leftSeconds: Number(settings.roundSeconds) || 60,
        recrops: 0,
        cropHistory: [],
        current: null,
        message,
    });
    return game;
}
export function markRoundLoadFailed(game, message) {
    Object.assign(game, {
        status: "idle",
        loading: false,
        message,
    });
    return game;
}
export function markRoundPlaying(game, settings, round, message) {
    Object.assign(game, {
        current: round,
        status: "playing",
        loading: false,
        leftSeconds: Number(settings.roundSeconds) || 60,
        message,
    });
    return game;
}
export function stopGameState(game, message) {
    Object.assign(game, {
        status: "stopped",
        message,
        current: null,
    });
    return game;
}
//# sourceMappingURL=state.js.map