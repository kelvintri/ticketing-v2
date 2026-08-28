import { json } from "@sveltejs/kit";
import { authenticate } from "$lib/server/auth";
import { getTicket } from "$lib/server/ticket-service";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
  const { db } = await authenticate(event);
  return json(await getTicket(db, event.params.id));
};
