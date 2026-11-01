import { sql } from "@/lib/db";
import { HttpError } from "@/lib/http";

export async function findVideo(ws: string, id: string) {
  const [v] = await sql`select * from videos where id = ${id} and workspace_id = ${ws}`;
  if (!v) throw new HttpError(404, "Video not found.");
  return v;
}
