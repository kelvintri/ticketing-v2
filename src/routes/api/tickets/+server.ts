import { json } from "@sveltejs/kit";
import { authenticate } from "$lib/server/auth";
import {
  TicketPrioritySchema,
  TicketStatusSchema
} from "@tickets/shared";
import { z } from "zod";
import { parseJson } from "$lib/server/http";
import { createTicket, listTickets } from "$lib/server/ticket-service";
import type { RequestHandler } from "./$types";

const ListQuerySchema = z.object({
  status: TicketStatusSchema.optional(),
  agentId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  search: z.string().min(1).optional(),
  from: z.string().min(1).optional(),
  to: z.string().min(1).optional()
});
const CreateTicketSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(1).max(5000),
  categoryId: z.string().min(1),
  priority: TicketPrioritySchema.default("MEDIUM"),
  userId: z.string().min(1).optional()
});

export const GET: RequestHandler = async (event) => {
  const { db } = await authenticate(event);
  const query = Object.fromEntries(event.url.searchParams.entries());
  const filter = ListQuerySchema.parse(query);
  return json(await listTickets(db, filter));
};

export const POST: RequestHandler = async (event) => {
  const { db } = await authenticate(event);
  const input = await parseJson(event.request, CreateTicketSchema);
  return json(await createTicket(db, { ...input, priority: input.priority ?? "MEDIUM", source: "MANUAL" }), { status: 201 });
};
