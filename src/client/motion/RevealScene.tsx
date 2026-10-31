import { Player } from "@remotion/player";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
function RevealComposition() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame, fps, config: { damping: 18 } });
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: `${index * 34}%`,
            width: "38%",
            height: "140%",
            top: "-20%",
            background: index === 1 ? "#17191f" : "var(--arcade-accent, #f43f78)",
            transform: `skewX(-18deg) translateY(${interpolate(progress, [0, 1], [-110, 110])}%)`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
}
export default function RevealScene() {
  return (
    <div className="reveal-scene" aria-hidden="true">
      <Player
        component={RevealComposition}
        durationInFrames={35}
        compositionWidth={1200}
        compositionHeight={800}
        fps={30}
        autoPlay
        initiallyMuted
        controls={false}
        clickToPlay={false}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
