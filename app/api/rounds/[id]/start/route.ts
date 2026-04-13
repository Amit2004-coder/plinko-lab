import { NextRequest, NextResponse } from "next/server";
import { getRound, updateRound } from "@/lib/db";
import { makeCombined } from "@/lib/crypto";
import { runEngine, PAYTABLE, ROWS } from "@/lib/engine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { clientSeed, betCents, dropColumn } = await req.json();
    if (!clientSeed || typeof clientSeed !== "string")
      return NextResponse.json({ error: "clientSeed required" }, { status: 400 });
    if (typeof betCents !== "number" || betCents < 1)
      return NextResponse.json({ error: "betCents must be positive" }, { status: 400 });
    if (typeof dropColumn !== "number" || dropColumn < 0 || dropColumn > ROWS)
      return NextResponse.json({ error: `dropColumn must be 0..${ROWS}` }, { status: 400 });

    const round = await getRound(id);
    if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });
    if (round.status !== "CREATED") return NextResponse.json({ error: "Round already started" }, { status: 409 });

    const combinedSeed = makeCombined(round.serverSeed!, clientSeed, round.nonce);
    const { pegMap, pegMapHash, path, binIndex } = runEngine(combinedSeed, dropColumn);
    const payoutMultiplier = PAYTABLE[binIndex] ?? 1;

    await updateRound(id, {
      status: "STARTED", clientSeed, combinedSeed, pegMapHash,
      dropColumn, binIndex, payoutMultiplier, betCents,
      pathJson: JSON.stringify(path), rows: ROWS,
    });

    return NextResponse.json({ roundId: id, pegMapHash, rows: ROWS, binIndex, payoutMultiplier, path, pegMap });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to start round" }, { status: 500 });
  }
}
