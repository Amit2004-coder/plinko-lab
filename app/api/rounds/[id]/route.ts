import { NextRequest, NextResponse } from "next/server";
import { getRound } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const round = await getRound(id);
    if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });
    return NextResponse.json({
      ...round,
      serverSeed: round.status === "REVEALED" ? round.serverSeed : null,
      pathJson: JSON.parse(round.pathJson || "[]"),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
