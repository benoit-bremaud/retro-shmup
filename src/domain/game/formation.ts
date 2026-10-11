/**
 * One pass of a Popcorn group (GDD §5.2, class diagram): destroying every member drops a P of
 * the level's dominant colour at the last one destroyed. A member that escapes, or that a full
 * pool refuses, settles the formation without clearing it. Pooled; released once settled.
 */
export class Formation {
  size = 0;
  destroyed = 0;
  /** Members destroyed, escaped or refused: the formation is settled when it reaches `size`. */
  settled = 0;
  lastX = 0;
  lastY = 0;

  start(size: number): void {
    this.size = size;
    this.destroyed = 0;
    this.settled = 0;
    this.lastX = 0;
    this.lastY = 0;
  }

  /** A member destroyed at (x, y); true when that was the last one: the formation is cleared. */
  memberDestroyed(x: number, y: number): boolean {
    this.destroyed += 1;
    this.settled += 1;
    this.lastX = x;
    this.lastY = y;
    return this.destroyed === this.size;
  }

  /** A member that left the field alive, or was never spawned. */
  memberLost(): void {
    this.settled += 1;
  }

  get isSettled(): boolean {
    return this.settled >= this.size;
  }
}
