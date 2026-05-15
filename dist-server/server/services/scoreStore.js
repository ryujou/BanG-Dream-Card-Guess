import * as scores from "../scores.js";
export function createScoreStore() {
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
export function createMemoryScoreStore() {
    let queueScores = [];
    let noteShooterScores = [];
    const queueListeners = new Set();
    const noteShooterListeners = new Set();
    const queueScoreState = (items = queueScores) => scores.queueScoreState(items);
    const noteShooterScoreState = (items = noteShooterScores) => scores.noteShooterScoreState(items);
    return {
        readQueueScores: () => queueScores.slice(),
        writeQueueScores: async (items) => { queueScores = items.slice(0, 1000); },
        queueScoreState,
        handleQueueScoreEvents: () => undefined,
        broadcastQueueScores: (state = queueScoreState()) => {
            for (const listener of queueListeners)
                listener(state);
        },
        readNoteShooterScores: () => noteShooterScores.slice(),
        writeNoteShooterScores: async (items) => { noteShooterScores = items.slice(); },
        noteShooterScoreState,
        handleNoteShooterScoreEvents: () => undefined,
        broadcastNoteShooterScores: (state = noteShooterScoreState()) => {
            for (const listener of noteShooterListeners)
                listener(state);
        },
        handleNoteShooterApi: async () => undefined,
    };
}
//# sourceMappingURL=scoreStore.js.map