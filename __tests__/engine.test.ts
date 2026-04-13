/**
 * Plinko Lab — Unit Tests
 * Covers: SHA256 combiner, xorshift32 PRNG, peg map generation, drop engine
 * All test vectors provided by the assignment spec.
 */

import { sha256, makeCommit, makeCombined } from "../lib/crypto";
import { Xorshift32, prngFromHex } from "../lib/prng";
import { generatePegMap, simulateDrop, runEngine, hashPegMap } from "../lib/engine";

// ─────────────────────────────────────────────
// 1. SHA-256 / Commit-Reveal Combiner
// ─────────────────────────────────────────────
describe("Crypto — commit-reveal combiner", () => {
  const SERVER_SEED = "b2a5f3f32a4d9c6ee7a8c1d33456677890abcdeffedcba0987654321ffeeddcc";
  const NONCE = "42";
  const CLIENT_SEED = "candidate-hello";

  const EXPECTED_COMMIT   = "bb9acdc67f3f18f3345236a01f0e5072596657a9005c7d8a22cff061451a6b34";
  const EXPECTED_COMBINED = "e1dddf77de27d395ea2be2ed49aa2a59bd6bf12ee8d350c16c008abd406c07e0";

  it("computes commitHex = SHA256(serverSeed:nonce)", () => {
    expect(makeCommit(SERVER_SEED, NONCE)).toBe(EXPECTED_COMMIT);
  });

  it("computes combinedSeed = SHA256(serverSeed:clientSeed:nonce)", () => {
    expect(makeCombined(SERVER_SEED, CLIENT_SEED, NONCE)).toBe(EXPECTED_COMBINED);
  });

  it("sha256 is deterministic", () => {
    expect(sha256("hello")).toBe(sha256("hello"));
  });

  it("commit changes when nonce changes", () => {
    expect(makeCommit(SERVER_SEED, "43")).not.toBe(EXPECTED_COMMIT);
  });
});

