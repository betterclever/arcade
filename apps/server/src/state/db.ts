import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { Database } from "bun:sqlite";
import { config } from "../config";
import type { AdSurface, AuctionRound, Bid, PaymentLedgerEntry, TextureUpdate } from "../types";

export interface StoreSnapshot {
  surfaces: AdSurface[];
  rounds: AuctionRound[];
  bids: Bid[];
  payments: PaymentLedgerEntry[];
  textures: TextureUpdate[];
}

const dbPath = isAbsolute(config.databasePath)
  ? config.databasePath
  : resolve(process.cwd(), config.databasePath);

mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  CREATE TABLE IF NOT EXISTS arcad_state (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

const selectState = db.query<{ data: string }, [string]>("SELECT data FROM arcad_state WHERE id = ?");
const upsertState = db.query(`
  INSERT INTO arcad_state (id, version, data, updated_at)
  VALUES ('default', 1, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    version = excluded.version,
    data = excluded.data,
    updated_at = excluded.updated_at
`);

export function loadStoreSnapshot(): StoreSnapshot | null {
  const row = selectState.get("default");
  if (!row?.data) return null;
  return JSON.parse(row.data) as StoreSnapshot;
}

export function saveStoreSnapshot(snapshot: StoreSnapshot) {
  upsertState.run(JSON.stringify(snapshot, jsonReplacer), Date.now());
}

export function getDatabasePath() {
  return dbPath;
}

function jsonReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}
