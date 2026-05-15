import { describe, expect, it, vi } from "vitest";
import { createFakeTimerService, createTimerService } from "../../../src/server/services/timerService";

describe("timer service", () => {
  it("fake timer ticks down and stops on timeout", () => {
    const timer = createFakeTimerService();
    const ticks: number[] = [];
    let timedOut = false;

    timer.startRoundTimer(2, (left) => ticks.push(left), () => { timedOut = true; });
    timer.tick();
    timer.tick();
    timer.tick();

    expect(ticks).toEqual([1]);
    expect(timedOut).toBe(true);
  });

  it("starting a new round timer clears the old one", () => {
    const timer = createFakeTimerService();
    let first = 0;
    let second = 0;

    timer.startRoundTimer(3, () => { first += 1; }, () => undefined);
    timer.startRoundTimer(3, () => { second += 1; }, () => undefined);
    timer.tick();

    expect(first).toBe(0);
    expect(second).toBe(1);
    expect(timer.roundTimerCount()).toBe(2);
  });

  it("production auto-next timer can be stopped", () => {
    vi.useFakeTimers();
    const timer = createTimerService();
    const callback = vi.fn();
    timer.startAutoNextTimer(1000, callback);
    timer.stopAutoNextTimer();
    vi.advanceTimersByTime(1000);
    expect(callback).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
