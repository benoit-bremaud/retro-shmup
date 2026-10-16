import { describe, expect, it } from 'vitest';
import { versionLabel } from '../../src/app/version-label';

describe('versionLabel (GDD v0.20 §9.9)', () => {
  it('joins the version and the short commit', () => {
    expect(versionLabel('0.1.0', 'abc1234def5678')).toBe('v0.1.0+abc1234');
  });

  it('keeps a commit of exactly 7 hex characters', () => {
    expect(versionLabel('0.1.0', 'abc1234')).toBe('v0.1.0+abc1234');
  });

  it('shows the version alone without a commit', () => {
    expect(versionLabel('0.1.0', '')).toBe('v0.1.0');
  });

  it.each(['abc123', 'ABC1234', 'abc123g', 'abc1234\n', 'a'.repeat(41), '<b>1234567'])(
    'drops a commit that is not 7 to 40 lowercase hex characters: %j',
    (commit) => {
      expect(versionLabel('0.1.0', commit)).toBe('v0.1.0');
    },
  );
});
