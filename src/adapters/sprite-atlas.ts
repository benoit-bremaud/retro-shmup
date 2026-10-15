import type { SpriteId } from '../domain/ports/render-port';

/** The two packed sheets of Kenney's Pixel Shmup under `public/assets/sprites/` (CREDITS.md). */
export type SheetId = 'ships' | 'tiles';

/** Side of a sheet's square cell in sheet pixels; the packed sheets have no spacing. */
export const CELL_SIZE: Readonly<Record<SheetId, number>> = { ships: 32, tiles: 16 };

/** Where a sprite comes from and how it is baked (render/04-class-sprites). */
export interface SpriteCell {
  readonly sheet: SheetId;
  readonly column: number;
  readonly row: number;
  readonly scale: 1 | 2;
  /** Turned nose up: the pack draws every ship nose down (the player only). */
  readonly flipY: boolean;
}

// Ship n of the pack sits at column n % 4, row n / 4 of the ships sheet.
function ship(n: number, scale: 1 | 2 = 1, flipY = false): SpriteCell {
  return { sheet: 'ships', column: n % 4, row: Math.floor(n / 4), scale, flipY };
}

/** The pack cell of every sprite (GDD v0.17 §3.2.1); a `Record`, so a missing id does not compile. */
export const SPRITE_CELLS: Readonly<Record<SpriteId, SpriteCell>> = {
  player: ship(0, 1, true),
  popcorn: ship(10),
  diver: ship(9),
  gunner: ship(7),
  carrier: ship(4),
  heavy: ship(2, 2),
  cruiserHull: ship(12, 2),
  cruiserWing: ship(16),
  // tile_0016, the grey turret: column 4, row 1 of the 12-column tiles sheet.
  cruiserTurret: { sheet: 'tiles', column: 4, row: 1, scale: 1, flipY: false },
};
