import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '../../src/domain/input/default-bindings';
import type { Options } from '../../src/domain/options';
import { Run, RunOutcome } from '../../src/domain/game/run';
import { KEPT_RUNS_KEY, MAX_KEPT_RUNS, parseKeptRuns } from '../../src/domain/online/kept-runs';
import { failureLine, statusLine } from '../../src/domain/online/online-lines';
import { OnlineRuns } from '../../src/domain/online/online-runs';
import { Button, createIntentFrame } from '../../src/domain/ports/input-port';
import type { IntentFrame } from '../../src/domain/ports/input-port';
import type { FailureCode } from '../../src/domain/ports/leaderboard-port';
import type { ArmedLink, LinkOutcome, LinkPort } from '../../src/domain/ports/link-port';
import { wrapLine } from '../../src/domain/presentation/overlays';
import { Starfield } from '../../src/domain/presentation/starfield';
import type { HighScoreEntry } from '../../src/domain/hall-of-fame/high-scores';
import { NO_HOST } from '../../src/domain/scenes/scene-host';
import { Scene, SceneMachine } from '../../src/domain/scenes/scene-machine';
import { FakePort, MemoryStore } from '../support/leaderboard-fakes';
import { RecordingRender } from '../support/recording-render';

const DT = 1 / 60;
const FORM = 'https://tally.so/r/abc123';
const PRIVACY = 'https://lb.example.fr/privacy';
const ID = '01JC0000000000000000000001';
const TOKEN = 'b'.repeat(64);

/** Ten scores no test run reaches: the run never enters the table. */
const FULL_TABLE: readonly HighScoreEntry[] = Array.from({ length: 10 }, () => ({
  name: 'ACE',
  score: 99_000_000,
  level: 1,
  date: '2026-10-15',
}));

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

class FakeLink implements LinkPort {
  readonly armings: (ArmedLink | undefined)[] = [];
  outcome: LinkOutcome = 'none';
  arm(link: ArmedLink | undefined): void {
    this.armings.push(link);
  }
  takeOutcome(): LinkOutcome {
    const outcome = this.outcome;
    this.outcome = 'none';
    return outcome;
  }
  get armed(): ArmedLink | undefined {
    return this.armings[this.armings.length - 1];
  }
}

/** A run of `score` points that ends in Game over on its first step, or plays on. */
function losing(
  score: number,
  outcome: RunOutcome = RunOutcome.GameOver,
): ReturnType<ConstructorParameters<typeof SceneMachine>[3]> {
  const real = new Run();
  return {
    seed: 9,
    step: (): void => undefined,
    outcome: (): RunOutcome => outcome,
    snapshot: () => ({ ...real.snapshot(), score }),
    events: () => real.events(),
    tally: () => real.tally(),
  };
}

interface Fixture {
  machine: SceneMachine;
  render: RecordingRender;
  port: FakePort;
  store: MemoryStore;
  link: FakeLink;
  online: OnlineRuns;
}

interface Setup {
  score?: number;
  form?: string;
  table?: readonly HighScoreEntry[];
  language?: Options['language'];
  online?: boolean;
  outcome?: RunOutcome;
  country?: Options['country'];
}

function setup({
  score = 321,
  form = FORM,
  table = FULL_TABLE,
  language = 'en',
  online: withOnline = true,
  outcome = RunOutcome.GameOver,
  country = 'FR',
}: Setup = {}): Fixture {
  const render = new RecordingRender();
  const port = new FakePort();
  const store = new MemoryStore();
  const link = new FakeLink();
  const online = new OnlineRuns(port, store, () => '2026-11-12T10:00:00.000Z');
  const machine = new SceneMachine(
    render,
    new Starfield(() => 0.5),
    { ...OPTIONS, language, country },
    () => losing(score, outcome),
    NO_HOST,
    table,
    {
      feedback: { form, version: '0.37.0', link },
      ...(withOnline ? { online: { runs: online, privacy: PRIVACY, link } } : {}),
    },
  );
  machine.step(DT, createIntentFrame()); // Boot → Title
  idle(machine, 70);
  return { machine, render, port, store, link, online };
}

