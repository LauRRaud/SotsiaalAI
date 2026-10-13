"use client";

import { useId } from "react";

// Glyph origins from the confirmed logo, mapped to its viewport. The text
// uses the page's actual Exo 2 font at the final display size, without scaling.
const LETTERS = [
  ["S", -0.037130], ["o", 11.279502], ["t", 22.716993],
  ["s", 30.170679], ["i", 40.435139], ["a", 45.406344],
  ["a", 56.433927], ["l", 67.461509], [".", 73.393312],
];
const SUFFIX = [["p", 78.069239], ["r", 85.635101], ["o", 90.958983]];

export default function NativeWordmark() {
  const cutId = useId();
  return (
    <div className="room-veil-logo">
      {/* No viewBox: glyphs are painted directly in screen CSS pixels. */}
      <svg className="room-veil-wordmark" width="100%" height="100%" role="img" aria-label="Sotsiaal.pro">
        <defs>
          <clipPath id={cutId}>
            <rect x="0" y="0" width="94.520851%" height="100%" />
            <rect x="0" y="40.103488%" width="100%" height="59.896512%" />
          </clipPath>
        </defs>
        {LETTERS.map(([char, x], index) => (
          <text key={index} x={`${x}%`} y="92.498937%" className="room-veil-wordmark-letter">{char}</text>
        ))}
        {SUFFIX.map(([char, x]) => (
          <text key={char} x={`${x}%`} y="60.974964%" className="room-veil-wordmark-letter room-veil-wordmark-pro" clipPath={char === "o" ? `url(#${cutId})` : undefined}>{char}</text>
        ))}
        <rect className="room-veil-wordmark-corner" x="95.560482%" y="17.788040%" width="2.938245%" height="16.483232%" rx="0.470119%" ry="2.637317%" />
      </svg>
    </div>
  );
}
