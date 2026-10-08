import type { Clock } from '../domain/ports/clock';

/** Monotonic browser clock (ADR-0002): the only place that reads `performance.now()`. */
export class PerformanceClock implements Clock {
  now(): number {
    return performance.now();
  }
}
