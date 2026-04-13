import { NextRequest, NextResponse } from "next/server";
import { getRound, updateRound } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const round = await getRound(id);
    if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });
    if (round.status === "CREATED") return NextResponse.json({ error: "Round not started" }, { status: 409 });
    const updated = await updateRound(id, { status: "REVEALED", revealedAt: new Date().toISOString() });
    return NextResponse.json({ serverSeed: updated.serverSeed });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to reveal" }, { status: 500 });
  }
}
