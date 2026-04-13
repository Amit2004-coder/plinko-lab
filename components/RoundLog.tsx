"use client";
import { useEffect, useState } from "react";

interface RoundSummary {
  id: string;
  status: string;
  binIndex: number;
  payoutMultiplier: number;
  betCents: number;
  dropColumn: number;
  createdAt: string;
}

const BIN_COLORS = ["#f5c518","#f5c518","#ff6b00","#ff6b00","#00e5ff","#00e5ff","#00ff88","#00e5ff","#00e5ff","#ff6b00","#ff6b00","#f5c518","#f5c518"];

export default function RoundLog({ refreshKey }: { refreshKey: number }) {
  const [rounds, setRounds] = useState<RoundSummary[]>([]);

  useEffect(() => {
    fetch("/api/rounds?limit=12")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setRounds(data))
      .catch(() => {});
  }, [refreshKey]);

  return (
    <div className="border-glow rounded-lg p-4 bg-[var(--bg-card)]">
      <h3 className="font-display text-xs tracking-widest text-[var(--neon-gold)] mb-3 uppercase">
        Recent Rounds
      </h3>
      {rounds.length === 0 ? (
        <p className="text-gray-600 text-xs font-mono-game">No rounds yet</p>
      ) : (
        <div className="space-y-1.5">
          {rounds.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between text-xs font-mono-game py-1 border-b border-gray-800/60"
            >
              <span className="text-gray-500 truncate max-w-[80px]" title={r.id}>
                {r.id.slice(-6)}
              </span>
              <span style={{ color: BIN_COLORS[r.binIndex] }}>
                bin {r.binIndex}
              </span>
              <span className="text-[var(--neon-gold)]">{r.payoutMultiplier}x</span>
              <a
                href={`/verify?roundId=${r.id}`}
                className="text-gray-500 hover:text-[var(--neon-cyan)] transition-colors text-[10px] ml-1"
              >
                verify
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
