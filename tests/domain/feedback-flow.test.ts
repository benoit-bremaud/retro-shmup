import { describe, expect, it } from 'vitest';
import { ANY_GESTURE, FeedbackFlow, NO_FEEDBACK } from '../../src/domain/scenes/feedback-flow';
import type { ArmedAt } from '../../src/domain/scenes/feedback-flow';
import type { FeedbackContext } from '../../src/domain/feedback/feedback-link';
import { NO_LINK } from '../../src/domain/ports/link-port';
import type { ArmedLink, LinkOutcome, LinkPort } from '../../src/domain/ports/link-port';

const FORM = 'https://tally.so/r/abc123';
const BAND = { top: 100, bottom: 132 };
const ROW_OFF: ArmedAt = { band: BAND, keys: 'none' };
const ROW_ON: ArmedAt = { band: BAND, keys: 'confirm' };

const CONTEXT: FeedbackContext = {
  count: 1,
  version: '0.26.1',
  score: 500,
  level: 3,
  country: undefined,
  device: 'keyboard',
  lang: 'en',
};

/** Stands for the browser side: records the armings and serves queued outcomes. */
class FakeLink implements LinkPort {
  readonly armings: (ArmedLink | undefined)[] = [];
  takes = 0;
  outcome: LinkOutcome = 'none';
  arm(link: ArmedLink | undefined): void {
    this.armings.push(link);
  }
  takeOutcome(): LinkOutcome {
    this.takes += 1;
    const outcome = this.outcome;
    this.outcome = 'none';
    return outcome;
  }
}

function setup(form = FORM): { flow: FeedbackFlow; link: FakeLink; reads: { count: number } } {
  const link = new FakeLink();
  const reads = { count: 0 };
  const flow = new FeedbackFlow({ form, version: '0.26.1', link });
  return { flow, link, reads };
}

describe('FeedbackFlow (ADR-0027 decisions 2 to 5, GDD v0.26 §9.1)', () => {
  it('is enabled by a form address, and off without one', () => {
    expect(setup().flow.enabled).toBe(true);
    expect(setup('').flow.enabled).toBe(false);
    expect(new FeedbackFlow(NO_FEEDBACK).enabled).toBe(false);
  });

  it('opens nothing without a browser: NO_LINK arms silently and reports no outcome', () => {
    const flow = new FeedbackFlow(NO_FEEDBACK);
    expect(flow.step(ROW_ON, () => CONTEXT)).toBe('none');
    NO_LINK.arm({ url: FORM, band: BAND, keys: 'confirm' });
    expect(NO_LINK.takeOutcome()).toBe('none');
  });

  it('arms the link on a first step with the address built from the context', () => {
    const { flow, link } = setup();
    flow.step(ROW_ON, () => CONTEXT);
    expect(link.armings).toEqual([
      {
        url: `${FORM}?set=2&version=0.26.1&score=500&level=3&country=&device=keyboard&lang=en`,
        band: BAND,
        keys: 'confirm',
      },
    ]);
  });

  it('arms again on a change of arming only, comparing by identity', () => {
    const { flow, link } = setup();
    flow.step(ROW_OFF, () => CONTEXT);
    flow.step(ROW_OFF, () => CONTEXT);
    flow.step(ROW_ON, () => CONTEXT);
    flow.step(ROW_ON, () => CONTEXT);
    expect(link.armings.map((armed) => armed?.keys)).toEqual(['none', 'confirm']);
  });

  it('builds the address once per arming, reading the context on the first one only', () => {
    const { flow, link, reads } = setup();
    const context = (): FeedbackContext => {
      reads.count += 1;
      return CONTEXT;
    };
    flow.step(ROW_OFF, context);
    flow.step(ROW_ON, context);
    flow.step(ROW_OFF, context);
    expect(reads.count).toBe(1);
    expect(new Set(link.armings.map((armed) => armed?.url)).size).toBe(1);
  });

  it('arms any gesture with no band for the prompt', () => {
    const { flow, link } = setup();
    flow.step(ANY_GESTURE, () => CONTEXT);
    expect(link.armings[0]).toMatchObject({ band: undefined, keys: 'any' });
  });

  it('disarms with undefined, clearing the link and its outcome once', () => {
    const { flow, link } = setup();
    flow.step(ROW_ON, () => CONTEXT);
    link.outcome = 'opened';
    flow.step(undefined, () => CONTEXT);
    expect(link.armings).toHaveLength(2);
    expect(link.armings[1]).toBeUndefined();
    flow.step(undefined, () => CONTEXT);
    expect(link.armings).toHaveLength(2);
  });

  it('rebuilds the address on an arming after a disarm', () => {
    const { flow, link } = setup();
    flow.step(ROW_ON, () => CONTEXT);
    flow.disarm();
    flow.step(ROW_ON, () => ({ ...CONTEXT, score: 900 }));
    expect(link.armings[2]?.url).toContain('score=900');
  });

  it('disarm is a no-op when nothing is armed', () => {
    const { flow, link } = setup();
    flow.disarm();
    expect(link.armings).toEqual([]);
    expect(link.takes).toBe(0);
  });

  it('disarm drops an outcome the link was holding', () => {
    const { flow, link } = setup();
    flow.step(ROW_ON, () => CONTEXT);
    link.outcome = 'opened';
    flow.disarm();
    expect(link.takeOutcome()).toBe('none');
  });

  it.each<LinkOutcome>(['opened', 'refused', 'none'])(
    'returns the %s outcome of the step',
    (outcome) => {
      const { flow, link } = setup();
      link.outcome = outcome;
      expect(flow.step(ROW_ON, () => CONTEXT)).toBe(outcome);
    },
  );

  it('shows OPEN BLOCKED for two seconds at 60 Hz, then clears it', () => {
    const { flow } = setup();
    expect(flow.blocked).toBe(false);
    flow.block();
    expect(flow.blocked).toBe(true);
    for (let i = 0; i < 119; i += 1) flow.step(ROW_ON, () => CONTEXT);
    expect(flow.blocked).toBe(true);
    flow.step(ROW_ON, () => CONTEXT);
    expect(flow.blocked).toBe(false);
  });

  it('does not count below zero when no block is showing', () => {
    const { flow } = setup();
    for (let i = 0; i < 5; i += 1) flow.step(ROW_ON, () => CONTEXT);
    flow.block();
    for (let i = 0; i < 119; i += 1) flow.step(ROW_ON, () => CONTEXT);
    expect(flow.blocked).toBe(true);
  });
});
