import { error, json } from "@sveltejs/kit";
import { authenticate } from "$lib/server/auth";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
  const { db, auth } = await authenticate(event);
  const agent = await db
    .prepare(
      "SELECT id, email, name, role, active, createdAt FROM Agent WHERE id = ? LIMIT 1"
    )
    .bind(auth.agentId)
    .first<{ id: string; email: string; name: string; role: string; active: number | boolean; createdAt: string }>();
  if (!agent || !(agent.active === true || agent.active === 1)) throw error(401, "Agen tidak aktif");
  return json(agent);
};
