import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ platform }) => {
  const database = platform?.env.DB;
  if (!database) {
    return json({ ok: false, error: "D1 database binding is unavailable" }, { status: 503 });
  }

  const result = await database.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return json({ ok: result?.ok === 1, phase: 1, runtime: "cloudflare-workers" });
};
