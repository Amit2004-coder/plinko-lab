"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface VerifyResult {
  commitHex: string;
  combinedSeed: string;
  pegMapHash: string;
  binIndex: number;
  path: ("L" | "R")[];
}

interface StoredRound {
  commitHex: string;
  pegMapHash: string;
  binIndex: number;
  combinedSeed: string;
  status: string;
}

function VerifierForm() {
  const params = useSearchParams();

  const [serverSeed, setServerSeed] = useState(params.get("serverSeed") ?? "");
  const [clientSeed, setClientSeed] = useState(params.get("clientSeed") ?? "");
  const [nonce, setNonce] = useState(params.get("nonce") ?? "");
  const [dropColumn, setDropColumn] = useState(Number(params.get("dropColumn") ?? 6));
  const [roundId, setRoundId] = useState(params.get("roundId") ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [stored, setStored] = useState<StoredRound | null>(null);
  const [error, setError] = useState("");

  // Auto-load stored round
  useEffect(() => {
    if (!roundId) return;
    fetch(`/api/rounds/${roundId}`)
      .then(r => r.json())
      .then(d => {
        setStored(d);
        if (d.serverSeed) setServerSeed(d.serverSeed);
        if (d.clientSeed) setClientSeed(d.clientSeed);
        if (d.nonce) setNonce(d.nonce);
        if (d.dropColumn !== undefined) setDropColumn(d.dropColumn);
      })
      .catch(() => {});
  }, [roundId]);

  const handleVerify = async () => {
    if (!serverSeed || !clientSeed || !nonce) {
      setError("All three seeds and nonce are required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/verify?serverSeed=${encodeURIComponent(serverSeed)}&clientSeed=${encodeURIComponent(clientSeed)}&nonce=${encodeURIComponent(nonce)}&dropColumn=${dropColumn}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const matches = result && stored ? {
    commitHex: result.commitHex === stored.commitHex,
    combinedSeed: result.combinedSeed === stored.combinedSeed,
    pegMapHash: result.pegMapHash === stored.pegMapHash,
    binIndex: result.binIndex === stored.binIndex,
  } : null;

  const allMatch = matches && Object.values(matches).every(Boolean);

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <a href="/" className="btn-neon px-3 py-1.5 rounded text-xs">← Game</a>
          <div>
            <h1 className="font-display text-2xl font-black tracking-wider glow-gold">VERIFIER</h1>
            <p className="text-gray-500 text-xs font-mono-game">Prove fairness · Replay any round</p>
          </div>
        </div>

        {/* Inputs */}
        <div className="border-glow rounded-xl p-5 bg-[var(--bg-card)] space-y-4 mb-5">
          <h2 className="font-display text-sm tracking-widest text-[var(--neon-cyan)] uppercase">Inputs</h2>

          {[
            { label: "Round ID (optional — auto-fills fields)", val: roundId, set: setRoundId, ph: "cuid..." },
            { label: "Server Seed (revealed post-round)", val: serverSeed, set: setServerSeed, ph: "hex string..." },
            { label: "Client Seed", val: clientSeed, set: setClientSeed, ph: "player seed..." },
            { label: "Nonce", val: nonce, set: setNonce, ph: "42" },
          ].map(({ label, val, set, ph }) => (
            <div key={label}>
              <label className="block text-xs font-mono-game text-gray-400 uppercase tracking-wider mb-1">{label}</label>
              <input
                type="text"
                value={val}
                onChange={e => set(e.target.value)}
                placeholder={ph}
                className="input-neon w-full rounded px-3 py-2 text-sm"
              />
            </div>
          ))}

          <div>
            <label className="block text-xs font-mono-game text-gray-400 uppercase tracking-wider mb-1">
              Drop Column (0–12)
            </label>
            <input
              type="number"
              min={0}
              max={12}
              value={dropColumn}
              onChange={e => setDropColumn(Number(e.target.value))}
              className="input-neon rounded px-3 py-2 text-sm w-24"
            />
          </div>

          {error && <p className="text-red-400 text-xs font-mono-game">{error}</p>}

          <button
            onClick={handleVerify}
            disabled={loading}
            className="btn-drop w-full py-3 rounded-lg text-sm tracking-widest"
          >
            {loading ? "VERIFYING…" : "VERIFY ROUND"}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className="border-glow rounded-xl p-5 bg-[var(--bg-card)] space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-sm tracking-widest text-[var(--neon-cyan)] uppercase">Result</h2>
              {matches && (
                <span className={`font-display text-sm px-3 py-0.5 rounded-full border ${allMatch ? "border-green-400 text-green-400" : "border-red-400 text-red-400"}`}>
                  {allMatch ? "✅ VERIFIED" : "❌ MISMATCH"}
                </span>
              )}
            </div>

            {/* Derived values */}
            <div className="space-y-2">
              {[
                ["Commit Hash", result.commitHex, matches?.commitHex],
                ["Combined Seed", result.combinedSeed, matches?.combinedSeed],
                ["Peg Map Hash", result.pegMapHash, matches?.pegMapHash],
              ].map(([label, val, match]) => (
                <div key={label as string}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-gray-500 text-[10px] font-mono-game uppercase">{label}</span>
                    {match !== undefined && (
                      <span className={`text-[10px] ${match ? "text-green-400" : "text-red-400"}`}>
                        {match ? "✓ match" : "✗ mismatch"}
                      </span>
                    )}
                  </div>
                  <div className="text-[var(--neon-cyan)] text-[11px] font-mono-game break-all bg-black/30 rounded px-2 py-1">
                    {val as string}
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-4 pt-2">
                <div>
                  <span className="text-gray-500 text-[10px] font-mono-game uppercase block">Bin Index</span>
                  <span
                    className="font-display text-2xl"
                    style={{ color: matches?.binIndex === false ? "#f44" : "#f5c518" }}
                  >
                    {result.binIndex}
                    {matches !== null && (
                      <span className="text-sm ml-2">{matches.binIndex ? "✓" : "✗"}</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Path replay */}
            <div>
              <h3 className="text-xs font-mono-game text-gray-400 uppercase tracking-wider mb-2">
                Ball Path (12 rows)
              </h3>
              <div className="flex flex-wrap gap-1">
                {result.path.map((d, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-display border"
                    style={{
                      borderColor: d === "L" ? "#00e5ff" : "#ff0080",
                      color: d === "L" ? "#00e5ff" : "#ff0080",
                      background: d === "L" ? "rgba(0,229,255,0.08)" : "rgba(255,0,128,0.08)",
                    }}
                  >
                    {d}
                  </span>
                ))}
              </div>
              <p className="text-gray-600 text-[10px] font-mono-game mt-1">
                {result.path.filter(d => d === "R").length} Rights → bin {result.binIndex}
              </p>
            </div>

            {/* Test vectors shortcut */}
            <div className="border border-gray-800 rounded-lg p-3">
              <p className="text-gray-500 text-[10px] font-mono-game mb-2">Quick-load official test vectors:</p>
              <button
                className="btn-neon text-[10px] px-3 py-1 rounded"
                onClick={() => {
                  setServerSeed("b2a5f3f32a4d9c6ee7a8c1d33456677890abcdeffedcba0987654321ffeeddcc");
                  setClientSeed("candidate-hello");
                  setNonce("42");
                  setDropColumn(6);
                  setRoundId("");
                }}
              >
                Load Test Vectors
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="text-center p-10 text-gray-500 font-mono-game">Loading…</div>}>
      <VerifierForm />
    </Suspense>
  );
}
