import { useId } from "react";
import { HOME_THEMES, type HomeThemeId } from "../lib/home-theme";

export function GameRail({ themeId = "bangdream" }: { themeId?: HomeThemeId }) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 220 720"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern
          id={`${id}-dots`}
          width="13"
          height="13"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="3" cy="3" r="1.8" fill="var(--pink)" />
        </pattern>
        <pattern
          id={`${id}-dark-dots`}
          width="13"
          height="13"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="3" cy="3" r="1.8" fill="#b21d53" />
        </pattern>
      </defs>
      <path
        d="M0 0H142L93 117 188 75 126 214 220 187 110 452 204 420 96 720H0Z"
        fill="var(--pink)"
      />
      <path
        d="M0 610 90 550 20 680 65 650 25 720H0Z"
        fill="#cb2460"
        opacity=".3"
      />
      <path d="M140 331H220V720H84Z" fill={`url(#${id}-dots)`} opacity=".46" />
      <path d="M0 0H140L89 136H0" fill={`url(#${id}-dark-dots)`} opacity=".2" />
      <path
        d="m62 157 5 23 24-3-20 17 7 22-20-13-22 17 6-27-19-14 26-2Z"
        fill="none"
        stroke="white"
        strokeWidth="4"
        strokeLinejoin="miter"
        transform="rotate(-9 56 191)"
      />
      <path
        d="m29 191 37-38-9 55-20 18 42-48"
        fill="none"
        stroke="white"
        strokeWidth="1.6"
      />
      <g
        data-rail-copy="true"
        fill="white"
        fontFamily="Impact, Arial Narrow, sans-serif"
        fontSize="29"
        letterSpacing="1"
      >
        <text x="27" y="274">
          {themeId === "bluearchive" ? "BLUE" : themeId === "sekai" ? "COLORFUL" : "GIRLS"}
        </text>
        <text x="27" y="307">
          {themeId === "bluearchive" ? "ARCHIVE" : themeId === "sekai" ? "STAGE!" : "BAND"}
        </text>
        <text x="27" y="340">
          {themeId === "bluearchive" ? "MEMORY" : themeId === "sekai" ? "SEKAI" : "PARTY!"}
        </text>
      </g>
      <path d="M28 370h29" stroke="white" strokeWidth="3" />
      <g data-rail-copy="true" fill="white" fontSize="15" fontWeight="700">
        <text x="28" y="423">
          {themeId === "bluearchive" ? "故事让" : "音乐让"}
        </text>
        <text x="28" y="448">
          我们的心
        </text>
        <text x="28" y="473">
          互相靠近
        </text>
      </g>
      <g
        data-rail-copy="true"
        fill="white"
        fontSize="10"
        fontWeight="700"
        letterSpacing="3"
      >
        <text x="28" y="665">
          XIANGTAN
        </text>
        <text x="28" y="685">
          {HOME_THEMES[themeId].wordmark}
        </text>
        <text x="28" y="705">
          FAN CLUB
        </text>
      </g>
    </svg>
  );
}

export function TimerDecoration({ themeId = "bangdream" }: { themeId?: HomeThemeId }) {
  return (
    <svg
      viewBox="0 0 180 300"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      data-decoration="timer"
    >
      <path d="m158-10-43 74 40-15-38 85 61-115-49 23 31-52Z" fill="white" />
      <path
        d="m120 53-69 29 62-16-45 18 50-10"
        fill="none"
        stroke="white"
        strokeWidth="2"
      />
      <path d="m20 221 130-45" stroke="white" strokeWidth="2" />
      <g fill="white" fontSize="10" fontWeight="700" letterSpacing="2">
        <text x="84" y="246">
          {themeId === "bluearchive" ? "STORIES" : "MUSIC"}
        </text>
        <text x="84" y="263">
          {themeId === "bluearchive" ? "CONNECT" : "CONNECTS"}
        </text>
        <text x="84" y="280">
          US
        </text>
      </g>
      <path d="M84 292h18" stroke="white" strokeWidth="2" />
    </svg>
  );
}

export function ScoreLightning() {
  return (
    <svg
      viewBox="0 0 60 120"
      aria-hidden="true"
      focusable="false"
      data-decoration="score"
    >
      <path d="M48 0 5 70l24-7-15 57 42-73-23 9Z" fill="var(--yellow)" />
    </svg>
  );
}
