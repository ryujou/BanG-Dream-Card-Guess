import type { HomeThemeId } from "../lib/home-theme";

const images = {
  bangdream: { cards: "/brand/bangdream-games/cards.webp", music: "/brand/bangdream-games/shooter.webp", timer: "/brand/bangdream-games/stopwatch.webp", blocks: "/brand/bangdream-games/klotski.webp" },
  sekai: { cards: "/brand/sekai-games/cards.webp", music: "/brand/sekai-games/shooter.webp", timer: "/brand/sekai-games/stopwatch.webp", blocks: "/brand/sekai-games/klotski-memes.webp" },
  bluearchive: { cards: "/cards/bluearchive/10010_rip/memorial.jpg", music: "/brand/bluearchive/shooter-art.webp", timer: "/brand/bluearchive/stopwatch-art.webp", blocks: "/brand/bluearchive/klotski-art.webp" },
} as const;

export function HomeGameArt({ kind, themeId = "bangdream", className }: {
  kind: "cards" | "music" | "timer" | "blocks" | "mooncake";
  themeId?: HomeThemeId;
  className?: string;
}) {
  return <img src={kind === "mooncake" ? "/games/ba-mooncake/preview.webp" : images[themeId][kind]} className={className} alt="" aria-hidden="true" loading="lazy" />;
}
