/** A plain object, neither null nor an array: the first check on any untrusted JSON (ADR-0006). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
