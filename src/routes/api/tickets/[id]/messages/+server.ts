import { json } from "@sveltejs/kit";
import { z } from "zod";
import { authenticate } from "$lib/server/auth";
import { parseJson } from "$lib/server/http";
import { addMessageForTicket } from "$lib/server/ticket-service";
import type { RequestHandler } from "./$types";

const MessageSchema = z.object({
  body: z.string().min(1).max(10000),
  senderType: z.enum(["USER", "AGENT", "AI"])
});

export const POST: RequestHandler = async (event) => {
  const { db, auth } = await authenticate(event);
  const input = await parseJson(event.request, MessageSchema);
  return json(
    await addMessageForTicket(db, {
      ticketId: event.params.id,
      body: input.body,
      senderType: input.senderType,
      senderId: input.senderType === "AGENT" ? auth.agentId : undefined
    }),
    { status: 201 }
  );
};
