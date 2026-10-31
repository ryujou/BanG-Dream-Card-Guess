import type { CSSProperties } from "react";
import type { GameTheme } from "../../shared/types";
import heroCharacters from "../data/hero-characters.json";

export type HomeThemeId = GameTheme;
export type HeroCharacter = {
  src: string;
  alt: string;
  width: number;
  height: number;
  top: number;
  left: number;
};
export const HERO_CHARACTERS: Record<HomeThemeId, HeroCharacter[]> = heroCharacters;

export const HOME_THEMES = {
  bangdream: {
    label: "BanG Dream!",
    brand: "BanG Dream!",
    wordmark: "BANG DREAM!",
    communityUrl: "https://qm.qq.com/q/6ytGE7qIWQ",
    communityGroup: "",
    fans: "邦邦人",
    guessTitle: "邦邦猜卡",
    guessPreview: "/cards/res001023_rip/card_after_training.png",
    arcadeLabel: "XT BANG!",
    colors: {
      accent: "#9F191E", hover: "#851519", pressed: "#6B1114",
      soft: "#FCF5F5", tint: "#F8E8E9", border: "#EBC2C4",
      decor: "#D99B9F", art: "#C66D73", detail: "#B6474E",
    },
    character: HERO_CHARACTERS.bangdream[0],
    particles: ["#9F191E", "#ffbd39", "#D99B9F", "#ffffff"],
    cursor: { main: "/brand/cursor/kasumi.webp", mascot: "/brand/cursor/michelle.webp" },
  },
  sekai: {
    label: "世界计划",
    brand: "世界计划",
    wordmark: "PROJECT SEKAI",
    communityUrl: "https://qm.qq.com/q/EF4FxmYc6W",
    communityGroup: "1030720768",
    fans: "世界计划同好",
    guessTitle: "世界计划猜卡",
    guessPreview: "/brand/sekai-games/cards.webp",
    arcadeLabel: "XT SEKAI",
    colors: {
      accent: "#004190", hover: "#003576", pressed: "#00295C",
      soft: "#F3F7FC", tint: "#E6EEF8", border: "#C4D5EC",
      decor: "#95B5DE", art: "#6393CC", detail: "#3774B7",
    },
    character: HERO_CHARACTERS.sekai[0],
    particles: ["#004190", "#ffbd39", "#95B5DE", "#ffffff"],
    cursor: { main: "/brand/cursor/miku.webp", mascot: "/brand/cursor/tofu.webp" },
  },
  bluearchive: {
    label: "蔚蓝档案",
    brand: "蔚蓝档案",
    wordmark: "BLUE ARCHIVE",
    communityUrl: "https://qm.qq.com/q/2ZMcajVnaw",
    communityGroup: "544353386",
    fans: "蔚蓝档案同好",
    guessTitle: "BA 猜图",
    guessPreview: "/cards/bluearchive/10010_rip/memorial.jpg",
    arcadeLabel: "XT BLUE ARCHIVE",
    colors: {
      accent: "#1D66ED", hover: "#1554C8", pressed: "#1045A6",
      soft: "#F3F7FF", tint: "#EAF1FF", border: "#BDD1FC",
      decor: "#8BB4FF", art: "#6B9DF5", detail: "#3E7DEA",
    },
    character: HERO_CHARACTERS.bluearchive[0],
    particles: ["#1D66ED", "#FFEE7A", "#8BB4FF", "#ffffff"],
    cursor: { main: "/brand/bluearchive/minichara.png", mascot: "/brand/bluearchive/fish.png" },
  },
} as const;
export type HomeTheme = (typeof HOME_THEMES)[HomeThemeId];

export function communityThemeIntro(text: string, themeId: HomeThemeId): string {
  if (themeId === "bangdream") return text;
  const theme = HOME_THEMES[themeId];
  const themed = text.replace(/BanG\s*Dream!?/gi, theme.brand).replace(/邦邦人/g, theme.fans).replace(/邦邦/g, theme.brand);
  return themeId === "bluearchive" ? themed.replaceAll("聊音乐", "聊剧情") : themed;
}

export function resolveHomeTheme(search: string): HomeThemeId {
  const theme = new URLSearchParams(search).get("theme");
  return theme === "sekai" || theme === "bluearchive" ? theme : "bangdream";
}

export function buildHomeThemeSearch(search: string, theme: HomeThemeId): string {
  const params = new URLSearchParams(search);
  if (theme !== "bangdream") params.set("theme", theme);
  else params.delete("theme");
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function homeThemeStyle(theme: HomeTheme): CSSProperties {
  return Object.fromEntries(Object.entries(theme.colors).map(([name, color]) => [`--home-${name}`, color]));
}

export function themeHref(href: string, theme: HomeThemeId): string {
  const url = new URL(href, "http://theme.local");
  return `${url.pathname}${buildHomeThemeSearch(url.search, theme)}${url.hash}`;
}

export function staticCharacterStyle(character: HeroCharacter): CSSProperties {
  return {
    width: `${character.width / 700 * 100}%`,
    height: `${character.height / 650 * 100}%`,
    top: `${character.top / 650 * 100}%`,
    left: `${character.left / 700 * 100}%`,
  };
}
