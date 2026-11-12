import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES } from '../../src/domain/hall-of-fame/country-codes';
import {
  countryHints,
  suggestedCountries,
  SUGGESTION_COUNT,
} from '../../src/domain/hall-of-fame/country-suggestions';
import { TIME_ZONE_COUNTRY_PAIRS } from '../../src/domain/hall-of-fame/time-zone-countries';

describe('countryHints (ADR-0021 amendment of 2026-10-26)', () => {
  it('takes the time zone first, then the language region: an English speaker in France', () => {
    expect(countryHints('Europe/Paris', 'US')).toEqual(['FR', 'US']);
  });

  it('drops an unknown or lowercase language region, and one equal to the zone country', () => {
    expect(countryHints('Europe/Paris', 'XK')).toEqual(['FR']);
    expect(countryHints('Europe/Paris', 'fr')).toEqual(['FR']);
    expect(countryHints('Europe/Paris', 'FR')).toEqual(['FR']);
  });

  it.each([
    ['America/Argentina/Cordoba', 'AR'], // one of a country's several zones
    ['Asia/Calcutta', 'IN'], // old names browsers still report, from the links
    ['Europe/Kiev', 'UA'],
    ['Africa/Asmera', 'ER'],
    ['America/Godthab', 'GL'],
  ])('maps %s to %s', (zone, code) => {
    expect(countryHints(zone, undefined)).toEqual([code]);
  });

  it.each(['UTC', 'CET', 'Mars/Olympus', ''])(
    'keeps only the language region for the zone %j',
    (zone) => {
      expect(countryHints(zone, 'BE')).toEqual(['BE']);
    },
  );

  it.each([
    [undefined, 'CA', ['CA']],
    [undefined, undefined, []],
    ['UTC', 'XK', []], // user-assigned, not in the allowlist
    ['UTC', '419', []], // a UN M.49 region, not a country
  ])('with the zone %j and the region %j gives %j', (zone, region, expected) => {
    expect(countryHints(zone, region)).toEqual(expected);
  });

  it('holds only zone names and known codes in the generated table', () => {
    const words = TIME_ZONE_COUNTRY_PAIRS.split(' ');
    const bad: string[] = [];
    for (let i = 0; i < words.length; i += 2) {
      const zone = words[i] ?? '';
      const code = words[i + 1] ?? '';
      if (!zone.includes('/') || !COUNTRY_CODES.has(code)) bad.push(`${zone} ${code}`);
    }
    expect(words.length % 2).toBe(0);
    expect(bad).toEqual([]);
  });
});

describe('suggestedCountries (GDD v0.34 §9.1, ADR-0030)', () => {
  it('offers the common countries when nothing is known', () => {
    expect(suggestedCountries([], undefined)).toEqual(['FR', 'BE', 'CH', 'CA', 'US', 'GB']);
  });

  it('puts the hints first, then the saved country, then the common ones, cut to six', () => {
    expect(suggestedCountries(['JP', 'DE'], 'BR')).toEqual(['JP', 'DE', 'BR', 'FR', 'BE', 'CH']);
  });

  it('lists each code once', () => {
    expect(suggestedCountries(['BE', 'FR'], 'BE')).toEqual(['BE', 'FR', 'CH', 'CA', 'US', 'GB']);
  });

  it.each(['none', 'XX', 'fr', ''])('ignores the saved value %j', (saved) => {
    expect(suggestedCountries([], saved)).toEqual(['FR', 'BE', 'CH', 'CA', 'US', 'GB']);
  });

  it('ignores an unknown hint and never exceeds six', () => {
    const suggested = suggestedCountries(['XX', 'JP', 'DE', 'IT', 'ES', 'PT', 'NL', 'SE'], 'BR');
    expect(suggested).toEqual(['JP', 'DE', 'IT', 'ES', 'PT', 'NL']);
    expect(suggested).toHaveLength(SUGGESTION_COUNT);
  });
});
