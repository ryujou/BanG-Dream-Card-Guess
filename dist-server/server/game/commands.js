export const HOST_COMMANDS = [
    "start",
    "next",
    "recrop",
    "correct",
    "wrong",
    "skip",
    "undo",
    "stop",
    "reveal",
    "selfGuess",
    "hideAnswer",
    "reset",
    "settings",
    "importSettings",
];
export function validateCommandPayload(command, payload = {}) {
    if (command === "selfGuess")
        return { guess: payload?.guess };
    return payload || {};
}
export function isSoloAllowedCommand(command) {
    return ["start", "next", "recrop", "reveal", "stop", "reset", "selfGuess"].includes(command);
}
export function isPlayerAllowedCommand(command) {
    return command === "recrop";
}
