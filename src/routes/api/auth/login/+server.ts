import { json } from "@sveltejs/kit";
import { z } from "zod";
import { login } from "$lib/server/auth";
import { parseJson } from "$lib/server/http";
import type { RequestHandler } from "./$types";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const POST: RequestHandler = async (event) => {
  const input = await parseJson(event.request, LoginSchema);
  return json(await login(event, input.email, input.password));
};