function idle(machine: SceneMachine, steps = 10): void {
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

function move(machine: SceneMachine, x: number, y: number): void {
  const frame = createIntentFrame();
  frame.moveKind = 'direction';
  frame.moveX = x;
  frame.moveY = y;
  machine.step(DT, frame);
  machine.step(DT, createIntentFrame());
}

/** From the title: Play, a Game over on the first step, then Confirm past its 1 s lock. */
function endRun(machine: SceneMachine): void {
  press(machine, Button.Confirm);
  machine.step(DT, createIntentFrame());
  for (let i = 0; i < 80 && machine.scene === Scene.GameOver; i += 1) {
    machine.step(DT, pressed(Button.Confirm));
  }
}

/** On the offer, past its 1 s lock. */
function onOffer(options: Setup = {}): Fixture {
  const fixture = setup(options);
  endRun(fixture.machine);
  expect(fixture.machine.scene).toBe(Scene.SendOnline);
  idle(fixture.machine, 70);
  return fixture;
}

function texts(fixture: Fixture): string[] {
  fixture.render.texts.length = 0;
  fixture.machine.render(1, 16);
  return fixture.render.texts.filter((t) => t.region === 'field').map((t) => t.text);
}

/** From the offer's NOT NOW: down once wraps to SEND. */
function activateSend(machine: SceneMachine): void {
  move(machine, 0, 1);
  press(machine, Button.Confirm);
}

/** On the name entry: types A, then moves to OK and confirms (GDD v0.16 grid). */
function typeNameA(machine: SceneMachine): void {
  press(machine, Button.Confirm); // A
  move(machine, 0, -1); // SKIP
  move(machine, 0, -1); // the last grid row
  move(machine, -1, 0); // wraps to OK
  press(machine, Button.Confirm);
}

/** On the status screen after a send under the name A. */
function onStatus(options: Setup = {}): Fixture {
  const fixture = onOffer(options);
  activateSend(fixture.machine);
  typeNameA(fixture.machine);
  expect(fixture.machine.scene).toBe(Scene.OnlineStatus);
  return fixture;
}

/** The send is accepted and the screen sees it. */
function accept(fixture: Fixture): void {
  fixture.port.submits[0]?.done({ id: ID, token: TOKEN });
  idle(fixture.machine, 1);
}

/** A kept-runs document holding the 20 runs a browser may keep. */
function fullDocument(): string {
  const runs = Array.from({ length: MAX_KEPT_RUNS }, (_, i) => ({
    id: `01JC${String(i).padStart(22, '0')}`,
    token: TOKEN,
    score: 10,
    sentAt: '2026-11-12T10:00:00.000Z',
    status: 'pending',
  }));
  return JSON.stringify({ v: 1, runs });
}

describe('Send online — the offer (GDD v0.35 §9.1)', () => {
  it('shows after a run, with the score, the two lines and the cursor on NOT NOW', () => {
    const fixture = onOffer();
    const shown = texts(fixture);
    expect(shown.slice(0, 4)).toEqual([
      'SEND ONLINE',
      '321',
      'INPUTS SENT FOR CHECKING',
      'RETENTION IN PRIVACY',
    ]);
    expect(shown).toEqual(expect.arrayContaining(['SEND', 'PRIVACY', 'NOT NOW']));
    move(fixture.machine, 0, 1);
    press(fixture.machine, Button.Confirm);
    expect(fixture.machine.scene).toBe(Scene.OnlineName); // the cursor was on NOT NOW, then SEND
  });

  it('wraps a French line longer than the field at a space', () => {
    const shown = texts(onOffer({ language: 'fr' }));
    expect(shown).toEqual(
      expect.arrayContaining(['ENVOYER EN LIGNE', 'COMMANDES ENVOYEES POUR', 'VERIFIER']),
    );
  });

  it('shows the name entered for the run and its country', () => {
    const fixture = setup({ score: 500, table: [] });
    endRun(fixture.machine);
    expect(fixture.machine.scene).toBe(Scene.NameEntry);
    typeNameA(fixture.machine);
    press(fixture.machine, Button.Confirm); // leaves the high scores
    expect(fixture.machine.scene).toBe(Scene.SendOnline);
    idle(fixture.machine, 70);
    expect(texts(fixture)).toContain('A FR');
    activateSend(fixture.machine); // a name: sent at once
    expect(fixture.machine.scene).toBe(Scene.OnlineStatus);
    expect(fixture.port.submitted[0]).toMatchObject({ name: 'A', country: 'FR', score: 500 });
  });

  it.each([
    [
      'NOT NOW',
      (m: SceneMachine): void => {
        press(m, Button.Confirm);
      },
    ],
    [
      'back',
      (m: SceneMachine): void => {
        press(m, Button.Back);
      },
    ],
    [
      '20 s without input',
      (m: SceneMachine): void => {
        idle(m, 20 * 60);
      },
    ],
  ])('goes on to the feedback offer with %s, sending nothing', (_label, leave) => {
    const fixture = onOffer();
    leave(fixture.machine);
    expect(fixture.machine.scene).toBe(Scene.FeedbackOffer);
    expect(fixture.port.submitted).toEqual([]);
  });

  it('waits 20 s from the last input', () => {
    const fixture = onOffer();
    idle(fixture.machine, 18 * 60);
    const touched = createIntentFrame();
    touched.active = true;
    fixture.machine.step(DT, touched);
    idle(fixture.machine, 3 * 60);
    expect(fixture.machine.scene).toBe(Scene.SendOnline);
  });

  it('shows WAIT on SEND with a name while another send is under way (GDD v0.37)', () => {
    const fixture = setup({ score: 500, table: [] });
    const { machine } = fixture;
    for (let run = 0; run < 2; run += 1) {
      endRun(machine);
      typeNameA(machine);
      press(machine, Button.Confirm); // leaves the high scores
      idle(machine, 70);
      activateSend(machine);
      if (run === 1) break;
      idle(machine, 70); // past the status's lock
      press(machine, Button.Confirm); // OK before the answer
      idle(machine, 70);
      press(machine, Button.Back); // the feedback offer → the title
      idle(machine, 70);
    }
    expect(machine.scene).toBe(Scene.SendOnline);
    expect(texts(fixture)).toContain('WAIT');
    expect(fixture.port.submitted).toHaveLength(1);
  });

  it('goes on to the title without a form address', () => {
    const fixture = onOffer({ form: '' });
    press(fixture.machine, Button.Confirm);
    expect(fixture.machine.scene).toBe(Scene.Title);
  });

  it('ignores Confirm during its 1 s lock', () => {
    const fixture = setup();
    endRun(fixture.machine);
    press(fixture.machine, Button.Confirm);
    expect(fixture.machine.scene).toBe(Scene.SendOnline);
  });

  it.each([
    ['without the leaderboard', { online: false }],
    ['for a score of 0', { score: 0 }],
  ])('is not offered %s', (_label, options) => {
    const fixture = setup(options);
    endRun(fixture.machine);
    expect(fixture.machine.scene).toBe(Scene.FeedbackOffer);
  });

  it('is not offered for a run quit from the pause', () => {
    const fixture = setup({ outcome: RunOutcome.Playing });
    press(fixture.machine, Button.Confirm); // Play
    press(fixture.machine, Button.Pause);
    move(fixture.machine, 0, 1);
    move(fixture.machine, 0, 1); // Quit
    press(fixture.machine, Button.Confirm);
    move(fixture.machine, 0, 1); // Yes
    press(fixture.machine, Button.Confirm);
    expect(fixture.machine.scene).toBe(Scene.Title);
  });

  it('shows the erase-first line with 20 runs kept and sends nothing', () => {
    const fixture = onOffer();
    fixture.store.write(KEPT_RUNS_KEY, fullDocument());
    expect(parseKeptRuns(fixture.store.read(KEPT_RUNS_KEY)).full()).toBe(true);
    activateSend(fixture.machine);
    expect(fixture.machine.scene).toBe(Scene.SendOnline);
    expect(texts(fixture)).toContain('ERASE AN ONLINE SCORE FIRST');
    expect(fixture.port.submitted).toEqual([]);
  });
});

describe('Send online — the name entry (GDD v0.35 §9.1)', () => {
  it('opens for a run without a name, then sends with the name and the saved country', () => {
    const fixture = onStatus();
    expect(fixture.port.submitted).toHaveLength(1);
    expect(fixture.port.submitted[0]).toMatchObject({ name: 'A', country: 'FR', score: 321 });
    expect(fixture.port.submitted[0]?.frames).toBeGreaterThan(0);
  });

  it('sends no country when the saved choice is NONE', () => {
    const fixture = onStatus({ country: 'none' });
    expect(fixture.port.submitted[0]).not.toHaveProperty('country');
    fixture.port.submits[0]?.fail('name-refused');
    idle(fixture.machine, 1);
    expect(texts(fixture)).toContain('A');
  });

  it('returns to the offer with the erase-first line when 20 runs were kept meanwhile', () => {
    const fixture = onOffer();
    activateSend(fixture.machine);
    fixture.store.write(KEPT_RUNS_KEY, fullDocument());
    typeNameA(fixture.machine);
    expect(fixture.machine.scene).toBe(Scene.SendOnline);
    expect(texts(fixture)).toContain('ERASE AN ONLINE SCORE FIRST');
    expect(fixture.port.submitted).toEqual([]);
  });

  it('returns to the offer on back with an empty name, and on SKIP', () => {
    const fixture = onOffer();
    activateSend(fixture.machine);
    press(fixture.machine, Button.Back);
    expect(fixture.machine.scene).toBe(Scene.SendOnline);
    activateSend(fixture.machine);
    move(fixture.machine, 0, -1); // SKIP
    press(fixture.machine, Button.Confirm);
    expect(fixture.machine.scene).toBe(Scene.SendOnline);
    expect(fixture.port.submitted).toEqual([]);
  });

  it('deletes a letter on back without leaving', () => {
    const fixture = onOffer();
    activateSend(fixture.machine);
    press(fixture.machine, Button.Confirm); // A
    press(fixture.machine, Button.Back);
    expect(fixture.machine.scene).toBe(Scene.OnlineName);
  });

  it('returns to the offer with WAIT while another send is under way (GDD v0.37)', () => {
    const fixture = onStatus();
    idle(fixture.machine, 70); // past the status's lock
    press(fixture.machine, Button.Confirm); // OK: left before the answer
    expect(fixture.machine.scene).toBe(Scene.FeedbackOffer);
    idle(fixture.machine, 70); // past the offer's lock
    press(fixture.machine, Button.Back); // the title
    idle(fixture.machine, 70);
    endRun(fixture.machine);
    idle(fixture.machine, 70);
    activateSend(fixture.machine);
    typeNameA(fixture.machine);
    expect(fixture.machine.scene).toBe(Scene.SendOnline);
    expect(texts(fixture)).toContain('WAIT');
    expect(fixture.port.submitted).toHaveLength(1);
  });
});

describe('Send online — the status (GDD v0.35–v0.37 §9.1)', () => {
  it('shows SENDING, then PENDING VERIFICATION and the verdict, with OK and ERASE', () => {
    const fixture = onStatus();
    expect(texts(fixture)).toContain('SENDING');
    accept(fixture);
    const pending = texts(fixture);
    expect(pending).toEqual(expect.arrayContaining(['PENDING VERIFICATION', 'OK', 'ERASE']));
    idle(fixture.machine, 15 * 60);
    fixture.port.statuses[0]?.done('verified');
    idle(fixture.machine, 1);
    expect(texts(fixture)).toContain('VERIFIED');
  });

  it('ignores Confirm for 1 s after it opens, so a hurried press never skips the answer', () => {
    const fixture = onStatus();
    press(fixture.machine, Button.Confirm);
    expect(fixture.machine.scene).toBe(Scene.OnlineStatus);
  });

  it('goes on to the feedback offer on OK', () => {
    const fixture = onStatus();
    accept(fixture);
    idle(fixture.machine, 70);
    press(fixture.machine, Button.Confirm);
    expect(fixture.machine.scene).toBe(Scene.FeedbackOffer);
  });

  it('returns to the offer with the error line of a refused send', () => {
    const fixture = onStatus();
    fixture.port.submits[0]?.fail('name-refused');
    idle(fixture.machine, 1);
    expect(fixture.machine.scene).toBe(Scene.SendOnline);
    const shown = texts(fixture);
    expect(shown).toContain('NAME NOT ACCEPTED');
    expect(shown).not.toContain('TO ERASE SEE PRIVACY');
  });

  it('adds TO ERASE SEE PRIVACY after a send that may be stored', () => {
    const fixture = onStatus();
    fixture.port.submits[0]?.fail('offline');
    idle(fixture.machine, 1);
    expect(texts(fixture)).toEqual(expect.arrayContaining(['OFFLINE', 'TO ERASE SEE PRIVACY']));
  });

  it('offers no ERASE when the browser storage refused the token (GDD v0.36)', () => {
    const fixture = onStatus();
    fixture.store.refuse = true;
    accept(fixture);
    const shown = texts(fixture);
    expect(shown).toEqual(expect.arrayContaining(['PENDING VERIFICATION', 'TO ERASE SEE PRIVACY']));
    expect(shown).not.toContain('ERASE');
  });

  it('goes on when the leaderboard no longer knows the run', () => {
    const fixture = onStatus();
    accept(fixture);
    idle(fixture.machine, 15 * 60);
    fixture.port.statuses[0]?.done('unknown');
    idle(fixture.machine, 1);
    expect(fixture.machine.scene).toBe(Scene.FeedbackOffer);
  });
});

describe('Send online — erasing the sent run (GDD v0.35–v0.37 §9.1)', () => {
  function onConfirm(): Fixture {
    const fixture = onStatus();
    accept(fixture);
    idle(fixture.machine, 70); // past the status's lock
    move(fixture.machine, 0, 1); // ERASE
    press(fixture.machine, Button.Confirm);
    expect(fixture.machine.scene).toBe(Scene.OnlineErase);
    return fixture;
  }

  it('asks first, No highlighted: No and back return to the status, erasing nothing', () => {
    const fixture = onConfirm();
    press(fixture.machine, Button.Confirm);
    expect(fixture.machine.scene).toBe(Scene.OnlineStatus);
    move(fixture.machine, 0, 1);
    press(fixture.machine, Button.Confirm);
    press(fixture.machine, Button.Back);
    expect(fixture.machine.scene).toBe(Scene.OnlineStatus);
    expect(fixture.port.erased).toEqual([]);
  });

  it('erases on Yes and goes on once the run is dropped', () => {
    const fixture = onConfirm();
    move(fixture.machine, 0, 1); // Yes
    press(fixture.machine, Button.Confirm);
    expect(fixture.port.erased).toEqual([[ID, TOKEN]]);
    expect(fixture.machine.scene).toBe(Scene.OnlineStatus);
    fixture.port.erases[0]?.done('erased');
    idle(fixture.machine, 1);
    expect(fixture.machine.scene).toBe(Scene.FeedbackOffer);
  });

  it('shows the error line of a failed erasure and stays', () => {
    const fixture = onConfirm();
    move(fixture.machine, 0, 1);
    press(fixture.machine, Button.Confirm);
    fixture.port.erases[0]?.fail('server-error');
    idle(fixture.machine, 1);
    expect(fixture.machine.scene).toBe(Scene.OnlineStatus);
    expect(texts(fixture)).toContain('SERVER ERROR');
  });

  it('clears an old error line when a new erasure starts', () => {
    const fixture = onConfirm();
    move(fixture.machine, 0, 1);
    press(fixture.machine, Button.Confirm);
    fixture.port.erases[0]?.fail('server-error');
    idle(fixture.machine, 1);
    move(fixture.machine, 0, 1); // ERASE
    press(fixture.machine, Button.Confirm);
    move(fixture.machine, 0, 1); // Yes
    press(fixture.machine, Button.Confirm);
    expect(fixture.port.erased).toHaveLength(2);
    expect(texts(fixture)).not.toContain('SERVER ERROR');
  });

  it('shows WAIT when the erasure meets another request (GDD v0.37)', () => {
    const fixture = onConfirm();
    move(fixture.machine, 0, 1);
    press(fixture.machine, Button.Confirm); // erasing
    move(fixture.machine, 0, 1); // ERASE again
    press(fixture.machine, Button.Confirm);
    move(fixture.machine, 0, 1);
    press(fixture.machine, Button.Confirm);
    expect(fixture.machine.scene).toBe(Scene.OnlineStatus);
    expect(texts(fixture)).toContain('WAIT');
    expect(fixture.port.erased).toHaveLength(1);
  });

  it('goes on when the leaderboard forgot the run while the confirmation was open', () => {
    const fixture = onConfirm();
    idle(fixture.machine, 15 * 60);
    fixture.port.statuses[0]?.done('unknown');
    idle(fixture.machine, 1);
    move(fixture.machine, 0, 1);
    press(fixture.machine, Button.Confirm);
    expect(fixture.machine.scene).toBe(Scene.FeedbackOffer);
    expect(fixture.port.erased).toEqual([]);
  });

  it('goes on when the run already left the kept runs (GDD v0.37)', () => {
    const fixture = onConfirm();
    fixture.store.values.delete(KEPT_RUNS_KEY);
    move(fixture.machine, 0, 1);
    press(fixture.machine, Button.Confirm);
    expect(fixture.machine.scene).toBe(Scene.FeedbackOffer);
    expect(fixture.port.erased).toEqual([]);
  });
});

describe('Send online — the privacy page (GDD v0.35 §9.1, ADR-0027)', () => {
  function onPrivacyRow(): Fixture {
    const fixture = onOffer();
    move(fixture.machine, 0, -1); // PRIVACY
    return fixture;
  }

  it('arms the privacy page as is on the PRIVACY row', () => {
    const fixture = onPrivacyRow();
    expect(fixture.link.armed).toMatchObject({ url: PRIVACY, keys: 'confirm' });
  });

  it('stays on the offer once the page opened', () => {
    const fixture = onPrivacyRow();
    fixture.link.outcome = 'opened';
    press(fixture.machine, Button.Confirm);
    expect(fixture.machine.scene).toBe(Scene.SendOnline);
  });

  it('shows OPEN BLOCKED when the browser refused the tab', () => {
    const fixture = onPrivacyRow();
    fixture.link.outcome = 'refused';
    press(fixture.machine, Button.Confirm);
    expect(texts(fixture)).toContain('OPEN BLOCKED');
  });

  it('asks a gamepad for a gesture, then returns to the offer on back', () => {
    const fixture = onPrivacyRow();
    press(fixture.machine, Button.Confirm);
    expect(fixture.machine.scene).toBe(Scene.OnlineGesture);
    expect(fixture.link.armed).toMatchObject({ url: PRIVACY, keys: 'any' });
    press(fixture.machine, Button.Back);
    expect(fixture.machine.scene).toBe(Scene.SendOnline);
  });

  it('opens the page through the gesture and returns to the offer', () => {
    const fixture = onPrivacyRow();
    press(fixture.machine, Button.Confirm);
    fixture.link.outcome = 'opened';
    idle(fixture.machine, 1);
    expect(fixture.machine.scene).toBe(Scene.SendOnline);
    expect(texts(fixture)).not.toContain('OPEN BLOCKED');
  });

  it('clears OPEN BLOCKED when the offer is left, so the next run never shows it', () => {
    const fixture = onOffer({ form: '' });
    move(fixture.machine, 0, -1); // PRIVACY
    fixture.link.outcome = 'refused';
    press(fixture.machine, Button.Confirm);
    expect(texts(fixture)).toContain('OPEN BLOCKED');
    press(fixture.machine, Button.Back);
    expect(fixture.machine.scene).toBe(Scene.Title);
    idle(fixture.machine, 65);
    endRun(fixture.machine);
    expect(fixture.machine.scene).toBe(Scene.SendOnline);
    idle(fixture.machine, 30);
    expect(texts(fixture)).not.toContain('OPEN BLOCKED');
  });

  it('clears OPEN BLOCKED once the status screen opens', () => {
    const fixture = onPrivacyRow();
    fixture.link.outcome = 'refused';
    press(fixture.machine, Button.Confirm);
    move(fixture.machine, 0, -1); // SEND
    press(fixture.machine, Button.Confirm);
    expect(fixture.machine.scene).toBe(Scene.OnlineName);
    typeNameA(fixture.machine);
    expect(fixture.machine.scene).toBe(Scene.OnlineStatus);
    expect(texts(fixture)).not.toContain('OPEN BLOCKED');
  });

  it('draws OPEN BLOCKED above the notice lines', () => {
    const fixture = onStatus();
    fixture.port.submits[0]?.fail('offline');
    idle(fixture.machine, 70);
    move(fixture.machine, 0, -1); // PRIVACY
    fixture.link.outcome = 'refused';
    press(fixture.machine, Button.Confirm);
    fixture.machine.render(1, 16);
    const y = (text: string): number | undefined =>
      fixture.render.texts.find((t) => t.region === 'field' && t.text === text)?.y;
    expect([y('OPEN BLOCKED'), y('OFFLINE'), y('TO ERASE SEE PRIVACY')]).toEqual([264, 278, 292]);
  });

  it('returns to the offer with OPEN BLOCKED when the gesture was refused', () => {
    const fixture = onPrivacyRow();
    press(fixture.machine, Button.Confirm);
    fixture.link.outcome = 'refused';
    idle(fixture.machine, 1);
    expect(fixture.machine.scene).toBe(Scene.SendOnline);
    expect(texts(fixture)).toContain('OPEN BLOCKED');
  });
});

describe('online lines', () => {
  it.each<[FailureCode, string]>([
    ['offline', 'offline'],
    ['duplicate-run', 'alreadySent'],
    ['unknown-version', 'versionRefused'],
    ['name-refused', 'nameRefused'],
    ['too-long', 'runTooLong'],
    ['rate-limited', 'tooManyTries'],
    ['timeout', 'serverError'],
    ['accepted-unreadable', 'serverError'],
    ['unsupported', 'serverError'],
    ['bad-request', 'serverError'],
    ['server-error', 'serverError'],
  ])('shows %s as %s', (code, key) => {
    expect(failureLine(code)).toBe(key);
  });

  it.each(['pending', 'verified', 'rejected', 'unverifiable', 'expired'] as const)(
    'names the status %s',
    (status) => {
      expect(statusLine(status)).toBe(status);
    },
  );

  it('wraps at spaces, keeps a short text whole and returns the same lines again', () => {
    expect(wrapLine('POUR EFFACER VOIR CONFIDENTIALITE')).toEqual([
      'POUR EFFACER VOIR',
      'CONFIDENTIALITE',
    ]);
    expect(wrapLine('WAIT')).toEqual(['WAIT']);
    expect(wrapLine('WAIT')).toBe(wrapLine('WAIT'));
  });
});
