import { appendHistory, pushUndoState } from "./history.js";
export function calculateStreakBonus(game, settings) {
    return settings.streakBonus ? game.streak : 0;
}
export function updateTeamScore(game, team, points) {
    game.teams[team].score += points;
    return game;
}
export function applyCorrect(game, settings) {
    const points = Number(settings.correctPoints || 0) + calculateStreakBonus(game, settings);
    game.score += points;
    game.streak += 1;
    if (settings.mode === "versus" && (settings.currentTeam === "A" || settings.currentTeam === "B")) {
        updateTeamScore(game, settings.currentTeam, points);
    }
    return points;
}
export function applyWrong(game, settings) {
    game.score = Math.max(0, game.score - Number(settings.wrongPenalty || 0));
    game.streak = 0;
    return game;
}
export function applySkip(game, settings) {
    return applyWrong(game, settings);
}
export function applyTimeout(game, settings) {
    return applyWrong(game, settings);
}
export function applyRoundResult(game, settings, result, now, messages) {
    if (!game.current || game.status !== "playing")
        return game;
    pushUndoState(game);
    game.total += 1;
    game.status = settings.revealAfterJudge ? "revealed" : "finished";
    if (result === "correct") {
        applyCorrect(game, settings);
        game.message = messages.correct;
    }
    else {
        if (result === "skip")
            applySkip(game, settings);
        else if (result === "timeout")
            applyTimeout(game, settings);
        else
            applyWrong(game, settings);
        game.message = result === "wrong" ? messages.wrong : result === "timeout" ? messages.timeout : messages.skip;
    }
    appendHistory(game, result, String(settings.currentTeam || ""), now);
    return game;
}
//# sourceMappingURL=scoring.js.map