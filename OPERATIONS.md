# Ticket.Ops Operations Runbook

This runbook covers the SvelteKit Worker, its D1 databases, Telegram webhook, and optional AI provider.

## Environments

| Environment | Worker | Database | URL |
| --- | --- | --- | --- |
| Production | `helpdesk-ticketing-sveltekit` | `helpdesk-ticketing-sveltekit` | `https://helpdesk-ticketing-sveltekit.kelvintriyansyah.workers.dev` |
| Staging | `helpdesk-ticketing-staging` | `helpdesk-ticketing-staging` | `https://helpdesk-ticketing-staging.kelvintriyansyah.workers.dev` |

Production and staging use `AI_MODE=agent` with OpenRouter. Production uses `inclusionai/ling-3.0-flash-fin:free`; staging uses its configured DeepSeek model.

## Routine release

1. Run validation locally:

   ```powershell
   npm ci
   npm run check
   npm test
   npm run build
   ```

2. Push to `main`. GitHub Actions runs CI and deploys staging automatically.
3. Apply staging migrations and verify `/api/health`, login, and a complete ticket workflow.
4. When staging is accepted, manually run **Deploy Cloudflare Worker → production** in GitHub Actions with `target=production`. The production workflow applies D1 migrations before deploying.
5. Verify the production health endpoint and one authenticated ticket workflow after deployment.

The deploy scripts use `--keep-vars`; do not put secrets in `wrangler.jsonc`, `.dev.vars`, or committed files.

## Health checks

```powershell
Invoke-RestMethod https://helpdesk-ticketing-sveltekit.kelvintriyansyah.workers.dev/api/health
Invoke-RestMethod https://helpdesk-ticketing-staging.kelvintriyansyah.workers.dev/api/health
```

Expected response includes `ok: true` and `runtime: "cloudflare-workers"`.

For an authenticated smoke test, use an agent account and verify:

1. `POST /api/auth/login` and `GET /api/auth/me`.
2. Create a clearly labelled test ticket.
3. Confirm assignment, `IN_PROGRESS`, an agent message, `RESOLVED`, and `CLOSED`.
4. Open the ticket detail and confirm the event history and first-response timestamp.

Leave the test ticket closed. There is currently no delete endpoint.

## D1 migrations and seed data

Apply migrations remotely before deploying code that depends on them:

```powershell
npm run db:apply:staging
npm run db:apply
```

Seed only an intentionally empty or reset environment:

```powershell
npm run db:seed:staging
npm run db:seed
```

Do not run seed against production as a routine release step. D1 migrations are forward-only; create a new corrective migration instead of editing an applied migration.

## Secret rotation

Required secret bindings are `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and `OPENROUTER_API_KEY`. `GEMINI_API_KEY` remains available for fallback or future provider changes.

Update one secret interactively so its value is not placed in shell history:

```powershell
npx wrangler secret put JWT_SECRET
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put OPENROUTER_API_KEY --env staging
```

After rotating `JWT_SECRET`, all existing sessions become invalid and agents must log in again. After rotating a Telegram token or webhook secret, register the webhook again. Never print, commit, or paste secret values into issue trackers or logs.

## AI safety switch

- Production is currently `AI_MODE=agent`, enabled only after staging acceptance and the production ticket workflow passed.
- To disable AI urgently, set the production `AI_MODE` variable to `off` in `wrangler.jsonc` and deploy, or use the equivalent Worker environment variable control in the Cloudflare dashboard.
- To enable production AI, change only after approval, deploy, and immediately test a knowledge question, a linked-user status question, an unauthorized lookup, a timeout/failure fallback, and duplicate-update handling.
- AI calls must not receive secrets, JWTs, join codes, or unrestricted database records.

## Telegram webhook recovery

The webhook script registers the correct URL and secret for each environment. Production values are read from `.dev.vars` by setting `TELEGRAM_VARS_FILE`; staging values are read from `.dev.vars.staging`:

```powershell
$env:TELEGRAM_VARS_FILE = '.dev.vars'
npm run telegram:set-webhook:production

$env:TELEGRAM_VARS_FILE = '.dev.vars.staging'
npm run telegram:set-webhook:staging
```

The command must print `Telegram webhook registered`. If Telegram delivery is failing, confirm the Worker health endpoint, `TELEGRAM_WEBHOOK_SECRET`, and the bot token, then register the webhook again. Do not enable `drop_pending_updates` during recovery unless losing queued updates is intentional.

## Logs and incident triage

Start a temporary tail while reproducing a request:

```powershell
npx wrangler tail helpdesk-ticketing-sveltekit --format pretty
npx wrangler tail --env staging --format pretty
```

Use structured error fields (`type`, `path`, `method`, and error message) to identify the failing route. Do not log request bodies, prompts, model responses, tokens, or passwords.

## Rollback

1. Stop or disable the rollout if the health check or authenticated workflow fails.
2. List recent versions and identify the last known-good version:

   ```powershell
   npx wrangler deployments list
   npx wrangler deployments list --env staging
   ```

3. Roll back to the selected version ID:

   ```powershell
npx wrangler rollback <version-id> --name helpdesk-ticketing-sveltekit --yes --message "Rollback: <reason>"
npx wrangler rollback <version-id> --env staging --yes --message "Rollback: <reason>"
   ```

4. Re-run `/api/health` and the authenticated ticket workflow.

Code rollback does not undo an already-applied D1 migration. If a schema change caused the incident, deploy a compatible forward fix and restore data only through a reviewed D1 Time Travel operation.

## GitHub Actions requirements

The deploy workflow requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in the appropriate GitHub environment. Keep production deployment approval enabled and do not copy production secrets into the staging environment.
## AI provider controls

Administrators can open **AI Settings** in the web console to change the AI mode, switch between Gemini and OpenRouter, and edit each provider's model ID. These preferences are stored in D1 and are loaded for the next Telegram request without a Worker deploy.

The API keys are never stored in D1 or returned to the browser. The settings page only shows whether each Cloudflare secret is configured. Use **Test model** to send one small server-side request and view the response latency; a failed check does not expose the upstream response body.
