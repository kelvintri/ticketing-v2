import { json } from "@sveltejs/kit";
import { z } from "zod";
import { authenticate } from "$lib/server/auth";
import { parseJson } from "$lib/server/http";
import { createUser, listUsers } from "$lib/server/user-service";
import type { RequestHandler } from "./$types";

const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  department: z.string().max(100).optional()
});

export const GET: RequestHandler = async (event) => {
  const { db } = await authenticate(event);
  return json(await listUsers(db));
};

export const POST: RequestHandler = async (event) => {
  const { db } = await authenticate(event);
  const input = await parseJson(event.request, CreateUserSchema);
  return json(await createUser(db, input.name, input.department), { status: 201 });
};
