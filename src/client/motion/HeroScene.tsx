import { useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { useInView } from "motion/react";
import type { HeroCharacter } from "../lib/home-theme";
import styles from "../components/HeroCharacters.module.css";

type HeroSceneProps = { character: HeroCharacter; previous?: HeroCharacter };
function HeroComposition({ character, previous }: HeroSceneProps) {
  const frame = useCurrentFrame();
  const drift = Math.sin((frame / 240) * Math.PI * 2);
  return (
    <AbsoluteFill style={{ overflow: "visible" }}>
      {[...(previous ? [previous] : []), character].map((portrait, index) => <Img
        key={portrait.src}
        className={previous ? (index === 0 ? styles.leaving : styles.entering) : undefined}
        src={portrait.src}
        alt={portrait === previous ? "" : portrait.alt}
        style={{
          position: "absolute",
          height: portrait.height,
          width: portrait.width,
          maxWidth: "none",
          objectFit: "contain",
          top: portrait.top,
          left: portrait.left,
          transform: `translateY(${drift * 7}px) rotate(${interpolate(frame, [0, 120, 240], [-1, 1, -1])}deg)`,
        }}
      />)}
    </AbsoluteFill>
  );
}

export default function HeroScene({ character, previous }: HeroSceneProps) {
  const container = useRef<HTMLDivElement>(null);
  const player = useRef<PlayerRef>(null);
  const inView = useInView(container);
  useEffect(() => {
    if (inView) player.current?.play();
    else player.current?.pause();
  }, [inView]);
  return (
    <div ref={container} className="hero-scene" aria-hidden="true">
      <Player
        ref={player}
        component={HeroComposition}
        inputProps={{ character, previous }}
        durationInFrames={240}
        compositionWidth={700}
        compositionHeight={650}
        fps={30}
        loop
        autoPlay
        initiallyMuted
        controls={false}
        clickToPlay={false}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
