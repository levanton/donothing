/**
 * Single source of truth for where the shared RadialDots field sits on the
 * "now." / "what if…" screens. Both the route (which renders the absolute dot
 * layer) and the screens (which bottom-align their text right above it) read
 * from here, so the text and the field can never drift apart.
 */
export function getDotFieldLayout(width: number, height: number) {
  const size = Math.min(width * 0.9, height * 0.44, 350) * 0.9;
  const centerY = height * 0.67;
  return {
    size,
    centerY,
    /** Y of the field's top edge — the text should end just above this. */
    top: centerY - size / 2,
    left: (width - size) / 2,
  };
}
