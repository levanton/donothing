// Custom SVG mask path for the spotlight cutout.
//
// Two visual modes, picked from the target's size:
//   - small targets (anything where min side < LARGE_THRESHOLD) render
//     as a stadium/circle — radius = min(w, h) / 2. Looks great for
//     buttons, icons, week-dot rows and settings pills.
//   - large targets (the home hero — timer + yes + slider grouped, or
//     the calendar) render as a rounded rectangle with a fixed corner
//     radius, so the entire content stays visible without the cutout
//     ballooning into one giant pill.

import type { Animated } from 'react-native';

interface MaskArgs {
  size: Animated.ValueXY;
  position: Animated.ValueXY;
  canvasSize: { x: number; y: number };
}

// Symmetric padding for small targets — keeps a square button square
// so it gets a perfect circle cutout, not a slightly squashed pill.
const PAD_SMALL = 12;
// Asymmetric padding for large targets — tighter at the bottom so the
// tooltip pill sits close to the content with no dead air below.
const PAD_X_LARGE = 12;
const PAD_TOP_LARGE = 12;
const PAD_BOTTOM_LARGE = 4;
const CORNER_RADIUS = 28;
const LARGE_THRESHOLD = 200;

// Animated.Value exposes its current numeric reading via `_value`, but
// it's not in the public type. Read it through a narrow cast so the
// signature still matches the library's SvgMaskPathFunction.
const read = (v: Animated.Value): number => (v as unknown as { _value: number })._value;

export function roundedSvgMaskPath({ size, position, canvasSize }: MaskArgs): string {
  const rawW = read(size.x);
  const rawH = read(size.y);
  const isLarge = rawW >= LARGE_THRESHOLD && rawH >= LARGE_THRESHOLD;

  const padX = isLarge ? PAD_X_LARGE : PAD_SMALL;
  const padTop = isLarge ? PAD_TOP_LARGE : PAD_SMALL;
  const padBottom = isLarge ? PAD_BOTTOM_LARGE : PAD_SMALL;

  const x = read(position.x) - padX;
  const y = read(position.y) - padTop;
  const w = rawW + padX * 2;
  const h = rawH + padTop + padBottom;

  // Pick the corner radius based on target size:
  //   - large targets get a softly rounded rectangle (fixed radius) so
  //     the entire content stays visible inside.
  //   - everything else gets a stadium / circle (radius = half the
  //     short side) which looks clean for buttons, icons, dot rows.
  const r = isLarge ? CORNER_RADIUS : Math.min(w, h) / 2;

  // Outer rectangle (full canvas) + inner rounded rect cut-out, both
  // closed with Z. SVG uses non-zero fill rule, so the inner shape is
  // subtracted from the outer.
  return (
    `M0,0H${canvasSize.x}V${canvasSize.y}H0V0Z ` +
    `M${x + r},${y} ` +
    `H${x + w - r} ` +
    `a${r},${r} 0 0 1 ${r},${r} ` +
    `V${y + h - r} ` +
    `a${r},${r} 0 0 1 ${-r},${r} ` +
    `H${x + r} ` +
    `a${r},${r} 0 0 1 ${-r},${-r} ` +
    `V${y + r} ` +
    `a${r},${r} 0 0 1 ${r},${-r} Z`
  );
}
