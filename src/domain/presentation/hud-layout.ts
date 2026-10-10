/**
 * Where the HUD contents sit in the left band (GDD §9.2, meta/05-state-scenes): one record, in
 * HUD-region pixels, top to bottom in §9.2 order with margins of at least 8 px. Landscape only
 * until C2 adds the portrait strip.
 */
export const HUD_LAYOUT = {
  lives: { x: 8, y: 56, size: 8, spacing: 12 },
} as const;
