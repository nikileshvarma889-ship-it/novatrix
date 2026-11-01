import { sql } from "@/lib/db";
import { HttpError } from "@/lib/http";
export async function findItem(ws: string, id: string) {
  const [i] = await sql`select * from inbox_items where id = ${id} and workspace_id = ${ws}`;
  if (!i) throw new HttpError(404, "Message not found.");
  return i;
}
