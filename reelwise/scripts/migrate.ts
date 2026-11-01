// Applies db/migrations/*.sql in order, once each.
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
const sql = postgres(url, { max: 1, onnotice: () => {} });
const dir = path.join(process.cwd(), "db/migrations");

async function main() {
  const [{ exists }] = await sql`select to_regclass('public.schema_migrations') is not null as exists`;
  const applied = new Set<string>(exists ? (await sql`select name from schema_migrations`).map((r) => r.name as string) : []);
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (applied.has(file)) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(fs.readFileSync(path.join(dir, file), "utf8"));
      await tx`insert into schema_migrations (name) values (${file})`;
    });
    console.log(`applied ${file}`);
  }
  await sql.end();
}
main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
