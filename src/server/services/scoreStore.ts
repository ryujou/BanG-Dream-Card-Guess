import * as scores from "../scores.js";

export interface ScoreStore {
  readQueueScores(): unknown[];
  writeQueueScores(scores: unknown[]): Promise<void>;
  queueScoreState(scores?: unknown[]): unknown;
  handleQueueScoreEvents(req: unknown, res: unknown): void;
  broadcastQueueScores(state?: unknown): void;
  readNoteShooterScores(): unknown[];
  writeNoteShooterScores(scores: unknown[]): Promise<void>;
  noteShooterScoreState(scores?: unknown[]): unknown;
  handleNoteShooterScoreEvents(req: unknown, res: unknown): void;
  broadcastNoteShooterScores(state?: unknown): void;
  handleNoteShooterApi(url: URL, req: unknown, res: unknown): Promise<void>;
}

export function createScoreStore(): ScoreStore {
  return {
    readQueueScores: scores.readQueueScores,
    writeQueueScores: scores.writeQueueScores,
    queueScoreState: scores.queueScoreState,
    handleQueueScoreEvents: scores.handleQueueScoreEvents,
    broadcastQueueScores: scores.broadcastQueueScores,
    readNoteShooterScores: scores.readNoteShooterScores,
    writeNoteShooterScores: scores.writeNoteShooterScores,
    noteShooterScoreState: scores.noteShooterScoreState,
    handleNoteShooterScoreEvents: scores.handleNoteShooterScoreEvents,
    broadcastNoteShooterScores: scores.broadcastNoteShooterScores,
    handleNoteShooterApi: scores.handleNoteShooterApi,
  };
}

export function createMemoryScoreStore(): ScoreStore {
  let queueScores: unknown[] = [];
  let noteShooterScores: unknown[] = [];
  const queueListeners = new Set<(state: unknown) => void>();
  const noteShooterListeners = new Set<(state: unknown) => void>();

  const queueScoreState = (items = queueScores) => scores.queueScoreState(items);
  const noteShooterScoreState = (items = noteShooterScores) => scores.noteShooterScoreState(items);

  return {
    readQueueScores: () => queueScores.slice(),
    writeQueueScores: async (items) => { queueScores = items.slice(0, 1000); },
    queueScoreState,
    handleQueueScoreEvents: () => undefined,
    broadcastQueueScores: (state = queueScoreState()) => {
      for (const listener of queueListeners) listener(state);
    },
    readNoteShooterScores: () => noteShooterScores.slice(),
    writeNoteShooterScores: async (items) => { noteShooterScores = items.slice(); },
    noteShooterScoreState,
    handleNoteShooterScoreEvents: () => undefined,
    broadcastNoteShooterScores: (state = noteShooterScoreState()) => {
      for (const listener of noteShooterListeners) listener(state);
    },
    handleNoteShooterApi: async () => undefined,
  };
}
