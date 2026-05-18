export interface TimerHandle {
  stop(): void;
}

export interface TimerService {
  startRoundTimer(seconds: number, onTick: (leftSeconds: number) => void, onTimeout: () => void): TimerHandle;
  stopRoundTimer(): void;
  resetRoundTimer(): void;
  startAutoNextTimer(delayMs: number, callback: () => void): TimerHandle;
  stopAutoNextTimer(): void;
  setTimeout(callback: () => void, delayMs: number): TimerHandle;
}

export function createTimerService(): TimerService {
  let roundTimer: NodeJS.Timeout | null = null;
  let autoNextTimer: NodeJS.Timeout | null = null;

  const stopHandle = (handle: NodeJS.Timeout | null, clear: (handle: NodeJS.Timeout) => void) => {
    if (handle) clear(handle);
  };

  return {
    startRoundTimer(seconds, onTick, onTimeout) {
      this.stopRoundTimer();
      let leftSeconds = seconds;
      roundTimer = setInterval(() => {
        leftSeconds = Math.max(0, leftSeconds - 1);
        if (leftSeconds <= 0) onTimeout();
        else onTick(leftSeconds);
      }, 1000);
      return {
        stop: () => this.stopRoundTimer(),
      };
    },
    stopRoundTimer() {
      stopHandle(roundTimer, clearInterval);
      roundTimer = null;
    },
    resetRoundTimer() {
      this.stopRoundTimer();
    },
    startAutoNextTimer(delayMs, callback) {
      this.stopAutoNextTimer();
      autoNextTimer = setTimeout(() => {
        autoNextTimer = null;
        callback();
      }, delayMs);
      return {
        stop: () => this.stopAutoNextTimer(),
      };
    },
    stopAutoNextTimer() {
      stopHandle(autoNextTimer, clearTimeout);
      autoNextTimer = null;
    },
    setTimeout(callback, delayMs) {
      const handle = setTimeout(callback, delayMs);
      return {
        stop: () => clearTimeout(handle),
      };
    },
  };
}

export function createFakeTimerService(): TimerService & {
  tick(): void;
  flushAutoNext(): void;
  roundTimerCount(): number;
} {
  let round: { leftSeconds: number; onTick: (leftSeconds: number) => void; onTimeout: () => void } | null = null;
  let autoNext: (() => void) | null = null;
  let roundStarts = 0;

  return {
    startRoundTimer(seconds, onTick, onTimeout) {
      roundStarts += 1;
      round = { leftSeconds: seconds, onTick, onTimeout };
      return { stop: () => this.stopRoundTimer() };
    },
    stopRoundTimer() {
      round = null;
    },
    resetRoundTimer() {
      this.stopRoundTimer();
    },
    startAutoNextTimer(_delayMs, callback) {
      autoNext = callback;
      return { stop: () => this.stopAutoNextTimer() };
    },
    stopAutoNextTimer() {
      autoNext = null;
    },
    setTimeout(callback, _delayMs) {
      autoNext = callback;
      return { stop: () => { if (autoNext === callback) autoNext = null; } };
    },
    tick() {
      if (!round) return;
      round.leftSeconds = Math.max(0, round.leftSeconds - 1);
      if (round.leftSeconds <= 0) round.onTimeout();
      else round.onTick(round.leftSeconds);
    },
    flushAutoNext() {
      const callback = autoNext;
      autoNext = null;
      callback?.();
    },
    roundTimerCount() {
      return roundStarts;
    },
  };
}

