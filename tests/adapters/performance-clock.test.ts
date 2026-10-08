import { describe, expect, it } from 'vitest';
import { PerformanceClock } from '../../src/adapters/performance-clock';

describe('PerformanceClock', () => {
  it('reads a monotonic clock in milliseconds', () => {
    const clock = new PerformanceClock();
    const first = clock.now();
    expect(clock.now()).toBeGreaterThanOrEqual(first);
  });
});
