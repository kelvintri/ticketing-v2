import type { D1Database } from "@cloudflare/workers-types";

export async function sweepBreachedSla(database: D1Database, now = new Date().toISOString()) {
  const openStatuses = ["OPEN", "ASSIGNED", "IN_PROGRESS"];
  const result = await database.batch([
    database
      .prepare(
        `UPDATE Ticket SET slaFirstResponseBreached = 1
         WHERE status IN (?, ?, ?) AND firstResponseAt IS NULL
           AND slaFirstResponseDueAt IS NOT NULL AND slaFirstResponseDueAt < ?
           AND slaFirstResponseBreached = 0`
      )
      .bind(...openStatuses, now),
    database
      .prepare(
        `UPDATE Ticket SET slaResolutionBreached = 1
         WHERE status IN (?, ?, ?) AND resolvedAt IS NULL
           AND slaResolutionDueAt IS NOT NULL AND slaResolutionDueAt < ?
           AND slaResolutionBreached = 0`
      )
      .bind(...openStatuses, now)
  ]);
  return result.map((entry) => entry.meta.changes);
}
