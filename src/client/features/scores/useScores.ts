import { useEffect, useState } from "react";
import type { ScoreState } from "../../../shared/types";
import { api } from "../../lib/api";

export function useScores() {
  const [state, setState] = useState<ScoreState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let receivedSnapshot = false;
    api<ScoreState>("/api/scores")
      .then(value => { if (active && !receivedSnapshot) setState(value); })
      .catch(error => {
        if (active && !receivedSnapshot)
          setError(error instanceof Error ? error.message : "成绩加载失败。");
      });
    const stream = new EventSource("/api/scores/events");
    stream.onopen = () => { if (active) setConnected(true); };
    stream.onerror = () => { if (active) setConnected(false); };
    const receive = (event: MessageEvent) => {
      if (!active) return;
      try {
        const value = JSON.parse(event.data) as ScoreState;
        receivedSnapshot = true;
        setState(value);
        setError("");
      } catch {
        setError("收到的成绩数据无法读取，请刷新页面。");
      }
    };
    stream.addEventListener("scores", receive);
    stream.onmessage = receive;
    return () => {
      active = false;
      stream.removeEventListener("scores", receive);
      stream.onopen = stream.onerror = stream.onmessage = null;
      stream.close();
    };
  }, []);
  return { state, setState, connected, error, setError };
}
