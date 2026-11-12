import { describe, expect, it } from 'vitest';
import { leaderboardOrigin, withConnectSource } from '../../src/app/leaderboard-build';

const SHA = 'a'.repeat(40);
const RELEASE = {
  url: 'https://lb.benoitbremaud.fr',
  version: '1.0.0',
  releaseCommit: SHA,
  pagesCommit: SHA,
};

describe('leaderboardOrigin', () => {
  it('is the origin on the release commit of a released version', () => {
    expect(leaderboardOrigin(RELEASE)).toBe('https://lb.benoitbremaud.fr');
  });

  it.each([
    ['no address', { url: undefined }],
    ['an empty address', { url: '' }],
    ['version 0.0.0', { version: '0.0.0' }],
    ['a pre-release version', { version: '1.0.0-rc.1' }],
    ['a loose version', { version: 'v1.0.0' }],
    ['no release commit', { releaseCommit: undefined }],
    ['an empty release commit', { releaseCommit: '', pagesCommit: '' }],
    ['a later commit', { pagesCommit: 'b'.repeat(40) }],
    ['no Pages commit', { pagesCommit: undefined }],
  ])('fails closed with %s', (_label, fields) => {
    expect(leaderboardOrigin({ ...RELEASE, ...fields })).toBe('');
  });

  it.each([
    'http://lb.benoitbremaud.fr',
    'https://lb.benoitbremaud.fr/v1',
    'https://lb.benoitbremaud.fr/',
    'https://lb.benoitbremaud.fr?x=1',
    'https://user@lb.benoitbremaud.fr',
    'not a url',
  ])('fails the build on the address %s', (url) => {
    expect(() => leaderboardOrigin({ ...RELEASE, url })).toThrow('VITE_LEADERBOARD_URL');
  });
});

describe('withConnectSource', () => {
  const HEADERS =
    "/*\n  Content-Security-Policy: default-src 'self'; connect-src 'self'; media-src 'self'\n";

  it('adds the origin to connect-src', () => {
    expect(withConnectSource(HEADERS, 'https://lb.example.fr')).toBe(
      "/*\n  Content-Security-Policy: default-src 'self'; connect-src 'self' https://lb.example.fr; media-src 'self'\n",
    );
  });

  it('leaves the headers as they are without an origin', () => {
    expect(withConnectSource(HEADERS, '')).toBe(HEADERS);
  });

  it('fails the build when connect-src cannot be found exactly once', () => {
    expect(() => withConnectSource('/*\n', 'https://lb.example.fr')).toThrow('connect-src');
    expect(() => withConnectSource(HEADERS + HEADERS, 'https://lb.example.fr')).toThrow(
      'connect-src',
    );
  });
});
