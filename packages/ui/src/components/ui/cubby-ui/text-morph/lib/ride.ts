export function ownShift(from: number, measured: number): number | undefined {
  return [from, -from, from / 2, -from / 2].find(
    (x) => Math.abs(x - measured) < 0.05
  );
}

/**
 * The share of its width a box's glyphs move by as it resizes (all of the
 * change pinned at the end, half centred), for a ride in CSS: layout rounds
 * the ride and the width it follows from the same number each frame, where
 * a ride animated beside the width rounded on its own and stepped the
 * glyphs back and forth.
 */
export function followShare(
  from: number,
  measured: number
): number | undefined {
  const share = -measured / from;
  return [-1, -0.5, 0.5, 1].find((f) => Math.abs(f - share) < 0.01);
}
