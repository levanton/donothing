// Custom SVG mask path for the spotlight cutout.
//
// Two visual modes, picked from the target's shape:
//   - small near-square targets (yes pill, settings icons, dot rows that
//     are roughly as tall as they are short) render as a stadium/circle
//     with radius = min(w, h) / 2. Buttons stay visually circular.
//   - everything else — wide horizontal bars (Allow some apps, calendar
//     row), tall sections (Screen block group) — gets a rounded rectangle
//     with a small fixed corner radius so the cutout matches the design's
//     own rounding instead of ballooning into a giant pill.

import type { Animated } from 'react-native';

interface MaskArgs {
  size: Animated.ValueXY;
  position: Animated.ValueXY;
  canvasSize: { x: number; y: number };
}

// Symmetric padding for small targets — keeps a square button square
// so it gets a perfect circle cutout, not a slightly squashed pill.
const PAD_SMALL = 12;
// Padding for large targets — zero on X so the cutout sits tight against
// the content's own left/right edges instead of looking shifted toward
// whichever side has shorter content. Light vertical padding still gives
// breathing room between the cutout and the surrounding sections.
const PAD_X_LARGE = 0;
const PAD_TOP_LARGE = 8;
const PAD_BOTTOM_LARGE = 4;
// Matches the project's card / pill borderRadius (16–20) so the spotlight
// reads as a slightly puffed-out version of the element it highlights,
// rather than a stadium pill that swallows the rounded-corner aesthetic.
const CORNER_RADIUS = 20;
// A target is "stadium-shaped" only when it's small AND close to square.
// Wide-but-short bars (aspect > ~1.7) fall through to rounded rect so
// their cutout doesn't end in two giant semicircles.
const STADIUM_MAX_SIDE = 220;
const STADIUM_MAX_ASPECT = 1.7;
// Settings + History both use a ScrollView with paddingHorizontal: 24.
// react-native-copilot's `measure()` callback inside that ScrollView
// (and inside the Animated.View that drives the slide transform) reports
// the element's pageX as 0 even when the element is actually indented by
// the ScrollView padding — so a cutout drawn from that x sits flush
// against the screen edge while the highlighted element is centred. If
// the computed cutout would bleed past the project's content padding
// on either side, re-inset it so the spotlight matches what the user
// actually sees. CONTENT_BLEED_TOLERANCE keeps a couple of pixels of
// slack so a normally-positioned element doesn't trip the clamp.
const CONTENT_INSET = 24;
const CONTENT_BLEED_TOLERANCE = 4;

// Animated.Value exposes its current numeric reading via `_value`, but
// it's not in the public type. Read it through a narrow cast so the
// signature still matches the library's SvgMaskPathFunction.
const read = (v: Animated.Value): number => (v as unknown as { _value: number })._value;

export function roundedSvgMaskPath({ size, position, canvasSize }: MaskArgs): string {
  const rawW = read(size.x);
  const rawH = read(size.y);

  const minSide = Math.min(rawW, rawH);
  const maxSide = Math.max(rawW, rawH);
  // Aspect ratio guard — a "tall but wide" element (Allow some apps row,
  // Screen block group) shouldn't render as a stadium with two huge
  // semicircle ends. Only treat genuinely small + square-ish targets
  // (icons, the yes pill) as stadium.
  const aspectRatio = minSide > 0 ? maxSide / minSide : 1;
  const isStadium =
    maxSide <= STADIUM_MAX_SIDE && aspectRatio <= STADIUM_MAX_ASPECT;
  const isLarge = !isStadium;

  const padX = isLarge ? PAD_X_LARGE : PAD_SMALL;
  const padTop = isLarge ? PAD_TOP_LARGE : PAD_SMALL;
  const padBottom = isLarge ? PAD_BOTTOM_LARGE : PAD_SMALL;

  let x = read(position.x) - padX;
  const y = read(position.y) - padTop;
  let w = rawW + padX * 2;
  const h = rawH + padTop + padBottom;

  // Re-inset cutouts that bleed past the project's content padding.
  // See note on CONTENT_INSET — this fixes the systematic measure()
  // miscount for elements rendered inside ScrollView paddingHorizontal.
  // Limit the fix to rounded-rect targets (content-width sections like
  // "Allow some apps"). Stadium targets are small icons / pills that
  // sit at fixed positions and measure correctly, so clamping them
  // here would expand a 24×24 settings icon into a screen-wide bar.
  if (isLarge) {
    const bleedsLeft = x < CONTENT_INSET - CONTENT_BLEED_TOLERANCE;
    const bleedsRight = x + w > canvasSize.x - CONTENT_INSET + CONTENT_BLEED_TOLERANCE;
    if (bleedsLeft || bleedsRight) {
      x = CONTENT_INSET;
      w = canvasSize.x - CONTENT_INSET * 2;
    }
  }

  // Stadium → radius = half the short side (perfect circle for a square,
  // pill for a tall narrow button).
  // Rounded rect → CORNER_RADIUS, but never larger than half the short
  // side so a tiny target can't end up with a radius bigger than itself.
  const r = isStadium
    ? Math.min(w, h) / 2
    : Math.min(CORNER_RADIUS, Math.min(w, h) / 2);

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
