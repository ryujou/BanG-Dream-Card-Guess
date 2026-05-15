export function captureUndoState(game) {
    return {
        status: game.status,
        leftSeconds: game.leftSeconds,
        loading: game.loading,
        score: game.score,
        streak: game.streak,
        total: game.total,
        recrops: game.recrops,
        cropHistory: game.cropHistory.map((item) => ({ ...item })),
        recentCards: [...game.recentCards],
        recentCharacters: [...game.recentCharacters],
        current: game.current,
        history: game.history.map((item) => ({ ...item })),
        teams: { A: { ...game.teams.A }, B: { ...game.teams.B } },
        message: game.message,
    };
}
export function pushUndoState(game, limit = 8) {
    game.undoStack.unshift(captureUndoState(game));
    game.undoStack = game.undoStack.slice(0, limit);
    return game;
}
export function appendHistory(game, result, team, now, limit = 12) {
    if (!game.current)
        return game;
    game.history.unshift({ result, name: game.current.displayName, team, at: now });
    game.history = game.history.slice(0, limit);
    return game;
}
export function undoHistory(game, limit = 8) {
    const undo = game.undoStack.shift();
    if (!undo)
        return { restored: false, status: game.status };
    Object.assign(game, undo);
    game.undoStack = game.undoStack.slice(0, limit);
    return { restored: true, status: game.status };
}
//# sourceMappingURL=history.js.map