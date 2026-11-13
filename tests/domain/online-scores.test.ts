import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '../../src/domain/input/default-bindings';
import type { Options } from '../../src/domain/options';
import { Run, RunOutcome } from '../../src/domain/game/run';
import { KEPT_RUNS_KEY } from '../../src/domain/online/kept-runs';
import { OnlineRuns } from '../../src/domain/online/online-runs';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';
import type { LinkPort } from '../../src/domain/ports/link-port';
import { Starfield } from '../../src/domain/presentation/starfield';
import { OnlineScoresScreen } from '../../src/domain/scenes/online-scores';
import { NO_HOST } from '../../src/domain/scenes/scene-host';
import { Scene, SceneMachine } from '../../src/domain/scenes/scene-machine';
import { FakePort, MemoryStore } from '../support/leaderboard-fakes';
import { RecordingRender } from '../support/recording-render';

const DT = 1 / 60;
const TOKEN = 'b'.repeat(64);

const OPTIONS: Options = {
  effects: {
    blink: true,
    hitFlash: true,
    explosions: true,
    shake: true,
    bombFlash: true,
    slowMotion: true,
    championName: true,
    graze: true,
    chainHints: true,
  },
  autofire: false,
  language: 'en',
  fullscreen: false,
  bindings: DEFAULT_BINDINGS,
  musicVolume: 7,
  sfxVolume: 8,
  country: 'FR',
};

const NO_LINK: LinkPort = { arm: () => undefined, takeOutcome: () => 'none' };

/** The id of kept run `i` (a valid ULID). */
function idOf(i: number): string {
  return `01JC${String(i).padStart(22, '0')}`;
}

/** The text of kept run `i`'s row: its score `i + 1` right-aligned, then the date. */
function rowOf(i: number): string {
  return `${String(i + 1).padStart(7)}  2026-11-1${String(i % 10)}`;
}

function keptDocument(count: number): string {
  const runs = Array.from({ length: count }, (_, i) => ({
    id: idOf(i),
    token: TOKEN,
    score: i + 1,
    sentAt: `2026-11-1${String(i % 10)}T10:00:00.000Z`,
    status: i === 0 ? 'verified' : 'pending',
  }));
  return JSON.stringify({ v: 1, runs });
}

interface Fixture {
  machine: SceneMachine;
  render: RecordingRender;
  port: FakePort;
}

function playing(): ReturnType<ConstructorParameters<typeof SceneMachine>[3]> {
  const real = new Run();
  return {
    seed: 9,
    step: (): void => undefined,
    outcome: (): RunOutcome => RunOutcome.Playing,
    snapshot: () => real.snapshot(),
    events: () => real.events(),
    tally: () => real.tally(),
  };
}

function setup(kept: number, withOnline = true): Fixture {
  const render = new RecordingRender();
  const port = new FakePort();
  const store = new MemoryStore();
  if (kept > 0) store.values.set(KEPT_RUNS_KEY, keptDocument(kept));
  const online = new OnlineRuns(port, store, () => '2026-11-13T10:00:00.000Z');
  const machine = new SceneMachine(
    render,
    new Starfield(() => 0.5),
    OPTIONS,
    playing,
    NO_HOST,
    [],
    withOnline
      ? { online: { runs: online, privacy: 'https://lb.example.fr/privacy', link: NO_LINK } }
      : {},
  );
  machine.step(DT, createIntentFrame()); // Boot → Title
  idle(machine, 70);
  return { machine, render, port };
}

function idle(machine: SceneMachine, steps = 1): void {
  for (let i = 0; i < steps; i += 1) machine.step(DT, createIntentFrame());
}

function pressed(buttons: number): IntentFrame {
  const frame = createIntentFrame();
  frame.pressed = buttons;
  return frame;
}

function press(machine: SceneMachine, button: number): void {
  machine.step(DT, pressed(button));
  machine.step(DT, createIntentFrame());
}

function move(machine: SceneMachine, y: number, times = 1): void {
  for (let i = 0; i < times; i += 1) {
    const frame = createIntentFrame();
    frame.moveKind = 'direction';
    frame.moveY = y;
    machine.step(DT, frame);
    machine.step(DT, createIntentFrame());
  }
}

