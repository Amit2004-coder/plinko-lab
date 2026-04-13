import { createClient, Client } from "@libsql/client";
import { randomBytes } from "crypto";

export interface Round {
  id: string;
  createdAt: string;
  status: string;
  nonce: string;
  commitHex: string;
  serverSeed: string | null;
  clientSeed: string;
  combinedSeed: string;
  pegMapHash: string;
  rows: number;
  dropColumn: number;
  binIndex: number;
  payoutMultiplier: number;
  betCents: number;
  pathJson: string;
  revealedAt: string | null;
}

let _client: Client | null = null;
function getClient(): Client {
  if (!_client) {
    const url = process.env.DATABASE_URL ?? "file:dev.db";
    _client = createClient({ url });
  }
  return _client;
}

let _initialised = false;
export async function ensureSchema(): Promise<void> {
  if (_initialised) return;
  const db = getClient();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS rounds (
      id               TEXT PRIMARY KEY,
      createdAt        TEXT NOT NULL,
      status           TEXT NOT NULL DEFAULT 'CREATED',
      nonce            TEXT NOT NULL DEFAULT '',
      commitHex        TEXT NOT NULL DEFAULT '',
      serverSeed       TEXT,
      clientSeed       TEXT NOT NULL DEFAULT '',
      combinedSeed     TEXT NOT NULL DEFAULT '',
      pegMapHash       TEXT NOT NULL DEFAULT '',
      rows             INTEGER NOT NULL DEFAULT 12,
      dropColumn       INTEGER NOT NULL DEFAULT 6,
      binIndex         INTEGER NOT NULL DEFAULT 0,
      payoutMultiplier REAL NOT NULL DEFAULT 1.0,
      betCents         INTEGER NOT NULL DEFAULT 100,
      pathJson         TEXT NOT NULL DEFAULT '[]',
      revealedAt       TEXT
    )
  `);
  _initialised = true;
}

function cuid(): string {
  return "c" + randomBytes(10).toString("hex");
}

export async function createRound(data: {
  nonce: string;
  commitHex: string;
  serverSeed: string;
}): Promise<Round> {
  await ensureSchema();
  const db = getClient();
  const id = cuid();
  const createdAt = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO rounds (id,createdAt,status,nonce,commitHex,serverSeed)
          VALUES (?,?,'CREATED',?,?,?)`,
    args: [id, createdAt, data.nonce, data.commitHex, data.serverSeed],
  });
  return (await getRound(id))!;
}

export async function getRound(id: string): Promise<Round | null> {
  await ensureSchema();
  const db = getClient();
  const res = await db.execute({ sql: "SELECT * FROM rounds WHERE id=?", args: [id] });
  if (!res.rows.length) return null;
  return rowToRound(res.rows[0] as Record<string, unknown>);
}

export async function updateRound(
  id: string,
  data: Partial<Omit<Round, "id" | "createdAt">>
): Promise<Round> {
  await ensureSchema();
  const db = getClient();
  const entries = Object.entries(data);
  const fields = entries.map(([k]) => `${k} = ?`).join(", ");
  const values = entries.map(([, v]) => v ?? null);
  await db.execute({ sql: `UPDATE rounds SET ${fields} WHERE id=?`, args: [...values, id] });
  return (await getRound(id))!;
}

export async function listRounds(limit = 20): Promise<Round[]> {
  await ensureSchema();
  const db = getClient();
  const res = await db.execute({
    sql: "SELECT * FROM rounds ORDER BY createdAt DESC LIMIT ?",
    args: [limit],
  });
  return res.rows.map((r) => rowToRound(r as Record<string, unknown>));
}

function rowToRound(row: Record<string, unknown>): Round {
  return {
    id: String(row.id),
    createdAt: String(row.createdAt),
    status: String(row.status),
    nonce: String(row.nonce),
    commitHex: String(row.commitHex),
    serverSeed: row.serverSeed != null ? String(row.serverSeed) : null,
    clientSeed: String(row.clientSeed ?? ""),
    combinedSeed: String(row.combinedSeed ?? ""),
    pegMapHash: String(row.pegMapHash ?? ""),
    rows: Number(row.rows ?? 12),
    dropColumn: Number(row.dropColumn ?? 6),
    binIndex: Number(row.binIndex ?? 0),
    payoutMultiplier: Number(row.payoutMultiplier ?? 1),
    betCents: Number(row.betCents ?? 100),
    pathJson: String(row.pathJson ?? "[]"),
    revealedAt: row.revealedAt != null ? String(row.revealedAt) : null,
  };
}
