import { NextResponse } from "next/server";
import { createRound } from "@/lib/db";
import { makeCommit, randomServerSeed, randomNonce } from "@/lib/crypto";

export async function POST() {
  try {
    const serverSeed = randomServerSeed();
    const nonce = randomNonce();
    const commitHex = makeCommit(serverSeed, nonce);
    const round = await createRound({ serverSeed, nonce, commitHex });
    return NextResponse.json({ roundId: round.id, commitHex: round.commitHex, nonce: round.nonce });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create round" }, { status: 500 });
  }
}
