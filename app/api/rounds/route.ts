import { NextRequest, NextResponse } from "next/server";
import { listRounds } from "@/lib/db";

export async function GET(req: NextRequest) {
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? "20");
  const rounds = await listRounds(Math.min(limit, 50));
  return NextResponse.json(rounds.map(r => ({
    id: r.id, createdAt: r.createdAt, status: r.status,
    binIndex: r.binIndex, payoutMultiplier: r.payoutMultiplier,
    betCents: r.betCents, dropColumn: r.dropColumn, commitHex: r.commitHex,
  })));
}
