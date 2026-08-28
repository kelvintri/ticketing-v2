import { json } from "@sveltejs/kit";
import { z } from "zod";
import { authenticate } from "$lib/server/auth";
import { parseJson } from "$lib/server/http";
import { rateTicket } from "$lib/server/ticket-service";
import type { RequestHandler } from "./$types";

const RateSchema = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional()
});

export const POST: RequestHandler = async (event) => {
  const { db } = await authenticate(event);
  const input = await parseJson(event.request, RateSchema);
  return json(await rateTicket(db, event.params.id, input.stars, input.comment));
};
