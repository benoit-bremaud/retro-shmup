import { describe, expect, it } from 'vitest';
import { FLAG_ALIASES, FlagBank } from '../../src/adapters/flag-bank';
import { FLAG_SHEET_CODES } from '../../src/adapters/flag-codes';
import type { BakeCanvas, BakeSurface } from '../../src/adapters/sprite-bank';
import { COUNTRY_CODES } from '../../src/domain/hall-of-fame/country-codes';

const sheet = { name: 'flags.png' } as unknown as CanvasImageSource;

/** A baking canvas that records where it copied its cell from. */
function recordingCanvas(sources: string[]): BakeCanvas {
  const surface: BakeSurface = {
    imageSmoothingEnabled: true,
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    fillRect: () => undefined,
    drawImage: (_image, sx, sy, sw, sh) => {
      sources.push([sx, sy, sw, sh, String(surface.imageSmoothingEnabled)].join(','));
    },
    translate: () => undefined,
    scale: () => undefined,
  };
  return { surface, image: { id: sources.length } as unknown as CanvasImageSource };
}

/** The codes shown alone (ADR-0028 decision 3): no file in the set, no parent, or not CC0 (GG). */
const CODE_ALONE = ['AQ', 'CW', 'GG', 'IM', 'SS', 'SX'];

describe('FlagBank (ADR-0028)', () => {
  it('is empty until baked', () => {
    expect(new FlagBank().get('FR')).toBeUndefined();
  });

  it('copies each 16 x 11 cell of the sheet, 16 per row, without smoothing', () => {
    const sources: string[] = [];
    const bank = new FlagBank();
    bank.bake(sheet, () => recordingCanvas(sources));
    expect(sources[0]).toBe('0,0,16,11,false');
    expect(sources[17]).toBe('16,11,16,11,false');
    expect(bank.get('FR')).toBeDefined();
  });

  it('gives an aliased territory its parent flag', () => {
    const bank = new FlagBank();
    bank.bake(sheet, () => recordingCanvas([]));
    expect(bank.get('BL')).toBe(bank.get('FR'));
    expect(bank.get('BQ')).toBe(bank.get('NL'));
  });

  it('has a flag or an alias for every allowlisted code but the code-alone list', () => {
    const covered = new Set([...FLAG_SHEET_CODES, ...Object.keys(FLAG_ALIASES)]);
    const alone = [...COUNTRY_CODES].filter((code) => !covered.has(code));
    expect(alone).toEqual(CODE_ALONE);
    expect(FLAG_SHEET_CODES.every((code) => COUNTRY_CODES.has(code))).toBe(true);
  });
});
