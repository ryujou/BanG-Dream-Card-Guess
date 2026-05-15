type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  at: string;
  context?: Record<string, unknown>;
}

const SENSITIVE_KEY = /(password|cookie|csrf|token|secret|authorization)/i;
const MAX_RECENT_ERRORS = 20;
const recentErrors: LogEntry[] = [];

function sanitizeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (!value || typeof value !== "object") return value;

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : sanitizeValue(item);
  }
  return result;
}

function normalizeMessage(message: unknown): string {
  if (message instanceof Error) return message.message;
  return String(message || "");
}

function pushRecentError(entry: LogEntry) {
  recentErrors.push(entry);
  if (recentErrors.length > MAX_RECENT_ERRORS) recentErrors.splice(0, recentErrors.length - MAX_RECENT_ERRORS);
}

function write(level: LogLevel, message: unknown, context?: Record<string, unknown>) {
  if (level === "debug" && process.env.DEBUG !== "1") return;
  const entry: LogEntry = {
    level,
    message: normalizeMessage(message),
    at: new Date().toISOString(),
    context: context ? sanitizeValue(context) as Record<string, unknown> : undefined,
  };
  if (level === "error") pushRecentError(entry);

  const output = `[${entry.at}] ${level.toUpperCase()} ${entry.message}`;
  const args = entry.context ? [output, entry.context] : [output];
  if (level === "error") console.error(...args);
  else if (level === "warn") console.warn(...args);
  else if (level === "info") console.info(...args);
  else console.debug(...args);
}

export const logger = {
  debug: (message: unknown, context?: Record<string, unknown>) => write("debug", message, context),
  info: (message: unknown, context?: Record<string, unknown>) => write("info", message, context),
  warn: (message: unknown, context?: Record<string, unknown>) => write("warn", message, context),
  error: (message: unknown, context?: Record<string, unknown>) => write("error", message, context),
  recentErrors: () => recentErrors.map((entry) => ({ ...entry, context: entry.context ? { ...entry.context } : undefined })),
  clearRecentErrors: () => { recentErrors.splice(0, recentErrors.length); },
};
