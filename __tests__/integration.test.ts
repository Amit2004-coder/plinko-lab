/**
 * Integration test: exercises the full commit→start→reveal pipeline
 * using lib functions directly (no HTTP), then verifies recompute matches.
 */

import { makeCommit, makeCombined, randomServerSeed, randomNonce } from "../lib/crypto";
import { runEngine, PAYTABLE } from "../lib/engine";

describe("Full round pipeline (offline integration)", () => {
  it("commit is stable and not exposed before reveal", () => {
    const serverSeed = randomServerSeed();
    const nonce = randomNonce();
    const commitHex = makeCommit(serverSeed, nonce);

    // Commit is a 64-char hex string
    expect(commitHex).toMatch(/^[0-9a-f]{64}$/);
    // Commit does NOT contain the serverSeed
    expect(commitHex).not.toContain(serverSeed);
  });

  it("engine result is reproducible via verifier recompute", () => {
    const serverSeed = randomServerSeed();
    const nonce = randomNonce();
    const clientSeed = "test-integration-player";
    const dropColumn = 4;

    // Server side: run round
    const combinedSeed = makeCombined(serverSeed, clientSeed, nonce);
    const { binIndex, path, pegMapHash } = runEngine(combinedSeed, dropColumn);

    // Verifier side: recompute from revealed serverSeed
    const recomputed = runEngine(
      makeCombined(serverSeed, clientSeed, nonce),
      dropColumn
    );

    expect(recomputed.binIndex).toBe(binIndex);
    expect(recomputed.path.join("")).toBe(path.join(""));
    expect(recomputed.pegMapHash).toBe(pegMapHash);
  });

  it("commit-reveal: changing serverSeed post-commit is detectable", () => {
    const serverSeed = randomServerSeed();
    const nonce = randomNonce();
    const commitHex = makeCommit(serverSeed, nonce);

    const fakeServerSeed = randomServerSeed();
    const fakeCommit = makeCommit(fakeServerSeed, nonce);

    // If server tried to swap seeds, commit wouldn't match
    expect(fakeCommit).not.toBe(commitHex);
  });

  it("payout table covers all 13 bins with valid multipliers", () => {
    for (let i = 0; i <= 12; i++) {
      expect(PAYTABLE[i]).toBeGreaterThan(0);
    }
    // Symmetric: edges highest
    expect(PAYTABLE[0]).toBe(PAYTABLE[12]);
    expect(PAYTABLE[1]).toBe(PAYTABLE[11]);
    expect(PAYTABLE[6]).toBeLessThan(PAYTABLE[0]); // center < edges
  });

  it("serverSeed has 64 hex chars (32 bytes entropy)", () => {
    const seed = randomServerSeed();
    expect(seed).toMatch(/^[0-9a-f]{64}$/);
  });

  it("nonce is a numeric string", () => {
    const nonce = randomNonce();
    expect(Number(nonce)).not.toBeNaN();
  });
});
