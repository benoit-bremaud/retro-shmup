import { describe, expect, it } from 'vitest';
import { ChampionName, ChampionTuning } from '../../src/domain/presentation/champion-name';
import { MENU_FONT_CELL } from '../../src/domain/ports/render-port';
import { FIELD_HEIGHT, FIELD_WIDTH } from '../../src/domain/presentation/screen';
import { STARFIELD_LAYERS } from '../../src/domain/presentation/starfield';
import { RecordingRender } from '../support/recording-render';
import type { RecordedText } from '../support/recording-render';

function named(name: string, random: () => number = () => 0.5): ChampionName {
  const champion = new ChampionName(random);
  champion.setName(name);
  return champion;
}

function drawAt(champion: ChampionName, runSeconds: number): RecordedText[] {
  const render = new RecordingRender();
  champion.draw(render, runSeconds);
  return render.texts;
}

describe('ChampionName (GDD v0.22 §9.4.1)', () => {
  it('moves at the far star layer speed', () => {
    expect(ChampionTuning.speed).toBe(STARFIELD_LAYERS[0]?.speed);
  });

  it('draws nothing before the first pass', () => {
    expect(drawAt(named('ACE'), ChampionTuning.firstAtS - 0.1)).toEqual([]);
  });

  it('enters from just above the field in the far font', () => {
    const [text] = drawAt(named('ACE'), ChampionTuning.firstAtS);
    expect(text).toMatchObject({ text: 'ACE', y: -MENU_FONT_CELL.height, font: 'far' });
  });

  it('scrolls down at its speed and leaves the field before the next pass', () => {
    const champion = named('ACE');
    const [text] = drawAt(champion, ChampionTuning.firstAtS + 10);
    expect(text?.y).toBe(-MENU_FONT_CELL.height + 10 * ChampionTuning.speed);
    const crossS = (FIELD_HEIGHT + MENU_FONT_CELL.height) / ChampionTuning.speed;
    expect(drawAt(champion, ChampionTuning.firstAtS + crossS + 0.1)).toEqual([]);
    expect(crossS).toBeLessThan(ChampionTuning.everyS);
  });

  it('comes back every period with a new x, kept for the whole pass, inside the field', () => {
    const draws = [0.9, 0.1];
    let index = 0;
    const champion = named('CHAMPION', () => draws[index++ % draws.length] ?? 0);
    const first = drawAt(champion, ChampionTuning.firstAtS)[0];
    const same = drawAt(champion, ChampionTuning.firstAtS + 5)[0];
    const next = drawAt(champion, ChampionTuning.firstAtS + ChampionTuning.everyS)[0];
    expect(same?.x).toBe(first?.x);
    expect(next?.x).not.toBe(first?.x);
    for (const text of [first, next]) {
      expect(text?.x).toBeGreaterThanOrEqual(0);
      expect((text?.x ?? 0) + 8 * MENU_FONT_CELL.width).toBeLessThanOrEqual(FIELD_WIDTH);
    }
  });

  it('draws nothing for an empty or blank name', () => {
    expect(drawAt(named(''), ChampionTuning.firstAtS)).toEqual([]);
    expect(drawAt(named('   '), ChampionTuning.firstAtS)).toEqual([]);
    expect(drawAt(new ChampionName(() => 0), ChampionTuning.firstAtS)).toEqual([]);
  });

  it('draws a new x for a new name even within the same pass', () => {
    const draws = [0.1, 0.9];
    let index = 0;
    const champion = named('ACE', () => draws[index++ % draws.length] ?? 0);
    const first = drawAt(champion, ChampionTuning.firstAtS)[0];
    champion.setName('BOB');
    const second = drawAt(champion, ChampionTuning.firstAtS)[0];
    expect(second?.x).not.toBe(first?.x);
  });
});
