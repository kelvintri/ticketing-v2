import { json } from "@sveltejs/kit";
import { z } from "zod";
import { authenticate } from "$lib/server/auth";
import { getOverview } from "$lib/server/kpi-service";
import type { RequestHandler } from "./$types";

const RangeQuerySchema = z.object({
  from: z.string().min(1).optional(),
  to: z.string().min(1).optional()
});

export const GET: RequestHandler = async (event) => {
  const { db } = await authenticate(event);
  const range = RangeQuerySchema.parse(Object.fromEntries(event.url.searchParams.entries()));
  return json(await getOverview(db, range));
};
