import postgres from "postgres";

// One pool per process (Next dev reloads modules, so cache on globalThis).
const g = globalThis as unknown as { __sql?: postgres.Sql };
export const sql: postgres.Sql =
  g.__sql ??
  postgres(process.env.DATABASE_URL ?? "postgres://invalid", {
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idle_timeout: 30,
    onnotice: () => {},
    transform: { undefined: null },
  });
if (process.env.NODE_ENV !== "production") g.__sql = sql;
