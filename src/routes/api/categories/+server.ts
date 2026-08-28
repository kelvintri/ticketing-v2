import { json } from "@sveltejs/kit";
import { authenticate } from "$lib/server/auth";
import { listCategories } from "$lib/server/user-service";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
  const { db } = await authenticate(event);
  return json(await listCategories(db));
};
