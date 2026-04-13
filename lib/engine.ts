import { createHash } from "crypto";
import { prngFromHex, Xorshift32 } from "./prng";

export const ROWS = 12;
export const BINS = ROWS + 1; // 13 bins

/** One peg with a leftBias rounded to 6 decimal places */
export type Peg = { leftBias: number };

/** Full peg map: rows[r] has r+1 pegs */
export type PegMap = Peg[][];

/** Result of running the Plinko engine */
export interface EngineResult {
  pegMap: PegMap;
  pegMapHash: string;
  path: ("L" | "R")[]; // decision at each row
  binIndex: number;
}

/** Paytable: symmetric, edges pay more */
export const PAYTABLE: Record<number, number> = {
  0: 16,
  1: 9,
  2: 4,
  3: 2,
  4: 1.5,
  5: 1.2,
  6: 1.0,
  7: 1.2,
  8: 1.5,
  9: 2,
  10: 4,
  11: 9,
  12: 16,
};

/**
 * Generate the peg map using the PRNG.
 * Each peg's leftBias = 0.5 + (rand() - 0.5) * 0.2, rounded to 6 dp.
 */
export function generatePegMap(prng: Xorshift32): PegMap {
  const pegMap: PegMap = [];
  for (let r = 0; r < ROWS; r++) {
    const row: Peg[] = [];
    for (let p = 0; p <= r; p++) {
      const raw = 0.5 + (prng.rand() - 0.5) * 0.2;
      const leftBias = Math.round(raw * 1_000_000) / 1_000_000;
      row.push({ leftBias });
    }
    pegMap.push(row);
  }
  return pegMap;
}

/** Hash the peg map for tamper detection */
export function hashPegMap(pegMap: PegMap): string {
  const json = JSON.stringify(pegMap);
  return createHash("sha256").update(json, "utf8").digest("hex");
}

/**
 * Simulate the ball drop and return the full path + binIndex.
 * Uses the same PRNG stream (after peg map generation) for row decisions.
 */
export function simulateDrop(
  prng: Xorshift32,
  pegMap: PegMap,
  dropColumn: number
): { path: ("L" | "R")[]; binIndex: number } {
  const adj = (dropColumn - Math.floor(ROWS / 2)) * 0.01;
  let pos = 0; // number of Right moves so far
  const path: ("L" | "R")[] = [];

  for (let r = 0; r < ROWS; r++) {
    const pegIdx = Math.min(pos, r);
    const rawBias = pegMap[r][pegIdx].leftBias;
    const bias = Math.max(0, Math.min(1, rawBias + adj));
    const rnd = prng.rand();
    if (rnd < bias) {
      path.push("L");
    } else {
      path.push("R");
      pos += 1;
    }
  }

  return { path, binIndex: pos };
}

/**
 * Full engine: given combinedSeed and dropColumn, returns everything.
 */
export function runEngine(
  combinedSeed: string,
  dropColumn: number
): EngineResult {
  const prng = prngFromHex(combinedSeed);
  const pegMap = generatePegMap(prng);
  const pegMapHash = hashPegMap(pegMap);
  const { path, binIndex } = simulateDrop(prng, pegMap, dropColumn);
  return { pegMap, pegMapHash, path, binIndex };
}
