// Noise Catcher — React component
//
// Drop into any React/Next/Remix codebase. Two named exports:
//   <NCSymbol/>       — the catcher's mitt mark
//   <NCWordmark/>     — "Noise Catcher" set in Instrument Serif
//   <NCLockup/>       — symbol + wordmark, horizontal or stacked
//
// Sizes are responsive via the `size` prop (pixel height). Colors map to your
// theme tokens or accept overrides. Make sure Instrument Serif is loaded in
// your <head> for wordmark fidelity:
//
//   <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&display=swap" rel="stylesheet"/>

import React from "react";

const INK = "#0E0E0E";
const BG = "#FAFAF7";
const ACCENT = "#3B5BDB";

/**
 * Catcher's mitt mark. C-arc opens to the right, the accent dot is the
 * caught signal nested in the pocket.
 *
 * @param {object} props
 * @param {number} [props.size=24]      Height in px (width auto-scales).
 * @param {string} [props.ink="#0E0E0E"]   Arc color.
 * @param {string} [props.accent="#3B5BDB"] Dot color.
 * @param {boolean}[props.mono=false]   When true, dot adopts ink color (single-color rendering).
 * @param {string} [props.title="Noise Catcher"]
 */
export function NCSymbol({
  size = 24,
  ink = INK,
  accent = ACCENT,
  mono = false,
  title = "Noise Catcher",
  ...rest
}) {
  const dot = mono ? ink : accent;
  const ratio = 132 / 120;
  return (
    <svg
      viewBox="0 0 132 120"
      width={size * ratio}
      height={size}
      role="img"
      aria-label={title}
      style={{ display: "block" }}
      {...rest}
    >
      <title>{title}</title>
      <path
        d="M95 22A40 40 0 1 0 95 98"
        stroke={ink}
        strokeWidth="20"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="102" cy="60" r="11" fill={dot} />
    </svg>
  );
}

/**
 * "Noise Catcher" wordmark set in Instrument Serif. Pass `size` (font-size in px).
 */
export function NCWordmark({
  size = 24,
  color = INK,
  as: As = "span",
  ...rest
}) {
  return (
    <As
      {...rest}
      style={{
        fontFamily: '"Instrument Serif", "Times New Roman", serif',
        fontWeight: 400,
        fontSize: size,
        letterSpacing: "-0.005em",
        lineHeight: 1,
        color,
        whiteSpace: "nowrap",
        ...rest.style,
      }}
    >
      Noise Catcher
    </As>
  );
}

/**
 * Symbol + wordmark together.
 *
 * @param {object} props
 * @param {"horizontal"|"stacked"} [props.layout="horizontal"]
 * @param {number} [props.size=32]   Height of the symbol; wordmark sized proportionally.
 * @param {boolean}[props.inverse]   Use off-white on dark.
 */
export function NCLockup({
  layout = "horizontal",
  size = 32,
  inverse = false,
  ink,
  accent = ACCENT,
  ...rest
}) {
  const resolvedInk = ink ?? (inverse ? BG : INK);
  const horizontal = layout === "horizontal";
  const wordmarkSize = horizontal ? size * 0.82 : size * 0.46;

  return (
    <span
      {...rest}
      style={{
        display: "inline-flex",
        flexDirection: horizontal ? "row" : "column",
        alignItems: "center",
        gap: horizontal ? size * 0.25 : size * 0.22,
        ...rest.style,
      }}
    >
      <NCSymbol size={size} ink={resolvedInk} accent={accent} />
      <NCWordmark size={wordmarkSize} color={resolvedInk} />
    </span>
  );
}