function texts(fixture: Fixture): string[] {
  fixture.render.texts.length = 0;
  fixture.machine.render(1, 16);
  return fixture.render.texts.filter((t) => t.region === 'field').map((t) => t.text);
}

/** The field y of the text drawn as `label`, for a tap on its row. */
function textY(fixture: Fixture, label: string): number {
  texts(fixture);
  return fixture.render.texts.find((t) => t.text === label)?.y ?? -1;
}

/** A tap pressed and released at field y, then a quiet step. */
function tap(machine: SceneMachine, y: number): void {
  const frame = createIntentFrame();
  frame.tapRegion = 'field';
  frame.tapX = 120;
  frame.tapY = y;
  frame.releaseRegion = 'field';
  frame.releaseX = 120;
  frame.releaseY = y;
  machine.step(DT, frame);
  machine.step(DT, createIntentFrame());
}

/** The title's Options: Play, High scores, then Options. */
function toOptions(machine: SceneMachine): void {
  move(machine, 1, 2);
  press(machine, Button.Confirm);
  expect(machine.scene).toBe(Scene.TitleOptions);
}

/** On *Online scores*: from the options' first row, up twice wraps to the row before *BACK*. */
function onScores(kept: number): Fixture {
  const fixture = setup(kept);
  toOptions(fixture.machine);
  move(fixture.machine, -1, 2);
  press(fixture.machine, Button.Confirm);
  expect(fixture.machine.scene).toBe(Scene.OnlineScores);
  return fixture;
}

/** Answers the status requests in order, as kept (run 0 verified), unless `answers` says otherwise. */
function answer(fixture: Fixture, count: number, answers: Record<number, 'unknown'> = {}): void {
  for (let i = 0; i < count; i += 1) {
    fixture.port.statuses[i]?.done(answers[i] ?? (i === 0 ? 'verified' : 'pending'));
    idle(fixture.machine);
  }
}

/** Erases the highlighted run: the confirmation, then Yes. */
function eraseHighlighted(machine: SceneMachine): void {
  press(machine, Button.Confirm);
  expect(machine.scene).toBe(Scene.ScoresErase);
  move(machine, 1);
  press(machine, Button.Confirm);
}

describe('Online scores — the options row (GDD v0.39 §9.3)', () => {
  it('shows ONLINE SCORES before BACK in the title options with a leaderboard', () => {
    const fixture = setup(0);
    toOptions(fixture.machine);
    const shown = texts(fixture);
    expect(shown.indexOf('ONLINE SCORES')).toBe(shown.indexOf('BACK') - 1);
  });

  it('shows no ONLINE SCORES without a leaderboard', () => {
    const fixture = setup(0, false);
    toOptions(fixture.machine);
    expect(texts(fixture)).not.toContain('ONLINE SCORES');
  });

  it('shows no ONLINE SCORES in the pause options', () => {
    const fixture = setup(0);
    press(fixture.machine, Button.Confirm); // Play
    press(fixture.machine, Button.Pause);
    move(fixture.machine, 1); // Options
    press(fixture.machine, Button.Confirm);
    expect(fixture.machine.scene).toBe(Scene.PauseOptions);
    expect(texts(fixture)).not.toContain('ONLINE SCORES');
  });
});

