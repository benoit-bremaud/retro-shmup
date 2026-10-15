import { describe, expect, it } from 'vitest';
import { SpriteBank } from '../../src/adapters/sprite-bank';
import type { BakeCanvas, BakeSurface } from '../../src/adapters/sprite-bank';
import { SPRITE_IDS } from '../../src/domain/ports/render-port';
import { Palette } from '../../src/domain/presentation/palette';
import type { SpriteId } from '../../src/domain/ports/render-port';

/** A baking canvas that records its size and the calls made on its surface. */
class RecordingBakeSurface implements BakeSurface {
  imageSmoothingEnabled = true;
  globalCompositeOperation: GlobalCompositeOperation = 'source-over';
  fillStyle: string | CanvasGradient | CanvasPattern = '';
  readonly calls: string[] = [];
  drawImage(
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void {
    const sheet = image === ships ? 'ships' : image === tiles ? 'tiles' : 'baked';
    const smoothing = String(this.imageSmoothingEnabled);
    this.calls.push(
      `drawImage ${sheet} smoothing=${smoothing} ${[sx, sy, sw, sh, dx, dy, dw, dh].join(',')}`,
    );
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    const style = typeof this.fillStyle === 'string' ? this.fillStyle : 'non-colour';
    const box = [x, y, w, h].join(',');
    this.calls.push(`fillRect ${this.globalCompositeOperation} ${style} ${box}`);
  }
  translate(x: number, y: number): void {
    this.calls.push(`translate ${[x, y].join(',')}`);
  }
  scale(x: number, y: number): void {
    this.calls.push(`scale ${[x, y].join(',')}`);
  }
}

// Two distinct stand-ins: the recording surface tells the sheets apart by identity.
const ships = {} as CanvasImageSource;
const tiles = {} as CanvasImageSource;

function bakeAll(): { bank: SpriteBank; canvases: Map<CanvasImageSource, RecordingBakeSurface> } {
  const bank = new SpriteBank();
  const canvases = new Map<CanvasImageSource, RecordingBakeSurface>();
  bank.bake(ships, tiles, (): BakeCanvas => {
    const surface = new RecordingBakeSurface();
    const image = {} as CanvasImageSource;
    canvases.set(image, surface);
    return { surface, image };
  });
  return { bank, canvases };
}

function callsOf(id: SpriteId): string[] {
  const { bank, canvases } = bakeAll();
  const sprite = bank.get(id);
  if (sprite === undefined) throw new Error(`${id} not baked`);
  return canvases.get(sprite.image)?.calls ?? [];
}

describe('SpriteBank (GDD v0.17 §3.2.1, ADR-0001 amendment)', () => {
  it('has no sprite before the bake, so the presentation keeps its shapes', () => {
    const bank = new SpriteBank();
    for (const id of SPRITE_IDS) {
      expect(bank.get(id)).toBeUndefined();
    }
  });

  it('bakes every sprite id into its own canvas', () => {
    const { bank, canvases } = bakeAll();
    // One canvas for the sprite, one for its white flash silhouette.
    expect(canvases.size).toBe(2 * SPRITE_IDS.length);
    for (const id of SPRITE_IDS) {
      expect(bank.get(id)).toBeDefined();
    }
  });

  // The pack's cell of each entity (ship n at column n % 4, row n / 4 of the 32 px ships sheet).
  it.each([
    ['popcorn', '64,64'],
    ['diver', '32,64'],
    ['gunner', '96,32'],
    ['carrier', '0,32'],
    ['cruiserWing', '0,128'],
  ] as const)('copies the %s cell of the ships sheet at 1×, smoothing off', (id, corner) => {
    expect(callsOf(id)).toEqual([`drawImage ships smoothing=false ${corner},32,32,0,0,32,32`]);
  });

  it.each([
    ['heavy', 'ships smoothing=false 64,0,32,32,0,0,64,64'],
    ['cruiserHull', 'ships smoothing=false 0,96,32,32,0,0,64,64'],
  ] as const)('scales the %s cell 2× with nearest neighbour', (id, call) => {
    expect(callsOf(id)).toEqual([`drawImage ${call}`]);
  });

  it('takes the turret from the 16 px tiles sheet (tile 16: column 4, row 1)', () => {
    expect(callsOf('cruiserTurret')).toEqual([
      'drawImage tiles smoothing=false 64,16,16,16,0,0,16,16',
    ]);
  });

  it('turns the player ship nose up: a vertical flip before the copy', () => {
    expect(callsOf('player')).toEqual([
      'translate 0,32',
      'scale 1,-1',
      'drawImage ships smoothing=false 0,0,32,32,0,0,32,32',
    ]);
  });

  it('keeps nothing when a canvas fails midway: never half sprites, half shapes', () => {
    const bank = new SpriteBank();
    let made = 0;

    expect(() => {
      bank.bake(ships, tiles, (): BakeCanvas => {
        made += 1;
        if (made === 3) throw new Error('no canvas');
        return { surface: new RecordingBakeSurface(), image: {} as CanvasImageSource };
      });
    }).toThrow('no canvas');
    for (const id of SPRITE_IDS) {
      expect(bank.get(id)).toBeUndefined();
    }
  });

  it.each(['player', 'heavy', 'cruiserTurret'] as const)(
    'bakes the white flash silhouette of %s from its own baked canvas (§9.4)',
    (id) => {
      const { bank, canvases } = bakeAll();
      const sprite = bank.get(id);
      if (sprite === undefined) throw new Error(`${id} not baked`);
      const side = String(sprite.width);
      const box = `0,0,${side},${side}`;
      expect(canvases.get(sprite.flash)?.calls).toEqual([
        `drawImage baked smoothing=false ${box},${box}`,
        `fillRect source-in ${Palette.hitFlash} ${box}`,
      ]);
    },
  );

  it('reports each baked size, so the renderer centres the sprite', () => {
    const { bank } = bakeAll();
    expect(bank.get('popcorn')).toMatchObject({ width: 32, height: 32 });
    expect(bank.get('heavy')).toMatchObject({ width: 64, height: 64 });
    expect(bank.get('cruiserTurret')).toMatchObject({ width: 16, height: 16 });
  });
});
