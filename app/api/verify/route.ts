import { NextRequest, NextResponse } from "next/server";
import { makeCommit, makeCombined } from "@/lib/crypto";
import { runEngine } from "@/lib/engine";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const serverSeed = searchParams.get("serverSeed");
  const clientSeed = searchParams.get("clientSeed");
  const nonce = searchParams.get("nonce");
  const dropColumn = Number(searchParams.get("dropColumn") ?? "6");

  if (!serverSeed || !clientSeed || !nonce) {
    return NextResponse.json(
      { error: "serverSeed, clientSeed, nonce are required" },
      { status: 400 }
    );
  }

  const commitHex = makeCommit(serverSeed, nonce);
  const combinedSeed = makeCombined(serverSeed, clientSeed, nonce);
  const { pegMapHash, binIndex, path, pegMap } = runEngine(combinedSeed, dropColumn);

  return NextResponse.json({
    commitHex,
    combinedSeed,
    pegMapHash,
    binIndex,
    path,
    pegMap,
  });
}
