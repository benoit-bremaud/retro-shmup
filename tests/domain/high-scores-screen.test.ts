import { describe, expect, it } from 'vitest';
import { HighScoreTable } from '../../src/domain/hall-of-fame/high-scores';
import type { HighScoreEntry } from '../../src/domain/hall-of-fame/high-scores';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';
import { HighScoresScreen } from '../../src/domain/scenes/high-scores-screen';

function frame(edit: Partial<IntentFrame> = {}): IntentFrame {
  return Object.assign(createIntentFrame(), edit);
}

const ACE: HighScoreEntry = {
  name: 'ACE',
  country: 'FR',
  score: 125400,
  level: 1,
  date: '2026-10-15',
};
const BOB: HighScoreEntry = { name: 'BIG BOB', score: 900, level: 1, date: '2026-10-15' };

function opened(highlighted = -1): HighScoresScreen {
  const screen = new HighScoresScreen();
  screen.open(new HighScoreTable([ACE, BOB]), highlighted);
  return screen;
}

describe('HighScoresScreen — rows (GDD v0.16 §9.1)', () => {
  it('formats ten rows once: rank, name, country, score, level; dashes for an empty rank', () => {
    const screen = opened();
    expect(screen.rows).toHaveLength(10);
    expect(screen.rows[0]).toEqual({
      rank: '1',
      name: 'ACE',
      country: 'FR',
      score: '125400',
      level: '1',
    });
    expect(screen.rows[1]).toEqual({
      rank: '2',
      name: 'BIG BOB',
      country: '',
      score: '900',
      level: '1',
    });
    expect(screen.rows[9]).toEqual({
      rank: '10',
      name: '--------',
      country: '',
      score: '-------',
      level: '',
    });
  });

  it('highlights the given rank, or none', () => {
    expect(opened(1).highlighted).toBe(1);
    expect(opened().highlighted).toBe(-1);
  });
});

describe('HighScoresScreen — leaving (GDD v0.16 §9.1)', () => {
  it.each([
    ['confirm', frame({ pressed: Button.Confirm })],
    ['back', frame({ pressed: Button.Back })],
  ])('leaves on %s', (_label, input) => {
    expect(opened().step(input)).toBe(true);
  });

  it('leaves on a tap started on the screen, not on a release alone', () => {
    const screen = opened();
    expect(screen.step(frame({ releaseRegion: 'field' }))).toBe(false); // the opening press
    expect(screen.step(frame({ tapRegion: 'field' }))).toBe(false);
    expect(screen.step(frame({ releaseRegion: 'field' }))).toBe(true);
  });

  it('ignores Pause', () => {
    expect(opened().step(frame({ pressed: Button.Pause }))).toBe(false);
  });
});
