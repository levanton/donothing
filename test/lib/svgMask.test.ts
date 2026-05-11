/**
 * Tests for the spotlight cutout path generator. The real input type
 * is `Animated.ValueXY` which reads through a private `_value` field;
 * we pass plain objects shaped the same way so we can drive the
 * function in node without instantiating the RN animation runtime.
 */

import { roundedSvgMaskPath } from '@/lib/tutorial/svgMask';

function v(x: number, y: number) {
  return { x: { _value: x }, y: { _value: y } } as any;
}

function args(opts: {
  posX: number;
  posY: number;
  sizeX: number;
  sizeY: number;
  canvasX?: number;
  canvasY?: number;
}) {
  return {
    position: v(opts.posX, opts.posY),
    size: v(opts.sizeX, opts.sizeY),
    canvasSize: { x: opts.canvasX ?? 400, y: opts.canvasY ?? 800 },
  };
}

describe('roundedSvgMaskPath', () => {
  it('starts with the full-canvas outer rectangle', () => {
    const path = roundedSvgMaskPath(args({ posX: 100, posY: 200, sizeX: 60, sizeY: 60 }));
    // Outer rectangle: M0,0 H<canvasX> V<canvasY> H0 V0 Z
    expect(path).toMatch(/^M0,0H400V800H0V0Z\s/);
  });

  it('uses circular-radius geometry for a small square target', () => {
    // 60×60 + 12px symmetric padding → 84×84 inner, radius = 42.
    const path = roundedSvgMaskPath(args({ posX: 100, posY: 200, sizeX: 60, sizeY: 60 }));
    expect(path).toContain('a42,42'); // half of 84
  });

  it('uses fixed CORNER_RADIUS = 20 for wide/tall targets', () => {
    // 300×40 — wide bar → aspectRatio ~ 7.5 (> 1.7) → rounded-rect path with radius 20.
    const path = roundedSvgMaskPath(args({ posX: 50, posY: 200, sizeX: 300, sizeY: 40 }));
    expect(path).toContain('a20,20');
  });

  it('re-insets a content-width target that bleeds past the inset', () => {
    // Wide target reported at x=0 (the systematic ScrollView measure bug)
    // should clamp to CONTENT_INSET = 24 and width = canvasX - 48.
    const path = roundedSvgMaskPath(
      args({ posX: 0, posY: 200, sizeX: 400, sizeY: 80, canvasX: 400 }),
    );
    // After inset: x=24, w=352. First corner is at "M{x + r},{y - padTop}".
    // padTop for large = 8 → y = 192; r = 20 → first move = M44,192.
    expect(path).toContain('M44,192');
  });

  it('does NOT re-inset a stadium-shape target even at x=0', () => {
    // A 24×24 icon at x=0 — small + square = stadium. The clamp would
    // turn it into a screen-wide bar, which is exactly the bug the
    // implementation comments call out. r = min(48, 48) / 2 = 24.
    const path = roundedSvgMaskPath(
      args({ posX: 0, posY: 200, sizeX: 24, sizeY: 24, canvasX: 400 }),
    );
    expect(path).toContain('a24,24');
    // No re-inset means width stays small (24 + 12*2 = 48), not 400-48.
    expect(path).not.toContain('a20,20'); // would only appear if it became rounded-rect
  });
});
