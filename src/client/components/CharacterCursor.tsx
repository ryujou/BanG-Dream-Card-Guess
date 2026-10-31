import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { HomeTheme, HomeThemeId } from "../lib/home-theme";
import styles from "./CharacterCursor.module.css";

export function CharacterCursor({ themeId, character }: { themeId: HomeThemeId; character: HomeTheme["cursor"] }) {
  const layerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const mascotRef = useRef<HTMLDivElement>(null);
  const burstsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current!;
    const main = mainRef.current!;
    const mascot = mascotRef.current!;
    const bursts = burstsRef.current!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const compact = matchMedia("(max-width: 750.9px)");
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    let follow = false;
    let initialized = false;
    let frame = 0;
    let previousTime = 0;
    const target = { x: 0, y: 0 };
    const positions = [
      { element: main, x: 0, y: 0, tau: 120 },
      { element: mascot, x: 0, y: 0, tau: 280 },
    ];
    document.body.dataset.characterCursor = themeId;

    function paint() {
      for (const position of positions) {
        position.element.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
      }
    }
    function reset() {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      initialized = false;
      delete layer.dataset.active;
      bursts.replaceChildren();
    }
    function configure() {
      reset();
      follow = !compact.matches && fine.matches;
      layer.dataset.mode = reduced.matches ? "off" : follow ? "follow" : "burst";
    }
    function animate(time: number) {
      const dt = previousTime ? Math.min(time - previousTime, 100) : 16;
      previousTime = time;
      let moving = false;
      for (const position of positions) {
        // Time-based smoothing keeps the two delays consistent across refresh rates.
        const alpha = 1 - Math.exp(-dt / position.tau);
        position.x += (target.x - position.x) * alpha;
        position.y += (target.y - position.y) * alpha;
        if (Math.hypot(target.x - position.x, target.y - position.y) > 0.1) {
          moving = true;
        } else {
          position.x = target.x;
          position.y = target.y;
        }
      }
      paint();
      frame = moving ? requestAnimationFrame(animate) : 0;
      if (!moving) previousTime = 0;
    }
    function move(event: PointerEvent) {
      if (!follow || reduced.matches || event.pointerType === "touch" || document.hidden) return;
      target.x = event.clientX;
      target.y = event.clientY;
      if (!initialized) {
        for (const position of positions) {
          position.x = target.x;
          position.y = target.y;
        }
        paint();
        initialized = true;
      }
      layer.dataset.active = "true";
      if (!frame) frame = requestAnimationFrame(animate);
    }
    function burst(event: MouseEvent) {
      if (follow || reduced.matches || event.detail === 0 || document.hidden) return;
      while (bursts.childElementCount > 6) bursts.firstElementChild?.remove();
      const angle = Math.random() * Math.PI * 2;
      [character.main, character.mascot].forEach((name, index) => {
        const sprite = document.createElement("img");
        sprite.src = name;
        sprite.alt = "";
        sprite.className = `${styles.burst} ${index === 1 ? styles.smallBurst : ""}`;
        sprite.style.left = `${event.clientX}px`;
        sprite.style.top = `${event.clientY}px`;
        const direction = angle + index * Math.PI;
        sprite.style.setProperty("--dx", `${Math.cos(direction) * 32}px`);
        sprite.style.setProperty("--dy", `${Math.sin(direction) * 32}px`);
        sprite.addEventListener("animationend", () => sprite.remove(), { once: true });
        bursts.appendChild(sprite);
      });
    }
    function visibility() {
      if (document.hidden) reset();
    }

    configure();
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("click", burst);
    window.addEventListener("blur", reset);
    document.documentElement.addEventListener("pointerleave", reset);
    document.addEventListener("visibilitychange", visibility);
    for (const query of [reduced, compact, fine]) query.addEventListener("change", configure);
    return () => {
      reset();
      delete document.body.dataset.characterCursor;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("click", burst);
      window.removeEventListener("blur", reset);
      document.documentElement.removeEventListener("pointerleave", reset);
      document.removeEventListener("visibilitychange", visibility);
      for (const query of [reduced, compact, fine]) query.removeEventListener("change", configure);
    };
  }, [themeId, character]);

  return (
    <>
      {createPortal(
        <div ref={layerRef} className={styles.layer} data-character-layer="" aria-hidden="true">
          <div className={styles.followers}>
            <div ref={mainRef} className={styles.main} data-character-follow="main">
              <img src={character.main} alt="" draggable={false} />
            </div>
            <div ref={mascotRef} className={styles.mascot} data-character-follow="mascot">
              <img src={character.mascot} alt="" draggable={false} />
            </div>
          </div>
          <div ref={burstsRef} data-character-bursts="" />
        </div>,
        document.body,
      )}
    </>
  );
}
