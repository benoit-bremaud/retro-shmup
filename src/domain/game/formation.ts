/**
 * One pass of a Popcorn group (GDD §5.2, class diagram): destroying every member that appeared
 * drops a P of the level's dominant colour at the last one destroyed. A member refused by a full
 * enemy pool never existed, so it does not count against the player; one that escapes does.
 * Pooled; released once every member is resolved.
 */
export class Formation {
  total = 0;
  destroyed = 0;
  escaped = 0;
  refused = 0;
  lastX = 0;
  lastY = 0;
  rewarded = false;

  start(total: number): void {
    this.total = total;
    this.destroyed = 0;
    this.escaped = 0;
    this.refused = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.rewarded = false;
  }

  memberDestroyed(x: number, y: number): void {
    this.destroyed += 1;
    this.lastX = x;
    this.lastY = y;
  }

  /** Every member that appeared was destroyed, and the P is not paid yet. */
  isCleared(): boolean {
    return !this.rewarded && this.destroyed > 0 && this.destroyed + this.refused === this.total;
  }

  isResolved(): boolean {
    return this.destroyed + this.escaped + this.refused >= this.total;
  }
}
