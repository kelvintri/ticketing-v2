import { json } from "@sveltejs/kit";
import { authenticate } from "$lib/server/auth";
import { getAgentNotifications } from "$lib/server/notification-service";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
  const { db, auth } = await authenticate(event);
  return json(await getAgentNotifications(db, auth.agentId));
};
