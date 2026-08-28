import { json } from "@sveltejs/kit";
import { authenticate } from "$lib/server/auth";
import { regenerateJoinCode } from "$lib/server/user-service";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async (event) => {
  const { db } = await authenticate(event);
  return json(await regenerateJoinCode(db, event.params.id));
};
