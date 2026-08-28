import type { Handle, HandleServerError } from "@sveltejs/kit";
import { readTokenAuth } from "$lib/server/auth";

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.auth = null;
  try {
    event.locals.auth = await readTokenAuth(event.request, event.platform);
  } catch {
    // Public pages and login requests do not carry a bearer token.
  }
  return resolve(event);
};

export const handleError: HandleServerError = ({ error, event }) => {
  console.error(
    JSON.stringify({
      type: "server_error",
      path: event.url.pathname,
      method: event.request.method,
      error: error instanceof Error ? error.message : String(error)
    })
  );

  return { message: "Internal server error" };
};
