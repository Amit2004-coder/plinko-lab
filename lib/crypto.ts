import { createHash, randomBytes } from "crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function makeCommit(serverSeed: string, nonce: string): string {
  return sha256(`${serverSeed}:${nonce}`);
}

export function makeCombined(
  serverSeed: string,
  clientSeed: string,
  nonce: string
): string {
  return sha256(`${serverSeed}:${clientSeed}:${nonce}`);
}

export function randomServerSeed(): string {
  return randomBytes(32).toString("hex");
}

export function randomNonce(): string {
  return String(Math.floor(Math.random() * 1_000_000));
}
