export function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function isString(value) {
    return typeof value === 'string';
}
export function isNumber(value) {
    return typeof value === 'number' && !isNaN(value);
}
export function isBoolean(value) {
    return typeof value === 'boolean';
}
export function parseJsonBody(body) {
    if (isString(body)) {
        try {
            return JSON.parse(body);
        }
        catch {
            return null;
        }
    }
    return body;
}
export function isClientMessage(msg) {
    return isRecord(msg) && isString(msg.type);
}
export function isHelloMessage(msg) {
    return isClientMessage(msg) && msg.type === 'hello' && isString(msg.role);
}
export function isCommandMessage(msg) {
    if (!isClientMessage(msg) || msg.type !== 'command' || !isString(msg.command)) {
        return false;
    }
    return true;
}
export function isSettingsPatch(payload) {
    return isRecord(payload);
}
export function isScoreEntry(payload) {
    return isRecord(payload) && isString(payload.mode) && isNumber(payload.score);
}
export function isGameCommand(command) {
    // Can be refined later based on GameCommand enum if available
    return isString(command);
}
//# sourceMappingURL=guards.js.map