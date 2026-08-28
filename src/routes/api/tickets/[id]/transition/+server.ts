import { json } from "@sveltejs/kit";
import { z } from "zod";
import { authenticate } from "$lib/server/auth";
import { parseJson } from "$lib/server/http";
import { transitionTicket } from "$lib/server/ticket-service";
import type { RequestHandler } from "./$types";

const TransitionSchema = z.object({
  to: z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
  note: z.string().max(2000).optional()
});

export const POST: RequestHandler = async (event) => {
  const { db, auth } = await authenticate(event);
  const input = await parseJson(event.request, TransitionSchema);
  return json(await transitionTicket(db, event.params.id, input.to, input.note, auth.agentId));
};
