import { useEffect, useRef, useState } from "react";

const DEFAULT_COLORS = ["#ff2377", "#ffbd39", "#ef8dbb", "#ffffff"];

export function StageParticles({ colors = DEFAULT_COLORS }: { colors?: readonly string[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(preference.matches);
    preference.addEventListener("change", change);
    return () => preference.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    const element = canvas.current;
    if (!element || reduced) return;
    const parent = element.parentElement!;
    const ctx = element.getContext("2d")!;
    let width = 0,
      height = 0,
      frame = 0,
      last = 0,
      visible = false,
      time = 0;
    const pointer = { x: -1000, y: -1000 };
    const particles = Array.from({ length: 48 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.4 + Math.random(),
      size: i % 7 === 0 ? 5 + Math.random() * 3 : 1 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
      color: colors[i % colors.length],
    }));
    const resize = () => {
      width = parent.clientWidth;
      height = parent.clientHeight;
      const ratio = Math.min(devicePixelRatio || 1, 1.5);
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - last < 32) return;
      time += Math.min(now - (last || now), 60) / 1000;
      last = now;
      ctx.clearRect(0, 0, width, height);
      particles.slice(0, width < 650 ? 20 : 48).forEach((p, i) => {
        let x = p.x * width + Math.sin(time * 0.3 + p.phase) * 22;
        let y =
          (((p.y * height - time * p.speed * 8) % height) + height) % height;
        const dx = x - pointer.x,
          dy = y - pointer.y,
          distance = Math.hypot(dx, dy);
        if (distance < 130 && distance > 0) {
          x += (dx / distance) * (130 - distance) * 0.25;
          y += (dy / distance) * (130 - distance) * 0.25;
        }
        ctx.globalAlpha = 0.35 + (Math.sin(time * 0.8 + p.phase) + 1) * 0.25;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        if (i % 7 === 0) {
          for (let n = 0; n < 8; n++) {
            const angle = (n * Math.PI) / 4 + time * 0.12;
            const radius = n % 2 ? p.size * 0.23 : p.size;
            ctx.lineTo(
              x + Math.cos(angle) * radius,
              y + Math.sin(angle) * radius,
            );
          }
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.arc(x, y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    };
    const update = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      const running = visible && !document.hidden;
      element.dataset.running = String(running);
      if (running) frame = requestAnimationFrame(draw);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(parent);
    const resizer = new ResizeObserver(resize);
    resizer.observe(parent);
    const move = (event: PointerEvent) => {
      const box = parent.getBoundingClientRect();
      pointer.x = event.clientX - box.left;
      pointer.y = event.clientY - box.top;
    };
    const leave = () => {
      pointer.x = -1000;
      pointer.y = -1000;
    };
    parent.addEventListener("pointermove", move, { passive: true });
    parent.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", update);
    resize();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizer.disconnect();
      parent.removeEventListener("pointermove", move);
      parent.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", update);
    };
  }, [reduced, colors]);
  return reduced ? null : (
    <canvas ref={canvas} aria-hidden="true" className="stage-particles" />
  );
}
