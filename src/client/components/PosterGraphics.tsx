import { useId } from "react";

export function OutlineStar({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden="true">
      <path
        d="m61 5 13 36 40-7-29 29 18 39-38-17-31 30 4-43-34-18 41-8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinejoin="miter"
      />
      <path
        d="m48 15 8 20M96 69l19 5M23 102l-12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

export function Lightning({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 140" aria-hidden="true">
      <path fill="currentColor" d="M96 1 12 75 47 65 8 140 91 54 59 67Z" />
    </svg>
  );
}

export function AccentMarks({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <path
        fill="currentColor"
        d="m41 2 23 9-27 57-14-7ZM77 48l19 22-43 25-8-13Z"
      />
    </svg>
  );
}

export function HeroBackdrop({ className = "" }: { className?: string }) {
  const id = useId();
  return (
    <svg
      className={className}
      viewBox="0 0 1440 690"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id={`${id}-dots`}
          width="19"
          height="19"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="3" r="1.4" fill="white" />
          <circle cx="13" cy="12" r=".9" fill="white" />
          <path d="m6 15 3-2M15 1l2 1" stroke="white" strokeWidth="1.4" />
        </pattern>
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="white" />
          <stop offset=".9" stopColor="black" />
        </linearGradient>
        <mask id={`${id}-mask`}>
          <rect width="1440" height="690" fill={`url(#${id}-fade)`} />
        </mask>
      </defs>
      <path d="M466 690 911 0h241L712 690Z" fill="var(--pink)" />
      <path d="m1080 587 360-154v257H929Z" fill="var(--pink)" />
      <path
        d="m1113 608 327-145v-18l-370 174Zm-24 37 351-152v-8l-317 150ZM593 463l91-101-30 56 47-20-98 97 36-58Z"
        fill="white"
      />
      <path
        d="m1058 664 382-174v200H990Z"
        fill={`url(#${id}-dots)`}
        mask={`url(#${id}-mask)`}
      />
      <path d="M0 662h40l-8 28H0Z" fill="var(--pink)" />
    </svg>
  );
}

export function MusicStaff({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 220 110"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <g transform="rotate(-20 100 50)" strokeWidth="1.5">
        {[25, 35, 45, 55, 65].map((y) => (
          <path key={y} d={`M5 ${y}Q100 ${y - 8} 213 ${y + 4}`} />
        ))}
        <path d="M58 67V10l18 4v33M131 63V20l27-5v37" strokeWidth="3" />
        <ellipse cx="51" cy="67" rx="8" ry="5" fill="currentColor" />
        <ellipse cx="69" cy="49" rx="8" ry="5" fill="currentColor" />
        <ellipse cx="124" cy="64" rx="8" ry="5" fill="currentColor" />
        <ellipse cx="151" cy="53" rx="8" ry="5" fill="currentColor" />
      </g>
    </svg>
  );
}

export function GameGlyph({
  kind,
  className = "",
}: {
  kind: "music" | "timer" | "blocks";
  className?: string;
}) {
  return (
    <svg className={className} viewBox="0 0 80 80" aria-hidden="true">
      {kind === "music" ? (
        <>
          <circle cx="40" cy="40" r="36" fill="currentColor" />
          <path
            d="M42 22v35c0 9-19 11-19 1 0-7 10-10 15-7V28l19-5v9Z"
            fill="white"
          />
        </>
      ) : kind === "timer" ? (
        <>
          <circle
            cx="40"
            cy="45"
            r="28"
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
          />
          <path
            d="M34 3h13v7H34zM37 10h7v10h-7zM62 18l5-5 8 9-6 5zM37 28h6v22H30v-6h7z"
            fill="currentColor"
          />
        </>
      ) : (
        <>
          <rect x="6" y="6" width="29" height="29" rx="5" fill="currentColor" />
          <rect
            x="41"
            y="6"
            width="32"
            height="66"
            rx="5"
            fill="currentColor"
          />
          <rect
            x="6"
            y="41"
            width="29"
            height="31"
            rx="5"
            fill="currentColor"
          />
        </>
      )}
    </svg>
  );
}
