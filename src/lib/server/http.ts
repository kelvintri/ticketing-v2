import { json } from "@sveltejs/kit";
import { ZodError, type ZodSchema } from "zod";

export function apiError(message: string, status = 500) {
  return json({ error: message }, { status });
}

export async function parseJson<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw apiError("Invalid JSON body", 400);
  }

  try {
    return schema.parse(body);
  } catch (cause) {
    if (cause instanceof ZodError) {
      throw apiError(cause.issues[0]?.message ?? "Invalid request", 400);
    }
    throw cause;
  }
}