// ─────────────────────────────────────────────
// 2. xorshift32 PRNG
// ─────────────────────────────────────────────
describe("PRNG — xorshift32 seeded from combinedSeed", () => {
  const COMBINED = "e1dddf77de27d395ea2be2ed49aa2a59bd6bf12ee8d350c16c008abd406c07e0";
  const EXPECTED_FIRST_5 = [
    0.1106166649,
    0.7625129214,
    0.0439292176,
    0.4578678815,
    0.3438999297,
  ];

  it("extracts seed from first 4 bytes big-endian", () => {
    const seed = parseInt(COMBINED.slice(0, 8), 16);
    expect(seed).toBe(0xe1dddf77 >>> 0);
  });

  it("produces the correct first 5 rand() values (10dp match)", () => {
    const prng = prngFromHex(COMBINED);
    for (const expected of EXPECTED_FIRST_5) {
      const got = prng.rand();
      expect(got).toBeCloseTo(expected, 9);
    }
  });

  it("is reproducible — same seed yields same sequence", () => {
    const a = prngFromHex(COMBINED);
    const b = prngFromHex(COMBINED);
    for (let i = 0; i < 20; i++) {
      expect(a.rand()).toBe(b.rand());
    }
  });

  it("rand() output is always in [0, 1)", () => {
    const prng = prngFromHex(COMBINED);
    for (let i = 0; i < 100; i++) {
      const v = prng.rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("handles zero seed safely (state becomes 1)", () => {
    const prng = new Xorshift32(0);
    expect(prng.rand()).toBeGreaterThanOrEqual(0);
    expect(prng.rand()).toBeLessThan(1);
  });
});

// ─────────────────────────────────────────────
// 3. Peg Map Generation
// ─────────────────────────────────────────────
describe("Engine — peg map generation", () => {
  const COMBINED = "e1dddf77de27d395ea2be2ed49aa2a59bd6bf12ee8d350c16c008abd406c07e0";

  it("generates row 0 correctly (1 peg)", () => {
    const prng = prngFromHex(COMBINED);
    const pegMap = generatePegMap(prng);
    expect(pegMap[0].length).toBe(1);
    expect(pegMap[0][0].leftBias).toBeCloseTo(0.422123, 5);
  });

  it("generates row 1 correctly (2 pegs)", () => {
    const prng = prngFromHex(COMBINED);
    const pegMap = generatePegMap(prng);
    expect(pegMap[1].length).toBe(2);
    expect(pegMap[1][0].leftBias).toBeCloseTo(0.552503, 5);
    expect(pegMap[1][1].leftBias).toBeCloseTo(0.408786, 5);
  });

  it("generates row 2 correctly (3 pegs)", () => {
    const prng = prngFromHex(COMBINED);
    const pegMap = generatePegMap(prng);
    expect(pegMap[2].length).toBe(3);
    expect(pegMap[2][0].leftBias).toBeCloseTo(0.491574, 5);
    expect(pegMap[2][1].leftBias).toBeCloseTo(0.46878, 5);
    expect(pegMap[2][2].leftBias).toBeCloseTo(0.43654, 5);
  });

  it("has 12 rows with r+1 pegs each", () => {
    const prng = prngFromHex(COMBINED);
    const pegMap = generatePegMap(prng);
    expect(pegMap.length).toBe(12);
    pegMap.forEach((row, r) => {
      expect(row.length).toBe(r + 1);
    });
  });

  it("all leftBias values are in [0.4, 0.6]", () => {
    const prng = prngFromHex(COMBINED);
    const pegMap = generatePegMap(prng);
    for (const row of pegMap) {
      for (const peg of row) {
        expect(peg.leftBias).toBeGreaterThanOrEqual(0.4);
        expect(peg.leftBias).toBeLessThanOrEqual(0.6);
      }
    }
  });

  it("pegMapHash is stable for same peg map", () => {
    const prng1 = prngFromHex(COMBINED);
    const prng2 = prngFromHex(COMBINED);
    const map1 = generatePegMap(prng1);
    const map2 = generatePegMap(prng2);
    expect(hashPegMap(map1)).toBe(hashPegMap(map2));
  });
});

// ─────────────────────────────────────────────
// 4. Drop Simulation / Replay Determinism
// ─────────────────────────────────────────────
describe("Engine — drop simulation and determinism", () => {
  const COMBINED = "e1dddf77de27d395ea2be2ed49aa2a59bd6bf12ee8d350c16c008abd406c07e0";

  it("center drop (col 6) lands at bin 6 per spec", () => {
    const { binIndex } = runEngine(COMBINED, 6);
    expect(binIndex).toBe(6);
  });

  it("path has exactly 12 decisions", () => {
    const { path } = runEngine(COMBINED, 6);
    expect(path.length).toBe(12);
  });

  it("binIndex equals number of R decisions", () => {
    const { path, binIndex } = runEngine(COMBINED, 6);
    const rights = path.filter(d => d === "R").length;
    expect(binIndex).toBe(rights);
  });

  it("replay is exactly deterministic — same combinedSeed always same binIndex", () => {
    const r1 = runEngine(COMBINED, 6);
    const r2 = runEngine(COMBINED, 6);
    expect(r1.binIndex).toBe(r2.binIndex);
    expect(r1.path.join("")).toBe(r2.path.join(""));
    expect(r1.pegMapHash).toBe(r2.pegMapHash);
  });

  it("different dropColumn changes path (most of the time)", () => {
    const r1 = runEngine(COMBINED, 0);
    const r2 = runEngine(COMBINED, 12);
    // Edge columns bias left/right — paths or binIndex should differ
    // Not guaranteed every time, but very likely
    expect([r1.binIndex, r1.path.join("")]).not.toEqual([r2.binIndex, r2.path.join("")]);
  });

  it("binIndex is always in [0, 12]", () => {
    for (let col = 0; col <= 12; col++) {
      const { binIndex } = runEngine(COMBINED, col);
      expect(binIndex).toBeGreaterThanOrEqual(0);
      expect(binIndex).toBeLessThanOrEqual(12);
    }
  });

  it("different combinedSeeds produce different results", () => {
    const r1 = runEngine("e1dddf77de27d395ea2be2ed49aa2a59bd6bf12ee8d350c16c008abd406c07e0", 6);
    const r2 = runEngine("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 6);
    // Very unlikely to be identical
    const same = r1.binIndex === r2.binIndex && r1.path.join("") === r2.path.join("");
    expect(same).toBe(false);
  });
});

// ─────────────────────────────────────────────
// 5. Full pipeline integration test
// ─────────────────────────────────────────────
describe("Full pipeline — commit → combine → engine", () => {
  it("full spec test vector passes end-to-end", () => {
    const SERVER_SEED = "b2a5f3f32a4d9c6ee7a8c1d33456677890abcdeffedcba0987654321ffeeddcc";
    const NONCE = "42";
    const CLIENT_SEED = "candidate-hello";

    const commit = makeCommit(SERVER_SEED, NONCE);
    expect(commit).toBe("bb9acdc67f3f18f3345236a01f0e5072596657a9005c7d8a22cff061451a6b34");

    const combined = makeCombined(SERVER_SEED, CLIENT_SEED, NONCE);
    expect(combined).toBe("e1dddf77de27d395ea2be2ed49aa2a59bd6bf12ee8d350c16c008abd406c07e0");

    const { binIndex, path } = runEngine(combined, 6);
    expect(binIndex).toBe(6);
    expect(path.length).toBe(12);
  });
});
