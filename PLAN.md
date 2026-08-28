# SvelteKit + Cloudflare Workers Migration Plan

## Objective
Rebuild the helpdesk ticketing application in a new `sveltekit-worker/` workspace so the frontend and backend deploy as one SvelteKit application on Cloudflare Workers.

## Target architecture

```text
SvelteKit routes and pages
        |
        +-- src/routes/api/*      API endpoints
        +-- src/lib/server/*      services, auth, database, integrations
        +-- adapter-cloudflare    Worker runtime
        +-- D1                    persistent SQLite-compatible data
        +-- Cloudflare Cron       SLA sweeper
        +-- Telegram webhook      inbound bot updates
        +-- ASSETS                static assets
```

SvelteKit server endpoints replace the current Express routers. Existing business rules and DTOs should be preserved where they do not depend on Node-only APIs.

## Phases

### 1. Scaffold the new application

- Create a standalone SvelteKit TypeScript app in `sveltekit-worker/`.
- Use `@sveltejs/adapter-cloudflare`, not the deprecated Workers Sites adapter.
- Configure Wrangler to build `.svelte-kit/cloudflare/_worker.js` and serve `.svelte-kit/cloudflare` assets.
- Add generated Cloudflare binding types and local platform proxy support.

### 2. Establish the Worker runtime boundary

- Add a typed `App.Platform.env` declaration for D1, assets, and secrets.
- Remove `process.env`, `dotenv`, filesystem path discovery, `process.exit`, `app.listen`, and other startup assumptions.
- Read configuration from `platform.env` in server-only modules.
- Keep browser code free of secrets and database access.

### 3. Move persistence from local SQLite to D1

- Create a Cloudflare D1 database for production.
- Port the existing Prisma migrations into D1 migrations.
- Use direct D1 prepared statements for the Worker runtime. This avoids bundling Prisma's WASM client and keeps database access on standard Cloudflare bindings.
- Make database access request-scoped through `platform.env.DB`; do not retain the current global Prisma singleton.
- Rewrite the interactive transaction in `ticketService.ts` using D1 batch semantics or an equivalent supported operation.
- Create a Worker-safe seed/import path.

### 4. Port authentication and API behavior

- Convert the eight current Express route groups into SvelteKit `+server.ts` endpoints.
- Preserve endpoint paths and JSON contracts so the existing dashboard can migrate incrementally.
- Replace Express middleware with SvelteKit `handle` hooks and endpoint helpers.
- Keep JWT verification and signing on Web Crypto-compatible APIs.
- Preserve password-hash compatibility; benchmark login on the Worker and change the hashing strategy only if the current bcrypt implementation is unsuitable.
- Preserve validation and error response shapes from the shared schemas.

### 5. Rebuild the frontend in SvelteKit

- Port login, protected layout, dashboard, tickets, ticket detail, knowledge, reports, and users pages.
- Replace React Query usage with SvelteKit load functions and form actions where server-side data fits; use client-side fetch only for interactive mutations or polling.
- Keep API calls same-origin.
- Preserve routes, authorization behavior, validation, and visible user workflows.
- Reuse `packages/shared` schemas/enums until the migration is stable, then move only the required shared code into the new workspace.

### 6. Replace non-Worker integrations

- Replace `node-cron` with a Worker `scheduled` handler and a Wrangler Cron Trigger every five minutes.
- Replace Telegram long polling with a signed webhook endpoint.
- Replace stdio MCP child-process spawning with an in-process tool registry, or isolate MCP into a separate HTTP Worker.
- Replace the process-global `EventEmitter` with direct `ctx.waitUntil()` work or a Cloudflare Queue for notifications.
- Keep Google Gemini calls on `fetch`-compatible APIs and load the API key from a Worker secret.

### 7. Gemini AI integration

#### Initial scope

- Add an optional server-side Gemini agent to the Telegram webhook path.
- Keep `AI_MODE=off` as the default and preserve the deterministic ticket-intake flow as the fallback.
- Start with read-only assistance: FAQ/knowledge search, ticket status lookup, triage guidance, and handoff. Ticket creation or mutation remains behind the existing explicit confirmation flow.
- Keep the browser/UI out of scope for this increment; expose no Gemini key or model call to client code.

#### Runtime design

