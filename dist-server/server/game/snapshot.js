export function createPublicSnapshot(input) {
    const { appMode, role, game, settings, meta, health } = input;
    const current = createPublicCurrent(game, role);
    return {
        appMode,
        settings,
        meta,
        health,
        game: {
            ...game,
            current,
            cropHistory: undefined,
            recentCards: undefined,
            recentCharacters: undefined,
            undoStack: undefined,
            canUndo: game.undoStack.length > 0,
            loading: game.loading,
        },
    };
}
export function createRoleSnapshot(input) {
    return createPublicSnapshot(input);
}
export function createPublicCurrent(game, role) {
    if (!game.current)
        return null;
    return {
        displayName: ["player", "self"].includes(role) && game.status === "playing" ? "" : game.current.displayName,
        acceptedAnswers: role === "host" ? game.current.acceptedAnswers : [],
        imageUrl: game.current.imageUrl,
        imageWidth: game.current.imageWidth,
        imageHeight: game.current.imageHeight,
        crop: game.current.crop,
    };
}
