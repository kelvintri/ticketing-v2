import { authenticate } from "$lib/server/auth";
import { markTicketRead } from "$lib/server/ticket-service";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async (event) => {
  const { db, auth } = await authenticate(event);
  await markTicketRead(db, auth.agentId, event.params.id);
  return new Response(null, { status: 204 });
};
