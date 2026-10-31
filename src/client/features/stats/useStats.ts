import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { Stats } from "./model";
import { colorMap } from "./worldMap";

export function useStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [map, setMap] = useState("");
  const [error, setError] = useState("");
  const [mapError, setMapError] = useState("");
  useEffect(() => {
    let active = true;
    api<Stats>("/api/stats")
      .then(async (data) => {
        if (!active) return;
        setStats(data);
        if (!data.configured) return;
        try {
          const response = await fetch("/maps/world.svg");
          if (!response.ok) throw new Error("地图暂时无法显示。");
          const source = await response.text();
          if (active) setMap(colorMap(source, data.countries));
        } catch (error) {
          if (active)
            setMapError(
              error instanceof Error ? error.message : "地图暂时无法显示。",
            );
        }
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error ? error.message : "统计数据加载失败。",
          );
      });
    return () => { active = false; };
  }, []);
  return { stats, map, error, mapError };
}
