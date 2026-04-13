/**
 * xorshift32 PRNG.
 * Seeded from the first 4 bytes (8 hex chars) of a hex string, read big-endian.
 * Returns rand() values in [0, 1).
 */
export class Xorshift32 {
  private state: number;

  constructor(seed: number) {
    // Ensure non-zero state
    this.state = seed >>> 0 || 1;
  }

  /** Advance state and return next uint32 */
  nextUint32(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }

  /** Return float in [0, 1) */
  rand(): number {
    return this.nextUint32() / 0x100000000;
  }
}

/**
 * Create a seeded PRNG from the first 4 bytes of a hex combinedSeed (big-endian).
 */
export function prngFromHex(hexSeed: string): Xorshift32 {
  const first8 = hexSeed.slice(0, 8);
  const seed = parseInt(first8, 16);
  return new Xorshift32(seed);
}
