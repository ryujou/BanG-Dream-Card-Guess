export function StageStar({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="m50 0 9 31 27-17-17 27 31 9-31 9 17 27-27-17-9 31-9-31-27 17 17-27L0 50l31-9-17-27 27 17Z" />
    </svg>
  );
}

export function StageShapes({ shop = false }: { shop?: boolean }) {
  return (
    <svg viewBox="0 0 500 400" fill="none" aria-hidden="true">
      <path d="M16 286 414 60l69 121L85 400Z" fill="#ff2377" />
      <path d="m114 371 372-211 14 25-372 211Z" fill="#161616" />
      <path
        d="m333 6 9 40 34-22-22 35 40 9-40 9 22 35-34-22-9 40-9-40-35 22 22-35-40-9 40-9-22-35 35 22Z"
        fill="#ffdd35"
        stroke="#161616"
        strokeWidth="2"
      />
      <path d="m45 115 8 27 27 8-27 8-8 27-8-27-27-8 27-8Z" fill="#161616" />
      <path
        d="m426 271-46 62h29l-18 53 59-74h-32Z"
        fill="white"
        stroke="#161616"
        strokeWidth="3"
      />
      <g fill="#161616">
        {Array.from({ length: 25 }, (_, i) => (
          <circle
            key={i}
            cx={395 + (i % 5) * 13}
            cy={29 + Math.floor(i / 5) * 13}
            r="1.6"
          />
        ))}
      </g>
      {shop && (
        <g transform="rotate(-12 244 204)">
          <path
            d="m155 129-15 167h207l-15-167Z"
            fill="white"
            stroke="#161616"
            strokeWidth="4"
          />
          <path
            d="M206 145v-34a37 37 0 0 1 74 0v34"
            stroke="#161616"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="m244 168 12 27 29 3-22 20 7 29-26-15-26 15 7-29-22-20 29-3Z"
            fill="#ff2377"
          />
        </g>
      )}
    </svg>
  );
}
