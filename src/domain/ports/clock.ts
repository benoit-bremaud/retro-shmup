/** Monotonic time source in milliseconds; the domain never reads the browser clock (ADR-0002). */
export interface Clock {
  now(): number;
}
