import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { resolveHomeTheme } from "../lib/home-theme";
import { useCommunity } from "../features/community/useCommunity";
import { CommunityView } from "../features/community/CommunityView";

export function CommunityPage() {
  const { hash, search } = useLocation();
  const { data, error } = useCommunity();
  useEffect(() => {
    if (!data || !hash) return;
    const frame = requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [data, hash]);
  return <CommunityView data={data} error={error} themeId={resolveHomeTheme(search)} />;
}