describe('Online scores — the list (GDD v0.39 §9.3, UC10)', () => {
  it('shows NO ONLINE SCORE and BACK when no run is kept', () => {
    const fixture = onScores(0);
    expect(texts(fixture)).toEqual(['ONLINE SCORES', 'NO ONLINE SCORE', 'BACK']);
  });

  it('shows each run as score and date, the highlighted run status under the heading', () => {
    const fixture = onScores(2);
    expect(texts(fixture)).toEqual(['ONLINE SCORES', 'VERIFIED', rowOf(0), rowOf(1), 'BACK']);
    move(fixture.machine, 1);
    expect(texts(fixture)[1]).toBe('PENDING VERIFICATION');
    move(fixture.machine, 1); // BACK: no status line
    expect(texts(fixture)).toEqual(['ONLINE SCORES', rowOf(0), rowOf(1), 'BACK']);
  });

  it('asks every kept run its status, one at a time', () => {
    const fixture = onScores(3);
    answer(fixture, 3);
    expect(fixture.port.asked).toEqual([idOf(0), idOf(1), idOf(2)]);
  });

  it('shows 10 runs, NEXT and BACK on page 1, the rest, PREV and BACK on page 2', () => {
    const fixture = onScores(12);
    const page1 = texts(fixture);
    expect(page1).toHaveLength(14); // heading, status, 10 runs, NEXT, BACK
    expect(page1.slice(-2)).toEqual(['NEXT', 'BACK']);
    move(fixture.machine, -1, 2); // NEXT
    press(fixture.machine, Button.Confirm);
    expect(texts(fixture)).toEqual([
      'ONLINE SCORES',
      'PENDING VERIFICATION',
      rowOf(10),
      rowOf(11),
      'PREV',
      'BACK',
    ]);
    move(fixture.machine, 1, 2); // PREV
    press(fixture.machine, Button.Confirm);
    expect(texts(fixture)[1]).toBe('VERIFIED'); // page 1, its first row
  });

  it('leaves for the options on BACK and on back, asking no more status', () => {
    const fixture = onScores(3);
    press(fixture.machine, Button.Back);
    expect(fixture.machine.scene).toBe(Scene.TitleOptions);
    answer(fixture, 3);
    expect(fixture.port.asked).toEqual([idOf(0)]);
    move(fixture.machine, -1, 2);
    press(fixture.machine, Button.Confirm);
    move(fixture.machine, -1); // BACK
    press(fixture.machine, Button.Confirm);
    expect(fixture.machine.scene).toBe(Scene.TitleOptions);
  });
});

describe('Online scores — erasing a run (GDD v0.37, v0.39 §9.3)', () => {
  it('asks first, No highlighted: No and back return to the list, erasing nothing', () => {
    const fixture = onScores(2);
    press(fixture.machine, Button.Confirm);
    expect(fixture.machine.scene).toBe(Scene.ScoresErase);
    press(fixture.machine, Button.Confirm); // No
    expect(fixture.machine.scene).toBe(Scene.OnlineScores);
    press(fixture.machine, Button.Confirm);
    press(fixture.machine, Button.Back);
    expect(fixture.machine.scene).toBe(Scene.OnlineScores);
    expect(fixture.port.erased).toEqual([]);
  });

  it('erases the highlighted run on Yes, then highlights the next one', () => {
    const fixture = onScores(3);
    answer(fixture, 3);
    move(fixture.machine, 1); // run 1
    eraseHighlighted(fixture.machine);
    expect(fixture.port.erased).toEqual([[idOf(1), TOKEN]]);
    fixture.port.erases[0]?.done('erased');
    idle(fixture.machine);
    eraseHighlighted(fixture.machine);
    expect(fixture.port.erased[1]).toEqual([idOf(2), TOKEN]);
  });

  it('highlights the previous run when the last one is erased', () => {
    const fixture = onScores(2);
    answer(fixture, 2);
    move(fixture.machine, 1);
    eraseHighlighted(fixture.machine);
    fixture.port.erases[0]?.done('erased');
    idle(fixture.machine);
    expect(texts(fixture)).toEqual(['ONLINE SCORES', 'VERIFIED', rowOf(0), 'BACK']);
  });

  it('shows NO ONLINE SCORE once the only run is erased', () => {
    const fixture = onScores(1);
    answer(fixture, 1);
    eraseHighlighted(fixture.machine);
    fixture.port.erases[0]?.done('erased');
    idle(fixture.machine);
    expect(texts(fixture)).toEqual(['ONLINE SCORES', 'NO ONLINE SCORE', 'BACK']);
  });

  it('shows the error line of a failed erasure at the foot', () => {
    const fixture = onScores(1);
    answer(fixture, 1);
    eraseHighlighted(fixture.machine);
    fixture.port.erases[0]?.fail('server-error');
    idle(fixture.machine);
    expect(texts(fixture)).toContain('SERVER ERROR');
  });

  it('shows WAIT when the erasure meets another one under way', () => {
    const fixture = onScores(2);
    answer(fixture, 2);
    eraseHighlighted(fixture.machine);
    move(fixture.machine, 1);
    eraseHighlighted(fixture.machine);
    expect(texts(fixture)).toContain('WAIT');
    expect(fixture.port.erased).toHaveLength(1);
  });
});

