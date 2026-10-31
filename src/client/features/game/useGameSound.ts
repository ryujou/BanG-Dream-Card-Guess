import { useEffect, useRef } from "react";
import type { GameSnapshot } from "../../../shared/types";
import { gameSoundNotes } from "./game-rules";

export function useGameSound(snapshot: GameSnapshot | null) {
  const audio = useRef<AudioContext | null>(null);
  const previous = useRef<GameSnapshot | null>(null);
  useEffect(() => {
    function unlock() {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    }
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      void audio.current?.close();
      audio.current = null;
    };
  }, []);
  useEffect(() => {
    const before = previous.current;
    previous.current = snapshot;
    const context = audio.current;
    if (!snapshot || !before || context?.state !== "running") return;
    gameSoundNotes(before, snapshot).forEach((frequency, index) => {
      const start = context.currentTime + index * 0.11;
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.065, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.13);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.14);
    });
  }, [snapshot]);
}
