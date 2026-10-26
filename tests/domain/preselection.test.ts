import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES } from '../../src/domain/hall-of-fame/country-codes';
import { preselectedCountry } from '../../src/domain/hall-of-fame/preselection';
import { TIME_ZONE_COUNTRY_PAIRS } from '../../src/domain/hall-of-fame/time-zone-countries';

describe('preselectedCountry (ADR-0021 amendment of 2026-10-26)', () => {
  it('takes the time zone first: an English speaker in France gets FR', () => {
    expect(preselectedCountry('Europe/Paris', 'US')).toBe('FR');
  });

  it('knows the old zone names browsers still report', () => {
    expect(preselectedCountry('Asia/Calcutta', undefined)).toBe('IN');
    expect(preselectedCountry('Europe/Kiev', undefined)).toBe('UA');
  });

  it.each(['UTC', 'Etc/UTC', 'Etc/GMT+3', 'Mars/Olympus', ''])(
    'falls back to the language region for the zone %j',
    (zone) => {
      expect(preselectedCountry(zone, 'BE')).toBe('BE');
    },
  );

  it('falls back to the language region without a time zone', () => {
    expect(preselectedCountry(undefined, 'CA')).toBe('CA');
  });

  it('gives none when neither signal names a known country', () => {
    expect(preselectedCountry(undefined, undefined)).toBeUndefined();
    expect(preselectedCountry('UTC', 'XK')).toBeUndefined();
    expect(preselectedCountry('UTC', '419')).toBeUndefined();
  });

  it('maps every zone of the generated table to a known code', () => {
    const words = TIME_ZONE_COUNTRY_PAIRS.split(' ');
    expect(words.length % 2).toBe(0);
    for (let i = 1; i < words.length; i += 2) expect(COUNTRY_CODES.has(words[i] ?? '')).toBe(true);
  });
});
