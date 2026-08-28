import { json } from "@sveltejs/kit";
import { z } from "zod";
import { authenticate } from "$lib/server/auth";
import { parseJson } from "$lib/server/http";
import { assignTicket } from "$lib/server/ticket-service";
import type { RequestHandler } from "./$types";

const AssignSchema = z.object({ agentId: z.string().min(1).optional() });

export const POST: RequestHandler = async (event) => {
  const { db, auth } = await authenticate(event);
  const input = await parseJson(event.request, AssignSchema);
  return json(await assignTicket(db, event.params.id, input.agentId, auth.agentId));
};
