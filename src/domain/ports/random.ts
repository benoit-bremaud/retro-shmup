/**
 * Seeded pseudo-random generator for gameplay only (ADR-0002, ADR-0010).
 * `next()` returns a number in [0, 1); presentation uses its own unseeded generator.
 */
export interface Random {
  next(): number;
  seed(s: number): void;
}
