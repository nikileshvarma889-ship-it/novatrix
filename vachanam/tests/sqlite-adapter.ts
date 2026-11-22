import { DatabaseSync } from "node:sqlite";
/** Minimal expo-sqlite-compatible async wrapper over node:sqlite, so app data code runs against real SQLite in tests. */
export function testDb() {
  const d = new DatabaseSync(":memory:");
  const norm = (p?: unknown[]) => (p ?? []).map((x) => (x === undefined ? null : x)) as any[];
  return {
    execAsync: async (sql: string) => { d.exec(sql); },
    getAllAsync: async <T,>(sql: string, p?: unknown[]) => d.prepare(sql).all(...norm(p)) as T[],
    getFirstAsync: async <T,>(sql: string, p?: unknown[]) => (d.prepare(sql).get(...norm(p)) ?? null) as T | null,
    runAsync: async (sql: string, p?: unknown[]) => { const r = d.prepare(sql).run(...norm(p)); return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) }; },
    withTransactionAsync: async (fn: () => Promise<void>) => { d.exec("BEGIN"); try { await fn(); d.exec("COMMIT"); } catch (e) { d.exec("ROLLBACK"); throw e; } },
  };
}
