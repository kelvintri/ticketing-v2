import { copyFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const output = resolve(".svelte-kit/cloudflare/_worker.js");
const svelteKitWorker = resolve(".svelte-kit/cloudflare/_sveltekit.js");

copyFileSync(output, svelteKitWorker);
writeFileSync(
  output,
  `import svelteKit from "./_sveltekit.js";
import { sweepBreachedSla } from "../../src/lib/server/sla-service.ts";

export default {
  fetch: svelteKit.fetch,
  scheduled(_controller, env, context) {
    context.waitUntil(sweepBreachedSla(env.DB));
  }
};
`
);