describe('Online scores — the highlight across pages (GDD v0.39 §9.3)', () => {
  it('takes the view to page 1 with its run when a page-1 run is dropped', () => {
    const fixture = onScores(12);
    move(fixture.machine, -1, 2); // NEXT
    press(fixture.machine, Button.Confirm); // page 2, run 10 highlighted
    answer(fixture, 1, { 0: 'unknown' }); // run 0 dropped: run 10 moves to page 1
    expect(texts(fixture)).toContain('NEXT');
    eraseHighlighted(fixture.machine);
    fixture.port.statuses[1]?.done('pending'); // the erasure waits for the status in flight
    idle(fixture.machine);
    expect(fixture.port.erased).toEqual([[idOf(10), TOKEN]]);
  });

  it('closes an emptied page 2 to page 1, its first row highlighted', () => {
    const fixture = onScores(11);
    move(fixture.machine, -1, 2); // NEXT
    press(fixture.machine, Button.Confirm);
    move(fixture.machine, 1); // PREV
    answer(fixture, 11, { 10: 'unknown' });
    const shown = texts(fixture);
    expect(shown).not.toContain('PREV');
    expect(shown[1]).toBe('VERIFIED');
  });

  it('moves a vanished NEXT highlight to BACK', () => {
    const fixture = onScores(11);
    move(fixture.machine, -1, 2); // NEXT
    answer(fixture, 1, { 0: 'unknown' });
    expect(texts(fixture)).not.toContain('NEXT');
    press(fixture.machine, Button.Confirm);
    expect(fixture.machine.scene).toBe(Scene.TitleOptions);
  });

  it('keeps a highlighted PREV on page 2 while it holds runs', () => {
    const fixture = onScores(12);
    move(fixture.machine, -1, 2);
    press(fixture.machine, Button.Confirm);
    move(fixture.machine, 1, 2); // PREV
    answer(fixture, 1, { 0: 'unknown' });
    expect(texts(fixture)).toContain('PREV');
  });
});

describe('Online scores — guards against a doubled press (GDD §9.1)', () => {
  it('keeps the menu, and a press under way, when a status answer changes no row', () => {
    const screen = new OnlineScoresScreen();
    const run = { id: idOf(0), token: TOKEN, score: 1, sentAt: '2026-11-10T10:00:00.000Z' };
    screen.open([{ ...run, status: 'pending' }], 0, createIntentFrame());
    const menu = screen.menu;
    screen.sync([{ ...run, status: 'verified' }], createIntentFrame());
    expect(screen.menu).toBe(menu);
    expect(screen.status).toBe('verified');
  });

  it('stays on page 2 when NEXT is tapped twice in a row', () => {
    const fixture = onScores(20);
    idle(fixture.machine, 10); // past the screen's own opening guard
    const y = textY(fixture, 'NEXT'); // PREV takes this row on page 2
    tap(fixture.machine, y);
    expect(texts(fixture)).toContain('PREV');
    tap(fixture.machine, y); // within the opening guard
    expect(texts(fixture)).toContain('PREV');
  });

  it('stays on the list when No is tapped twice in a row', () => {
    const fixture = onScores(2);
    press(fixture.machine, Button.Confirm);
    idle(fixture.machine, 10);
    const y = textY(fixture, 'NO'); // a run row lies under it on the list
    tap(fixture.machine, y);
    expect(fixture.machine.scene).toBe(Scene.OnlineScores);
    tap(fixture.machine, y); // within the opening guard
    expect(fixture.machine.scene).toBe(Scene.OnlineScores);
  });

  it('highlights the previous run, on page 1, when page 2 loses its only run', () => {
    const fixture = onScores(11);
    move(fixture.machine, -1, 2); // NEXT
    press(fixture.machine, Button.Confirm); // page 2, run 10 highlighted
    answer(fixture, 11, { 10: 'unknown' });
    expect(texts(fixture)[1]).toBe('PENDING VERIFICATION'); // run 9, not run 0 (verified)
  });
});