- Implement provider-neutral agent orchestration with native-`fetch` adapters.
- Keep Gemini as the production provider path and use OpenRouter for staging validation via `AI_PROVIDER`.
- Use OpenRouter's OpenAI-compatible Chat Completions API with `Authorization: Bearer`, `OPENROUTER_API_KEY`, and `OPENROUTER_MODEL`; do not add a Node-only SDK to the Worker bundle.
- Verify the selected provider/model combination in staging before enabling any production agent traffic.
- Add an `AbortController` timeout, one bounded retry for transient upstream failures, response-size limits, and typed parsing of completed output.
- Keep the agent loop bounded: at most three tool rounds and one final response per webhook update. Never retry tool mutations automatically.
- Keep all tool declarations and dispatch in an in-process registry. Validate every argument with Zod, authorize against the linked Telegram user, and reject unknown tools.
- Use D1 for compact conversation metadata and idempotency records. Do not depend on module-global state or an unbounded transcript.
- Log event type, latency, model, outcome, and tool name only; never log API keys, prompts, raw user text, or model responses by default.

#### Prompt and data boundaries

- Keep the system prompt in server-only source/config; never accept system instructions from Telegram, D1 content, or model output.
- Label Telegram messages, ticket descriptions, and knowledge articles as untrusted data. Delimit them in the model input and instruct the model to ignore instructions contained inside those fields.
- Never place `GEMINI_API_KEY`, JWTs, join codes, internal prompts, or unrestricted database records in the model context.
- Treat Gemini output as a proposal, not authority. Enforce tool allowlists, Zod schemas, linked-user authorization, field limits, and mutation confirmation in Worker code.
- Add adversarial tests for instruction override, data exfiltration, hidden tool calls, malicious knowledge articles, and attempts to bypass confirmation.

#### Delivery phases

1. Define the agent contract, safety policy, fallback messages, and read-only tool schemas.
2. Add D1 migrations for conversation metadata and Telegram update idempotency.
3. Implement and unit-test the Gemini REST client, structured output parsing, timeout, retry, and error mapping.
4. Implement read-only tools over existing ticket and knowledge services.
5. Integrate the bounded agent path into `telegram-service.ts` without changing `/start`, join-code linking, callback handling, or the manual intake state machine.
6. Add staging-only configuration and run mocked API tests plus an end-to-end Telegram webhook smoke test.
7. Keep production `AI_MODE=off` until staging proves fallback, authorization, duplicate-update handling, timeout behavior, and upstream-error behavior.

#### Acceptance criteria

- A linked Telegram user can ask a knowledge or status question and receive a bounded Gemini-assisted response when `AI_MODE=agent`.
- Gemini is unreachable, times out, returns invalid output, or requests an unauthorized tool: the user receives a deterministic fallback and the webhook still completes safely.
- Duplicate Telegram updates do not duplicate replies, tool effects, or tickets.
- `GEMINI_API_KEY` is read only from the Worker secret binding; no client bundle, Wrangler variable, log, or committed file contains the secret.
- `AI_MODE=off` produces the current behavior byte-for-byte at the integration boundary.

### 8. Production configuration and data cutover

- Add D1, secrets, Cron Trigger, and observability configuration to the new Wrangler file.
- Add development and production environment configuration without committing secrets.
- Import required data from `packages/server/prisma/dev.db` after validating the schema and seed data.
- Document deployment and rollback commands inside the new workspace.

### 9. Verification and cutover

- Run SvelteKit type checking and production build.
- Run the Worker locally with Wrangler and a local D1 database.
- Exercise `/api/health`, authentication, ticket creation, status transitions, ticket messages, reports, and the Telegram webhook path.
- Deploy the new Worker with Wrangler.
- Verify the deployed root URL returns HTTP 200 and `/api/health` returns the expected JSON response.
- Only after the new deployment is verified, decide whether the old root frontend Worker should be removed.

## Key design decisions

- One SvelteKit Worker serves both UI and API; no frontend-to-backend CORS is required.
- D1 is the production database; `dev.db` remains local-only.
- Server-only code lives under `src/lib/server/` or `+server.ts` files.
- Cloudflare bindings are accessed through SvelteKit's `platform.env` and generated types.
- The current `packages/` application remains untouched during the initial migration so the old deployment can be used as a fallback.

## References

- SvelteKit Cloudflare adapter: https://svelte.dev/docs/kit/adapter-cloudflare
- Cloudflare D1: https://developers.cloudflare.com/d1/
- D1 Worker Binding API: https://developers.cloudflare.com/d1/worker-api/
- Cloudflare Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Gemini API overview: https://ai.google.dev/gemini-api/docs/api-overview
- Gemini Interactions and function calling: https://ai.google.dev/gemini-api/docs/migrate-to-interactions
