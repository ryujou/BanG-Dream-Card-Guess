const SENSITIVE_KEY = /(password|cookie|csrf|token|secret|authorization)/i;
const MAX_RECENT_ERRORS = 20;
const recentErrors = [];
function sanitizeValue(value) {
    if (value instanceof Error) {
        return { name: value.name, message: value.message };
    }
    if (Array.isArray(value))
        return value.map(sanitizeValue);
    if (!value || typeof value !== "object")
        return value;
    const result = {};
    for (const [key, item] of Object.entries(value)) {
        result[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : sanitizeValue(item);
    }
    return result;
}
function normalizeMessage(message) {
    if (message instanceof Error)
        return message.message;
    return String(message || "");
}
function pushRecentError(entry) {
    recentErrors.push(entry);
    if (recentErrors.length > MAX_RECENT_ERRORS)
        recentErrors.splice(0, recentErrors.length - MAX_RECENT_ERRORS);
}
function write(level, message, context) {
    if (level === "debug" && process.env.DEBUG !== "1")
        return;
    const entry = {
        level,
        message: normalizeMessage(message),
        at: new Date().toISOString(),
        context: context ? sanitizeValue(context) : undefined,
    };
    if (level === "error")
        pushRecentError(entry);
    const output = `[${entry.at}] ${level.toUpperCase()} ${entry.message}`;
    const args = entry.context ? [output, entry.context] : [output];
    if (level === "error")
        console.error(...args);
    else if (level === "warn")
        console.warn(...args);
    else if (level === "info")
        console.info(...args);
    else
        console.debug(...args);
}
export const logger = {
    debug: (message, context) => write("debug", message, context),
    info: (message, context) => write("info", message, context),
    warn: (message, context) => write("warn", message, context),
    error: (message, context) => write("error", message, context),
    recentErrors: () => recentErrors.map((entry) => ({ ...entry, context: entry.context ? { ...entry.context } : undefined })),
    clearRecentErrors: () => { recentErrors.splice(0, recentErrors.length); },
};
