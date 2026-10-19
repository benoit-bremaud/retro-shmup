import { describe, expect, it } from 'vitest';
import { FEEDBACK_SETS, feedbackForm, feedbackUrl } from '../../src/domain/feedback/feedback-link';
import type { FeedbackContext } from '../../src/domain/feedback/feedback-link';

const FORM = 'https://tally.so/r/abc123';

const CONTEXT: FeedbackContext = {
  count: 0,
  version: '0.26.1',
  score: 1200,
  level: 2,
  country: 'FR',
  device: 'touch',
  lang: 'fr',
};

function query(context: Partial<FeedbackContext>): URLSearchParams {
  const url = feedbackUrl(FORM, { ...CONTEXT, ...context });
  return new URL(url).searchParams;
}

describe('feedbackForm (ADR-0027 decision 1)', () => {
  it('accepts an address on the allowed host', () => {
    expect(feedbackForm('https://tally.so/r/x')).toBe('https://tally.so/r/x');
  });

  it.each([
    ['another host', 'https://evil.example/r/x'],
    ['a look-alike host', 'https://tally.so.evil.example/r/x'],
    ['plain http', 'http://tally.so/r/x'],
    ['a query', 'https://tally.so/r/x?a=1'],
    ['a fragment', 'https://tally.so/r/x#top'],
    ['a space', 'https://tally.so/r/x y'],
    ['a newline', 'https://tally.so/r/x\n'],
    ['an empty address', ''],
  ])('turns the feature off on %s', (_label, address) => {
    expect(feedbackForm(address)).toBe('');
  });
});

describe('feedbackUrl (ADR-0027 decisions 3 and 4)', () => {
  it('sends the whole context as query parameters after the form', () => {
    const url = feedbackUrl(FORM, CONTEXT);
    expect(url).toBe(
      `${FORM}?set=1&version=0.26.1&score=1200&level=2&country=FR&device=touch&lang=fr`,
    );
  });

  it.each([
    [0, '1'],
    [1, '2'],
    [2, '3'],
    [3, '1'],
    [7, '2'],
  ])('rotates the question set with the count %i: set %s', (count, set) => {
    expect(FEEDBACK_SETS).toBe(3);
    expect(query({ count }).get('set')).toBe(set);
  });

  it('sends an unknown country empty', () => {
    const params = query({ country: undefined });
    expect(params.get('country')).toBe('');
    expect(params.has('country')).toBe(true);
  });

  it('encodes a value that carries reserved characters', () => {
    const url = feedbackUrl(FORM, { ...CONTEXT, version: 'a&b=c d' });
    expect(url).toContain('version=a%26b%3Dc%20d');
    expect(new URL(url).searchParams.get('version')).toBe('a&b=c d');
  });

  it.each([
    ['NaN', Number.NaN],
    ['negative', -5],
    ['a fraction', 12.5],
    ['infinite', Number.POSITIVE_INFINITY],
    ['beyond the safe integers', 2 ** 60],
  ])('sends score and level as 0 when %s', (_label, value) => {
    const params = query({ score: value, level: value });
    expect([params.get('score'), params.get('level')]).toEqual(['0', '0']);
  });

  it('falls back to set 1 when the count is not a whole number', () => {
    expect(query({ count: Number.NaN }).get('set')).toBe('1');
    expect(query({ count: -4 }).get('set')).toBe('1');
    expect(query({ count: 1.5 }).get('set')).toBe('1');
  });
});
