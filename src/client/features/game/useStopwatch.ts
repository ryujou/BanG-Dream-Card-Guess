import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";

type StopwatchSettings = { targetSeconds: number; toleranceSeconds: number };
type TimerMode = "idle" | "holding" | "win" | "lose";
const defaultSettings: StopwatchSettings = {
  targetSeconds: 10,
  toleranceSeconds: 0.02,
};


export function stopwatchOutcome(seconds: number, settings: StopwatchSettings): "win" | "lose" {
  return seconds >= settings.targetSeconds - settings.toleranceSeconds && seconds <= settings.targetSeconds + settings.toleranceSeconds ? "win" : "lose";
}

export function useStopwatch() {
  const [settings, setSettings] = useState(defaultSettings);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<TimerMode>("idle");
  const [elapsed, setElapsed] = useState(0);
  const display = useRef<HTMLOutputElement>(null);
  const pad = useRef<HTMLButtonElement>(null);
  const round = useRef({ startedAt: 0, frame: 0, source: "" });

  useEffect(() => {
    let active = true;
    api<StopwatchSettings>("/api/stopwatch-settings")
      .then((value) => {
        if (active) setSettings(value);
      })
      .catch(() => {
        if (active)
          setNotice(
            "暂时无法读取活动设置，当前使用默认目标 10.00 秒、容差 ±0.02 秒。",
          );
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const start = useCallback(
    (source: string) => {
      if (!ready || round.current.source) return;
      round.current.startedAt = performance.now();
      round.current.source = source;
      setMode("holding");
      setElapsed(0);
      const tick = () => {
        if (display.current)
          display.current.textContent = (
            (performance.now() - round.current.startedAt) /
            1000
          ).toFixed(2);
        round.current.frame = requestAnimationFrame(tick);
      };
      tick();
    },
    [ready],
  );

  const stop = useCallback(
    (source?: string) => {
      if (!round.current.source || (source && source !== round.current.source))
        return;
      const seconds = (performance.now() - round.current.startedAt) / 1000;
      round.current.source = "";
      cancelAnimationFrame(round.current.frame);
      setElapsed(seconds);
      setMode(
        stopwatchOutcome(seconds, settings),
      );
      if (display.current) display.current.textContent = seconds.toFixed(2);
    },
    [settings],
  );

  const reset = useCallback(() => {
    round.current.source = "";
    cancelAnimationFrame(round.current.frame);
    setElapsed(0);
    setMode("idle");
    if (display.current) display.current.textContent = "0.00";
  }, []);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.code !== "Enter") return;
      const target = event.target as HTMLElement;
      if (
        target !== pad.current &&
        (target.closest("button,a,input,select,textarea") ||
          target.isContentEditable)
      )
        return;
      event.preventDefault();
      if (!event.repeat) start(`key:${event.code}`);
    };
    const keyup = (event: KeyboardEvent) => {
      if (event.code !== "Space" && event.code !== "Enter") return;
      if (round.current.source === `key:${event.code}`) event.preventDefault();
      stop(`key:${event.code}`);
    };
    const blur = () => stop();
    const visibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("keyup", keyup);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    return () => {
      cancelAnimationFrame(round.current.frame);
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("keyup", keyup);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
    };
  }, [start, stop]);

  const error = elapsed - settings.targetSeconds;
  const result =
    mode === "win"
      ? "精准命中。安可！"
      : mode === "lose"
        ? error < 0
          ? "快了一点，再来一次。"
          : "慢了一点，再来一次。"
        : mode === "holding"
          ? "跟随心里的节拍，松开时定格。"
          : "准备好了吗？相信你的节奏感。";

  return { settings, ready, notice, mode, display, pad, round, start, stop, reset, error, result };
}
