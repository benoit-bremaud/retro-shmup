import { describe, expect, it } from 'vitest';
import headers from '../../public/_headers?raw';
import { withConnectSource } from '../../src/app/leaderboard-build';

describe('public/_headers', () => {
  it('takes the leaderboard origin in its CSP connect-src', () => {
    expect(withConnectSource(headers, 'https://lb.example.fr')).toContain(
      "connect-src 'self' https://lb.example.fr;",
    );
  });
});
