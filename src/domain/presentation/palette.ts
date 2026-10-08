/** Colour tokens: every colour drawn by the game comes from here, never from a literal. */
export const Palette = {
  background: '#05060f',
  hudBand: '#0b0d1c',
  hudEdge: '#1c2340',
  starFar: '#3a4466',
  starMid: '#7f8fb8',
  starNear: '#e8ecff',
} as const;

export type PaletteColour = (typeof Palette)[keyof typeof Palette];
