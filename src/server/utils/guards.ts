export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function parseJsonBody(body: unknown): unknown {
  if (isString(body)) {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body;
}

export function isClientMessage(msg: unknown): msg is Record<string, unknown> & { type: string } {
  return isRecord(msg) && isString(msg.type);
}

export function isHelloMessage(msg: unknown): msg is { type: 'hello', role: string } {
  return isClientMessage(msg) && msg.type === 'hello' && isString(msg.role);
}

export function isCommandMessage(msg: unknown): msg is { type: 'command', command: string, payload?: unknown } {
  if (!isClientMessage(msg) || msg.type !== 'command' || !isString(msg.command)) {
    return false;
  }
  return true;
}

export function isSettingsPatch(payload: unknown): payload is Record<string, unknown> {
  return isRecord(payload);
}

export function isScoreEntry(payload: unknown): payload is { mode: string, score: number, [key: string]: unknown } {
  return isRecord(payload) && isString(payload.mode) && isNumber(payload.score);
}

export function isGameCommand(command: string): command is string {
  // Can be refined later based on GameCommand enum if available
  return isString(command);
}
