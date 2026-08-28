import { error } from "@sveltejs/kit";
import type { D1Database } from "@cloudflare/workers-types";

export type Database = D1Database;

export function createDatabase(platform: App.Platform | undefined): Database {
  const database = platform?.env.DB;
  if (!database) {
    throw error(503, "D1 database binding is unavailable");
  }

  return database;
}
