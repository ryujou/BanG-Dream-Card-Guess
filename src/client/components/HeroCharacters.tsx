import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import { HERO_CHARACTERS, staticCharacterStyle, type HomeThemeId } from "../lib/home-theme";
import styles from "./HeroCharacters.module.css";

const HeroScene = lazy(() => import("../motion/HeroScene"));
export const HERO_INTERVAL = 6000;

export function HeroCharacters({ themeId, reduced }: { themeId: HomeThemeId; reduced: boolean }) {
  const characters = HERO_CHARACTERS[themeId];
  const storageKey = `xtbang:hero:${themeId}`;
  const [target, setTarget] = useState(() => {
    const previous = sessionStorage.getItem(storageKey);
    const choices = characters.map((_, index) => index).filter(index => characters[index].src !== previous);
    return choices[Math.floor(Math.random() * choices.length)];
  });
  const [frame, setFrame] = useState({ index: target, previous: null as number | null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hidden, setHidden] = useState(document.hidden);
  const container = useRef<HTMLDivElement>(null);
  const inView = useInView(container);
  const character = characters[frame.index];
  const previous = frame.previous === null || reduced ? undefined : characters[frame.previous];

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const image = new Image();
    image.src = characters[target].src;
    image.decode().then(() => {
      if (!active) return;
      setFrame(old => old.index === target ? old : { index: target, previous: old.index });
      sessionStorage.setItem(storageKey, characters[target].src);
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setError("立绘暂时加载失败，请刷新页面重试。");
      setLoading(false);
    });
    return () => { active = false; };
  }, [characters, storageKey, target]);

  useEffect(() => {
    if (frame.previous === null) return;
    const timer = window.setTimeout(() => setFrame(old => ({ ...old, previous: null })), 600);
    return () => window.clearTimeout(timer);
  }, [frame.index, frame.previous]);

  useEffect(() => {
    const change = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);

  useEffect(() => {
    if (loading || error || reduced || hidden || !inView) return;
    const next = (frame.index + 1) % characters.length;
    const preload = new Image();
    preload.src = characters[next].src;
    const timer = window.setTimeout(() => setTarget(next), HERO_INTERVAL);
    return () => window.clearTimeout(timer);
  }, [characters, error, frame.index, hidden, inView, loading, reduced]);

  const portrait = <>
    {previous && <img className={`${styles.portrait} ${styles.leaving}`} src={previous.src} alt="" style={staticCharacterStyle(previous)} />}
    <img key={character.src} className={`${styles.portrait} ${previous ? styles.entering : ""}`} src={character.src} alt={character.alt} style={staticCharacterStyle(character)} />
  </>;

  return <div ref={container} className={styles.characters} data-hero-character={character.src} data-hero-ready={!loading}>
    {reduced ? portrait : <Suspense fallback={portrait}><HeroScene character={character} previous={previous} /></Suspense>}
    {error && <p className={styles.error} role="status">{error}</p>}
  </div>;
}
