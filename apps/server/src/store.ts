import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { LiveEvent } from "../../../packages/shared/src/index.ts";

export class Store {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    const version = this.db.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    if (version.user_version > 1) {
      this.db.close();
      throw new Error(
        "Database schema is newer than this app; use the matching release.",
      );
    }
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, payload TEXT NOT NULL, result TEXT NOT NULL, received_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      PRAGMA user_version=1;`);
  }
  load<T>(): T | undefined {
    const row = this.db.prepare("SELECT value FROM state WHERE id=1").get() as
      { value: string } | undefined;
    return row ? (JSON.parse(row.value) as T) : undefined;
  }
  save(value: unknown) {
    this.db
      .prepare(
        "INSERT INTO state(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
      )
      .run(JSON.stringify(value));
  }
  getConfig(key: string): string | undefined {
    const row = this.db
      .prepare("SELECT value FROM config WHERE key=?")
      .get(key) as { value: string } | undefined;
    return row?.value;
  }
  setConfig(key: string, value: string | null) {
    if (value === null || value === "")
      this.db.prepare("DELETE FROM config WHERE key=?").run(key);
    else
      this.db
        .prepare(
          "INSERT INTO config(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        )
        .run(key, value);
  }
  hasEvent(id: string) {
    return !!this.db.prepare("SELECT 1 FROM events WHERE id=?").get(id);
  }
  record(event: LiveEvent, result: string, at: number) {
    this.db
      .prepare("INSERT INTO events VALUES(?,?,?,?)")
      .run(event.id, JSON.stringify(event), result, at);
  }
  replayEvents(limit = 20): LiveEvent[] {
    return (
      this.db
        .prepare(
          "SELECT payload FROM events ORDER BY received_at DESC,rowid DESC LIMIT ?",
        )
        .all(limit) as { payload: string }[]
    )
      .reverse()
      .map((r) => JSON.parse(r.payload));
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  close() {
    this.db.close();
  }
}
