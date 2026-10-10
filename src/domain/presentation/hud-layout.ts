/**
 * Where the HUD contents sit in the left band (GDD §9.2, meta/05-state-scenes): one record, in
 * HUD-region pixels, top to bottom in §9.2 order with margins of at least 8 px. Landscape only
 * until C2 adds the portrait strip.
 */
export const HUD_LAYOUT = {
  /** 8 digits, zero-padded. */
  score: { x: 8, y: 8, digits: 8 },
  /** `×` then one digit. */
  multiplier: { x: 8, y: 24 },
  chainBar: { x: 8, y: 38, width: 64, height: 4 },
  lives: { x: 8, y: 52, size: 8, spacing: 12 },
} as const;
