# SvelteKit + Cloudflare Workers Tasks

Status legend: `[ ]` pending, `[x]` complete, `[!]` blocked or requiring a design decision.

## Foundation

- [x] Scaffold a standalone SvelteKit TypeScript app
- [x] Install and configure `@sveltejs/adapter-cloudflare`
- [x] Add Worker Wrangler configuration
- [x] Add generated Cloudflare binding types
- [x] Configure local platform proxy and production build scripts
- [x] Add SvelteKit and Cloudflare generated directories to `.gitignore`

## Runtime and configuration

- [x] Define typed `App.Platform.env` bindings
- [x] Implement server-only environment access
- [x] Move secrets to Wrangler secret bindings
- [x] Remove Node startup and filesystem assumptions
- [x] Add Worker error and request logging behavior

## Database

- [x] Create the production D1 database
- [x] Port the Prisma schema migrations into D1 migrations
- [x] Select direct D1 prepared statements
- [x] Implement request-scoped database access
- [x] Rewrite the interactive ticket-message transaction
- [x] Implement Worker-safe seed and import commands
- [x] Validate migrated schema and production seed data

## Authentication and API

- [x] Create shared API response and error helpers
- [x] Port authentication endpoints
- [x] Port ticket endpoints
- [x] Port KPI endpoints
- [x] Port knowledge-base endpoints
- [x] Port user and category endpoints
- [x] Port report endpoints
- [x] Port notification endpoints
- [x] Port authentication middleware into SvelteKit hooks
- [x] Preserve existing route paths and JSON contracts

## Frontend

- [x] Port the login page and session handling
- [x] Port the protected application layout
- [x] Port the dashboard page
- [x] Port tickets list and ticket creation flows
- [x] Port ticket detail, messages, status, assignment, and rating flows
- [x] Port knowledge-base management
- [x] Port reports and CSV export
- [x] Port user and category management
- [x] Preserve role-based access behavior
- [x] Preserve shared schemas and enums during migration

## Integrations

- [x] Replace `node-cron` with the Worker scheduled handler
- [x] Configure the five-minute SLA Cron Trigger
- [x] Replace Telegram polling with webhook
- [!] Replace stdio MCP with in-process tools or a separate HTTP Worker
- [!] Replace the process-global event emitter
- [!] Route notifications through `waitUntil()` or a Cloudflare Queue
- [x] Implement Gemini integration using the Worker secret and Web APIs

## Gemini AI integration

### Contract and safety

- [x] Freeze the first-release scope to Telegram read-only assistance
- [x] Define typed agent decisions, fallback messages, and safety policy
- [x] Define read-only tools and authorization context
- [x] Define timeout, retry, round, response-size, and token-budget limits

### Prompt and data boundaries

- [x] Write an immutable server-side system prompt and agent policy
- [x] Mark Telegram, ticket, and knowledge content as untrusted model data
- [x] Exclude secrets, tokens, join codes, and unrestricted records from prompts
- [x] Enforce tool allowlists and authorization outside the model
- [x] Require explicit confirmation for every future mutation tool
- [x] Add prompt-injection and data-exfiltration regression cases

### Persistence and idempotency

- [x] Add D1 agent conversation metadata migration
- [x] Add D1 Telegram update idempotency migration
- [x] Extend Telegram update and session types without breaking manual intake

### Provider runtime

- [x] Implement native-fetch Gemini provider adapter
- [x] Implement native-fetch OpenRouter provider adapter
- [x] Select provider and model per Worker environment
- [x] Configure staging `OPENROUTER_API_KEY` secret
- [x] Verify `deepseek/deepseek-v4-flash-0731` availability
- [x] Parse completed output, function calls, and DeepSeek DSML safely
- [x] Add bounded timeout and transient-error retry handling
- [x] Reject invalid JSON, unknown tools, and unauthorized tool arguments
- [x] Emit structured redacted agent telemetry

### Tool registry and integration

- [x] Implement read-only knowledge search tool
- [x] Implement linked-user ticket status tool
- [x] Implement triage and human-handoff responses
- [x] Integrate agent mode into Telegram message handling
- [x] Preserve deterministic manual flow when AI mode is off
- [x] Preserve explicit confirmation before ticket mutations
- [x] Add duplicate-update protection before agent execution

### Verification and rollout

- [x] Add Gemini client contract tests with mocked upstream responses
- [x] Add tool authorization and malformed-call tests
- [x] Add timeout, retry, fallback, and duplicate-update tests
- [x] Configure a staging-only Gemini secret without committing it
- [x] Run staging Telegram webhook smoke tests with AI mode enabled
- [x] Verify production remains `AI_MODE=off` after deployment
- [ ] Enable production agent mode only after staging acceptance
- [ ] Document Gemini secret rotation, disable switch, and failure playbook

Staging AI smoke test is ready through the isolated staging bot and webhook.

## Deployment and verification

- [x] Add D1, secrets, assets, Cron, and observability configuration
- [x] Build the SvelteKit Worker locally
- [x] Run the Worker with Wrangler and local D1
- [x] Verify `/api/health` locally
- [x] Verify login and protected API requests locally
- [x] Verify ticket lifecycle behavior locally
- [x] Verify the scheduled SLA handler locally
- [x] Deploy the SvelteKit Worker
- [x] Verify the deployed root URL returns HTTP 200 after redirect
- [x] Verify deployed `/api/health` returns the expected JSON
- [!] Verify deployed authentication and one complete ticket workflow
- [x] Delete the old frontend-only Worker after cutover

## Pixel parity redesign

- [x] Match dashboard structure and charts
- [x] Match tickets filters table and modal
- [x] Match knowledge cards and modal
- [x] Match reports page layout
- [x] Match users page layout
- [x] Verify all deployed pages visually

## Staging verification

- [x] Create staging D1 database
- [x] Add staging Worker environment
- [x] Apply staging migrations and seed
- [x] Verify complete ticket lifecycle
- [x] Record staging workflow verification

Staging Worker: `https://helpdesk-ticketing-staging.kelvintriyansyah.workers.dev`
