"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Confetti from "@/components/Confetti";
import RoundLog from "@/components/RoundLog";
import { useSounds } from "@/components/useSounds";

const PlinkoBoard = dynamic(() => import("@/components/PlinkoBoard"), { ssr: false });

const ROWS = 12;
const PAYTABLE = [16, 9, 4, 2, 1.5, 1.2, 1.0, 1.2, 1.5, 2, 4, 9, 16];
const BIN_COLORS = ["#f5c518","#f5c518","#ff6b00","#ff6b00","#00e5ff","#00e5ff","#00ff88","#00e5ff","#00e5ff","#ff6b00","#ff6b00","#f5c518","#f5c518"];

type Phase = "idle" | "animating" | "landed";

interface RoundState {
  roundId: string; commitHex: string; nonce: string;
  pegMap: any; path: ("L"|"R")[]; binIndex: number;
  payoutMultiplier: number; serverSeed: string | null;
  combinedSeed: string; pegMapHash: string;
}

export default function GamePage() {
  const [dropColumn, setDropColumn] = useState(6);
  const [betAmount, setBetAmount] = useState(100);
  const [clientSeed, setClientSeed] = useState("player-seed");
  const [muted, setMuted] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<RoundState | null>(null);
  const [error, setError] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [logKey, setLogKey] = useState(0);
  const [balance, setBalance] = useState(10000);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [tiltMode, setTiltMode] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [goldenStreak, setGoldenStreak] = useState(0);
  const isGolden = goldenStreak >= 3;
  const [dungeonMode, setDungeonMode] = useState(false);
  const secretBufRef = useRef("");
  const [reducedMotion] = useState(false);

  const sounds = useSounds(muted);

  useEffect(() => {
    setClientSeed(`player-${Date.now().toString(36)}`);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const buf = (secretBufRef.current + e.key).slice(-11);
      secretBufRef.current = buf;
      if (buf === "open sesame") { setDungeonMode(d => !d); secretBufRef.current = ""; }
      if (document.activeElement?.tagName === "INPUT") return;
      if (e.key === "ArrowLeft")  { e.preventDefault(); setDropColumn(c => Math.max(0, c-1)); }
      if (e.key === "ArrowRight") { e.preventDefault(); setDropColumn(c => Math.min(ROWS, c+1)); }
      if (e.key === " ")          { e.preventDefault(); /* handled via ref */ }
      if (e.key === "t" || e.key === "T") setTiltMode(t => !t);
      if (e.key === "g" || e.key === "G") setShowDebug(d => !d);
      if (e.key === "m" || e.key === "M") setMuted(m => !m);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === " " && phaseRef.current === "idle" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        dropRef.current?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleDrop = useCallback(async () => {
    if (phaseRef.current !== "idle") return;
    if (betAmount > balance) { setError("Insufficient balance"); return; }
    setError("");
    try {
      const commitRes = await fetch("/api/rounds/commit", { method: "POST" });
      const { roundId, commitHex, nonce } = await commitRes.json();
      const startRes = await fetch(`/api/rounds/${roundId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientSeed, betCents: betAmount, dropColumn }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) throw new Error(startData.error);
      setBalance(b => b - betAmount);
      setRound({ roundId, commitHex, nonce, pegMap: startData.pegMap, path: startData.path,
        binIndex: startData.binIndex, payoutMultiplier: startData.payoutMultiplier,
        serverSeed: null, combinedSeed: "", pegMapHash: startData.pegMapHash });
      setPhase("animating");
      sounds.dropSound();
    } catch (e: any) { setError(e.message || "Network error"); }
  }, [betAmount, balance, clientSeed, dropColumn, sounds]);

  const dropRef = useRef(handleDrop);
  dropRef.current = handleDrop;

  const handleAnimationComplete = useCallback(async (binIndex: number) => {
    if (!round) return;
    setPhase("landed");
    sounds.landSound(binIndex);
    const win = Math.round(betAmount * round.payoutMultiplier);
    setBalance(b => b + win);
    setLastWin(win);
    setGoldenStreak(s => binIndex === 6 ? s + 1 : 0);
    if (round.payoutMultiplier >= 2) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1500);
    }
    try {
      await fetch(`/api/rounds/${round.roundId}/reveal`, { method: "POST" });
      const fullRes = await fetch(`/api/rounds/${round.roundId}`);
      const fullRound = await fullRes.json();
      setRound(r => r ? { ...r, serverSeed: fullRound.serverSeed, combinedSeed: fullRound.combinedSeed } : r);
    } catch {}
    setLogKey(k => k + 1);
  }, [round, betAmount, sounds]);

  const handleReset = () => {
    setPhase("idle"); setRound(null); setLastWin(null); setShowConfetti(false);
    setClientSeed(`player-${Date.now().toString(36)}`);
  };

  const paytableRow = PAYTABLE.map((m, i) => ({ bin: i, mult: m, color: BIN_COLORS[i] }));

  return (
    <div className={`min-h-screen p-3 md:p-6 ${dungeonMode ? "dungeon-theme" : ""}`}>
      <header className="flex items-center justify-between mb-6 max-w-5xl mx-auto">
        <div>
          <h1 className="font-display text-xl md:text-3xl font-black tracking-wider glow-gold">PLINKO LAB</h1>
          <p className="text-gray-500 text-xs font-mono-game tracking-widest mt-0.5">PROVABLY FAIR · DAPHNIS LABS</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/verify" className="btn-neon text-xs px-3 py-1.5 rounded hidden sm:block">Verify</a>
          <button onClick={() => setMuted(m => !m)} className="text-gray-400 hover:text-yellow-400 transition-colors text-lg" aria-label={muted?"Unmute":"Mute"} title="M">{muted?"🔇":"🔊"}</button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto grid md:grid-cols-[1fr_280px] gap-5">
        <div className="space-y-4">
          {/* Balance */}
          <div className="flex items-center justify-between border-glow rounded-lg px-4 py-2 bg-[var(--bg-card)]">
            <div>
              <span className="text-gray-500 text-xs font-mono-game uppercase tracking-wider">Balance</span>
              <div className="font-display text-lg text-[var(--neon-gold)] glow-gold">{balance.toLocaleString()} <span className="text-xs">¢</span></div>
            </div>
            {lastWin !== null && (
              <div className="text-right">
                <span className="text-gray-500 text-xs font-mono-game">Last Win</span>
                <div className={`font-display text-lg ${lastWin >= betAmount*2?"glow-gold text-[var(--neon-gold)]":"text-[var(--neon-cyan)]"}`}>+{lastWin.toLocaleString()}¢</div>
              </div>
            )}
          </div>

          {/* Board */}
          <div className={`relative border-glow rounded-xl overflow-hidden bg-[var(--bg-card)] ${tiltMode?"tilt-mode":""}`}>
            <Confetti active={showConfetti} />
            {isGolden && phase==="idle" && <div className="absolute top-2 right-2 z-10 text-xs font-display text-yellow-300 glow-gold animate-pulse">✨ GOLDEN BALL</div>}
            {dungeonMode && <div className="absolute top-2 left-2 z-10 text-xs font-mono-game text-orange-400">🕯️ DUNGEON MODE</div>}
            <PlinkoBoard pegMap={round?.pegMap??null} path={round?.path??null} dropColumn={dropColumn}
              rows={ROWS} isAnimating={phase==="animating"} isGolden={isGolden} showDebug={showDebug}
              onAnimationComplete={handleAnimationComplete} onPegTick={sounds.pegTick} reducedMotion={reducedMotion} />
            {phase==="landed" && round && (
              <div className="absolute inset-x-0 top-4 flex justify-center pointer-events-none">
                <div className="border px-5 py-2 rounded-full font-display text-sm backdrop-blur-sm"
                  style={{borderColor:BIN_COLORS[round.binIndex],color:BIN_COLORS[round.binIndex],boxShadow:`0 0 20px ${BIN_COLORS[round.binIndex]}`,background:"rgba(0,0,0,0.7)"}}>
                  BIN {round.binIndex} · {round.payoutMultiplier}x
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="border-glow rounded-xl p-4 bg-[var(--bg-card)] space-y-4">
            <div>
              <label className="block text-xs font-mono-game text-gray-400 uppercase tracking-wider mb-2">Drop Column (← →)</label>
              <div className="flex items-center gap-3">
                <button onClick={() => setDropColumn(c=>Math.max(0,c-1))} disabled={phase!=="idle"} className="btn-neon w-8 h-8 rounded flex items-center justify-center text-sm" aria-label="Left">‹</button>
                <input type="range" min={0} max={ROWS} value={dropColumn} onChange={e=>setDropColumn(Number(e.target.value))} disabled={phase!=="idle"} className="flex-1 accent-yellow-400 h-2" aria-label="Drop column" />
                <button onClick={() => setDropColumn(c=>Math.min(ROWS,c+1))} disabled={phase!=="idle"} className="btn-neon w-8 h-8 rounded flex items-center justify-center text-sm" aria-label="Right">›</button>
                <span className="font-display text-[var(--neon-gold)] w-6 text-center text-sm">{dropColumn}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono-game text-gray-400 uppercase tracking-wider mb-1">Bet (¢)</label>
                <input type="number" min={1} max={balance} value={betAmount} onChange={e=>setBetAmount(Math.max(1,Number(e.target.value)))} disabled={phase!=="idle"} className="input-neon w-full rounded px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-mono-game text-gray-400 uppercase tracking-wider mb-1">Client Seed</label>
                <input type="text" value={clientSeed} onChange={e=>setClientSeed(e.target.value)} disabled={phase!=="idle"} className="input-neon w-full rounded px-3 py-1.5 text-sm" />
              </div>
            </div>
            {error && <p className="text-red-400 text-xs font-mono-game">{error}</p>}
            {phase==="idle"||phase==="animating" ? (
              <button onClick={handleDrop} disabled={phase==="animating"} className="btn-drop w-full py-3 rounded-lg text-sm tracking-widest">
                {phase==="animating"?"DROPPING…":"▼ DROP (SPACE)"}
              </button>
            ) : (
              <button onClick={handleReset} className="btn-neon w-full py-3 rounded-lg text-sm tracking-widest">PLAY AGAIN</button>
            )}
          </div>

          {/* Fairness proof */}
          {round?.serverSeed && (
            <div className="border border-[var(--neon-cyan)]/20 rounded-lg p-3 bg-[var(--bg-card)] text-[10px] font-mono-game space-y-1">
              <div className="text-[var(--neon-cyan)] font-display text-xs tracking-widest mb-2">FAIRNESS PROOF REVEALED</div>
              {[["Server Seed",round.serverSeed],["Client Seed",clientSeed],["Nonce",round.nonce],["Commit",round.commitHex],["Combined",round.combinedSeed],["Peg Map Hash",round.pegMapHash]].map(([k,v])=>(
                <div key={k} className="flex gap-2 overflow-hidden">
                  <span className="text-gray-500 shrink-0 w-24">{k}:</span>
                  <span className="text-[var(--neon-cyan)] truncate">{v}</span>
                </div>
              ))}
              <a href={`/verify?roundId=${round.roundId}&serverSeed=${encodeURIComponent(round.serverSeed!)}&clientSeed=${encodeURIComponent(clientSeed)}&nonce=${round.nonce}&dropColumn=${dropColumn}`}
                target="_blank" rel="noreferrer" className="inline-block mt-2 text-[var(--neon-gold)] hover:underline">→ Open Verifier ↗</a>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="border-glow rounded-lg p-4 bg-[var(--bg-card)]">
            <h3 className="font-display text-xs tracking-widest text-[var(--neon-gold)] mb-3 uppercase">Paytable</h3>
            <div className="grid grid-cols-7 gap-0.5">
              {paytableRow.map(({bin,mult,color})=>(
                <div key={bin} className={`text-center rounded py-1 text-[9px] font-display transition-all ${round&&round.binIndex===bin&&phase==="landed"?"scale-110":""}`}
                  style={{color,background:round&&round.binIndex===bin&&phase==="landed"?`${color}33`:"transparent"}}>
                  <div>{bin}</div><div className="font-bold">{mult}x</div>
                </div>
              ))}
            </div>
          </div>
          <RoundLog refreshKey={logKey} />
          <div className="border-glow rounded-lg p-3 bg-[var(--bg-card)] text-[10px] font-mono-game text-gray-500 space-y-1">
            <div className="text-[var(--neon-gold)] text-xs font-display tracking-widest mb-2">CONTROLS</div>
            {[["← →","Move column"],["SPACE","Drop"],["M","Mute"],["T","Tilt 🕹️"],["G","Debug"]].map(([k,v])=>(
              <div key={k} className="flex justify-between"><span className="text-gray-400 font-bold">{k}</span><span>{v}</span></div>
            ))}
          </div>
          <a href="/verify" className="btn-neon block text-center py-2 rounded-lg text-xs w-full sm:hidden">Verifier Page</a>
        </div>
      </div>
      <footer className="text-center mt-8 text-gray-700 text-[10px] font-mono-game">Plinko Lab · Provably Fair · No Real Money · Daphnis Labs</footer>
    </div>
  );
}
