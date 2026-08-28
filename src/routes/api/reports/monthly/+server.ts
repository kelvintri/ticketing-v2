import { authenticate } from "$lib/server/auth";
import { monthlyCsv } from "$lib/server/report-service";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async (event) => {
  const { db } = await authenticate(event);
  const month = event.url.searchParams.get("month") ?? "";
  const csv = await monthlyCsv(db, month);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ticket-report-${month}.csv"`
    }
  });
};
