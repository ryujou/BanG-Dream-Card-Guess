import { useEffect, useId, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { StageParticles } from "./StageParticles";
import styles from "./XiangtanScene.module.css";

export function XiangtanScene({ colors }: { colors?: readonly string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { amount: 0.1 });
  const reduced = useReducedMotion();
  const [active, setActive] = useState(!document.hidden);
  const id = useId().replaceAll(":", "");
  useEffect(() => {
    const change = () => setActive(!document.hidden);
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  return (
    <div
      ref={ref}
      className={styles.scene}
      data-running={visible && active && !reduced}
    >
      <svg
        viewBox="0 0 900 430"
        role="img"
        aria-label="湘潭江畔：万楼、湘潭眼、湘江一桥和湘莲"
      >
        <defs>
          <linearGradient id={`${id}-river`} x2="1" y2="1">
            <stop stopColor="var(--home-tint, #ffe5ef)" />
            <stop offset="1" stopColor="var(--home-border, #ffc1d8)" />
          </linearGradient>
          <linearGradient id={`${id}-roof`} x2="0" y2="1">
            <stop stopColor="var(--home-accent, #b02b61)" />
            <stop offset="1" stopColor="var(--home-pressed, #662344)" />
          </linearGradient>
          <linearGradient id={`${id}-wall`} x2="1" y2="0">
            <stop stopColor="#fff1e2" />
            <stop offset=".55" stopColor="#fff9f0" />
            <stop offset="1" stopColor="#eecbc6" />
          </linearGradient>
        </defs>
        <circle cx="300" cy="159" r="145" fill="var(--home-tint, #ffe4ec)" />
        <circle cx="671" cy="109" r="80" fill="#fff0cc" />
        <g fill="var(--home-border, #efb6ce)" opacity=".5">
          <path d="M12 291 55 257 86 266 119 232 159 270 192 241 235 288V331H12Z" />
          <path d="M446 306 494 273 534 284 579 239 621 279 656 265 716 310V340H446Z" />
        </g>
        <g stroke="var(--home-decor, #e8a2bf)" strokeWidth="1.5" fill="none" strokeLinecap="round">
          <path d="M80 95c16-7 28-7 40 0m-20 5c16-7 28-7 40 0M432 80c14-10 27-10 41 0m-16 5c14-10 27-10 41 0" />
        </g>
        <g className={styles.wanlou}>
          <path d="M184 307H414L428 320H170Z" fill="var(--home-decor, #dca8b5)" />
          <path d="M195 282H403V307H195Z" fill="#f9e6da" />
          {[0, 1, 2, 3, 4].map((i) => {
            const y = 91 + i * 43,
              left = 243 - i * 16,
              right = 357 + i * 16;
            return (
              <g key={i}>
                <path
                  d={`M${left + 11} ${y}H${right - 11}V${y + 38}H${left + 11}Z`}
                  fill={`url(#${id}-wall)`}
                />
                {[0, 1, 2, 3, 4].map((n) => (
                  <path
                    key={n}
                    d={`M${left + 20 + (n * (right - left - 40)) / 4} ${y + 6}v27`}
                    stroke="var(--home-accent, #923852)"
                    strokeWidth="3"
                  />
                ))}
                <path
                  d={`M${left + 12} ${y + 30}H${right - 12}m${-(right - left - 24)} 6H${right - 12}`}
                  stroke="var(--home-accent, #9a4f65)"
                  strokeWidth="2"
                />
                <path
                  d={`M${left - 16} ${y - 8}Q${left + 7} ${y + 3} ${left + 32} ${y - 15}L${left + 43} ${y - 22}H${right - 43}L${right - 32} ${y - 15}Q${right - 7} ${y + 3} ${right + 16} ${y - 8}L${right + 7} ${y + 4}Q300 ${y + 17} ${left - 7} ${y + 4}Z`}
                  fill={`url(#${id}-roof)`}
                />
                <path
                  d={`M${left - 13} ${y - 6}Q300 ${y + 17} ${right + 13} ${y - 6}`}
                  fill="none"
                  stroke="var(--home-decor, #ee97b3)"
                  strokeWidth="2"
                />
                <g className={styles.lanterns} fill="#ffc56b">
                  <rect x={left + 15} y={y + 9} width="5" height="10" rx="2" />
                  <rect x={right - 20} y={y + 9} width="5" height="10" rx="2" />
                </g>
              </g>
            );
          })}
          <path
            d="M279 69h42m-41-1-4-7m44 7 4-7"
            stroke="var(--home-pressed, #772642)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M286 294q14-22 28 0v15h-28Z" fill="var(--home-pressed, #702c4a)" />
          <path
            d="M275 311h50m-59 5h68m-77 5h86"
            stroke="#fff8ef"
            strokeWidth="2"
          />
        </g>
        <g className={styles.wheel}>
          <circle
            cx="660"
            cy="180"
            r="108"
            fill="var(--home-soft, #fff9fc)"
            fillOpacity=".6"
            stroke="var(--home-accent, #b94371)"
            strokeWidth="2"
          />
          <g className={styles.rotor}>
            <circle
              cx="660"
              cy="180"
              r="104"
              fill="none"
              stroke="var(--home-decor, #e99bbc)"
              strokeWidth="4"
            />
            {Array.from({ length: 16 }, (_, i) => {
              const a = (i * Math.PI) / 8,
                x = 660 + 108 * Math.cos(a),
                y = 180 + 108 * Math.sin(a);
              return (
                <g key={i}>
                  <path
                    d={`M660 180L${x} ${y}`}
                    stroke="var(--home-decor, #d194ac)"
                    strokeWidth="1.1"
                  />
                  <g transform={`translate(${x} ${y})`}>
                    <g className={styles.cabin}>
                      <path
                        d="M-7 0v11q0 5 7 5t7-5V0Z"
                        fill={i % 2 ? "#fff6e9" : "var(--home-art, #ee70a1)"}
                        stroke="var(--home-accent, #a83b67)"
                        strokeWidth="1.4"
                      />
                      <path d="M-7 5H7" stroke="var(--home-accent, #a83b67)" strokeWidth="1" />
                    </g>
                  </g>
                </g>
              );
            })}
          </g>
          <path
            d="M655 178 609 305h15l36-97 36 97h15L665 178Z"
            fill="var(--home-detail, #b74873)"
          />
          <path
            d="M655 189 615 304m48-111 40 111"
            stroke="var(--home-tint, #ffdce9)"
            strokeWidth="2"
          />
          <circle
            cx="660"
            cy="180"
            r="10"
            fill="var(--home-accent, #ff2377)"
            stroke="var(--home-soft, #fff2f7)"
            strokeWidth="3"
          />
          <rect x="599" y="304" width="122" height="7" rx="3" fill="var(--home-accent, #8c385b)" />
        </g>
        <path
          d="M0 330Q155 301 318 331T660 326T900 328V430H0Z"
          fill={`url(#${id}-river)`}
        />
        <g fill="var(--home-detail, #b8587b)" stroke="#fff3ed" strokeWidth="2">
          <path d="M328 321H816V363H806Q785 323 764 363H752Q731 323 710 363H698Q677 323 656 363H644Q623 323 602 363H590Q569 323 548 363H536Q515 323 494 363H482Q461 323 440 363H428Q407 323 386 363H374Q353 323 332 363H328Z" />
          <path d="M322 316H822v7H322Z" fill="#f6d6cd" />
        </g>
        <path
          d="M330 306H814m-480 0v10m24-10v10m24-10v10m24-10v10m24-10v10m24-10v10m24-10v10m24-10v10m24-10v10m24-10v10m24-10v10m24-10v10m24-10v10m24-10v10m24-10v10m24-10v10m24-10v10m24-10v10m24-10v10m24-10v10m24-10v10"
          stroke="var(--home-detail, #b8587b)"
          strokeWidth="2"
        />
        <g className={styles.river} fill="none" strokeLinecap="round">
          <path
            d="M275 382Q420 368 555 382T870 380M365 402Q493 392 635 402T857 402"
            stroke="#fff9fb"
            strokeWidth="3"
            strokeDasharray="60 30 9 30"
          />
          <path
            d="M45 407Q143 392 250 406M453 370Q592 378 748 369"
            stroke="var(--home-decor, #ed95b7)"
            strokeWidth="2"
            strokeDasharray="40 26"
          />
        </g>
        <g className={styles.lotus} transform="translate(124 363)">
          <path
            d="M0 5q5 18-5 43"
            fill="none"
            stroke="#869782"
            strokeWidth="3"
          />
          <path
            d="M-4 39q-62-40-84-4 52 24 84 4M3 28q28-44 69-13-34 24-69 13"
            fill="#aebca0"
          />
          <path
            d="M-4 39-66-3m71 31 45-13"
            stroke="#eff2d9"
            strokeWidth="1.5"
          />
          <path d="M0 9Q-48 0-57-36-17-37 0 9Z" fill="var(--home-art, #f392b3)" />
          <path d="M0 9Q48 0 57-36 17-37 0 9Z" fill="var(--home-art, #ee74a2)" />
          <path d="M0 9Q-34-17-23-62 9-44 0 9Z" fill="var(--home-decor, #ffb0cb)" />
          <path d="M0 9Q34-17 23-62-9-44 0 9Z" fill="var(--home-decor, #f996b7)" />
          <path
            d="M0 9Q-26-25 0-78 26-25 0 9Z"
            fill="var(--home-border, #ffd5e3)"
            stroke="var(--home-art, #ed91b0)"
            strokeWidth="1.2"
          />
          <path
            d="M0-49V-6"
            stroke="#fff7ed"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
        <g className={styles.sparkles} fill="var(--home-detail, #e96097)">
          <path d="m492 185 4 12 12 4-12 4-4 12-4-12-12-4 12-4Z" />
          <path d="m829 188 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" />
        </g>
      </svg>
      <span className={styles.wanlouLabel}>万楼</span>
      <span className={styles.wheelLabel}>湘潭眼</span>
      <span className={styles.riverLabel}>湘江一桥</span>
      <StageParticles colors={colors} />
    </div>
  );
}
