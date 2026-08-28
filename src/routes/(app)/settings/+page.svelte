<script lang="ts">
  import { onMount } from "svelte";
  import { api, ApiError, type AiHealthResult, type AiSettings } from "$lib/api";

  let settings: AiSettings | null = null;
  let mode: AiSettings["mode"] = "off";
  let provider: AiSettings["provider"] = "gemini";
  let geminiModel = "gemini-2.5-flash";
  let openrouterModel = "deepseek/deepseek-v4-flash-0731";
  let loading = true;
  let saving = false;
  let checking = false;
  let errorMessage = "";
  let notice = "";
  let health: AiHealthResult | null = null;

  $: currentModel = provider === "gemini" ? geminiModel : openrouterModel;
  $: keyConfigured = provider === "gemini" ? settings?.geminiKeyConfigured : settings?.openrouterKeyConfigured;

  onMount(() => {
    load().catch((cause) => { errorMessage = cause instanceof Error ? cause.message : "Gagal memuat pengaturan AI"; }).finally(() => { loading = false; });
  });

  async function load() {
    settings = await api<AiSettings>("/settings/ai");
    mode = settings.mode;
    provider = settings.provider;
    geminiModel = settings.geminiModel;
    openrouterModel = settings.openrouterModel;
  }

  async function save() {
    errorMessage = ""; notice = ""; saving = true;
    try {
      settings = await api<AiSettings>("/settings/ai", { method: "PATCH", body: JSON.stringify({ mode, provider, geminiModel, openrouterModel }) });
      notice = "Pengaturan tersimpan. Perubahan berlaku untuk request berikutnya.";
    } catch (cause) {
      errorMessage = cause instanceof ApiError ? cause.message : "Gagal menyimpan pengaturan";
    } finally { saving = false; }
  }

  async function healthCheck() {
    errorMessage = ""; notice = ""; health = null; checking = true;
    try {
      health = await api<AiHealthResult>("/settings/ai/health", { method: "POST", body: JSON.stringify({ provider, model: currentModel }) });
    } catch (cause) {
      errorMessage = cause instanceof ApiError ? cause.message : "Health check gagal";
    } finally { checking = false; }
  }

  function formatTime(value: string | null) { return value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "belum pernah"; }
  function updateModel(event: Event) { const value = (event.currentTarget as HTMLInputElement).value; if (provider === "gemini") geminiModel = value; else openrouterModel = value; }
</script>

<svelte:head><title>AI Settings — Ticket.Ops</title></svelte:head>

{#if loading}
  <p class="loading-state">Memuat pengaturan AI…</p>
{:else}
  <section>
    <div class="section-header">
      <div><p class="section-code">06 / Admin &amp; AI control</p><h1>AI, under control.</h1><p class="section-desc">Pilih provider dan model dari web. API key tetap tersimpan sebagai secret Cloudflare dan tidak pernah dikirim ke browser.</p></div>
    </div>

    {#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}
    {#if notice}<p class="notice" role="status">{notice}</p>{/if}

    <div class="settings-grid">
      <form class="panel reveal" on:submit|preventDefault={save}>
        <div class="panel-heading"><div><span class="ai-chip">Runtime configuration</span><h2>Provider &amp; model</h2></div><span class="saved">Updated {formatTime(settings?.updatedAt ?? null)}</span></div>
        <label>AI mode<select bind:value={mode}><option value="off">Off — no AI calls</option><option value="rules">Rules — deterministic flow</option><option value="agent">Agent — provider model</option></select></label>
        <label>Provider<select bind:value={provider}><option value="gemini">Gemini</option><option value="openrouter">OpenRouter</option></select></label>
        <label>Model {#if provider === "gemini"}<span class="hint">Gemini model ID</span>{:else}<span class="hint">OpenRouter model ID</span>{/if}<input value={currentModel} on:input={updateModel} required maxlength="200" spellcheck="false" placeholder={provider === "gemini" ? "gemini-2.5-flash" : "openai/gpt-4o-mini"} /></label>
        <div class="key-status"><span class:ok={keyConfigured}>{keyConfigured ? "API key configured" : "API key missing"}</span><small>Kelola nilainya di Cloudflare Secrets.</small></div>
        <div class="actions"><button class="secondary" type="button" on:click={healthCheck} disabled={checking || !currentModel}>{checking ? "Testing…" : "Test model"}</button><button class="primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save settings"}</button></div>
      </form>

      <aside class="panel health-panel reveal" style="animation-delay:120ms">
        <div class="panel-heading"><div><span class="ai-chip">Model health</span><h2>Is it responding?</h2></div><span class="pulse" aria-hidden="true"></span></div>
        <p class="health-copy">Satu request kecil dikirim dari Worker ke model aktif. Gunakan latency sebagai sinyal cepat, bukan benchmark absolut.</p>
        {#if health}
          <div class:failed={!health.ok} class="health-result"><strong>{health.ok ? "Healthy" : "Unavailable"}</strong><span>{health.latencyMs} ms</span><small>{health.message}</small><small>{health.provider} · {health.model}</small></div>
        {:else}<div class="empty-health">Belum ada hasil. Jalankan test model untuk mengukur response time.</div>{/if}
      </aside>
    </div>
  </section>
{/if}

<style>
  .section-header{display:flex;justify-content:space-between;align-items:flex-end;gap:2rem}.section-header h1{margin:.35rem 0 .55rem;font-size:clamp(1.8rem,4vw,2.7rem)}.section-desc{max-width:680px;margin:0;color:var(--dim);font-size:.82rem;line-height:1.55}.settings-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:1rem;margin-top:1.5rem}.panel{padding:1.25rem;border:1px solid var(--line);border-radius:14px;background:#fff;box-shadow:0 4px 18px rgb(16 42 82 / 4%)}.panel-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;margin-bottom:1.35rem}.panel h2{margin:.45rem 0 0;color:var(--bone);font-size:1.2rem}.saved,.hint{color:var(--dim);font-size:.65rem;font-weight:500}.panel label{display:grid;gap:.45rem;margin-top:1rem;color:var(--dim);font-size:.7rem;font-weight:700}.panel input,.panel select{width:100%;padding:.75rem;border:1px solid #d8e0ed;border-radius:8px;background:#fff;color:var(--bone);font:inherit;font-size:.8rem}.panel input:focus,.panel select:focus{border-color:var(--acid);outline:3px solid rgb(37 99 235 / 12%)}.key-status{display:flex;align-items:center;gap:.65rem;margin-top:1.2rem;padding:.7rem .8rem;border:1px solid #f4ddb5;border-radius:9px;background:#fffaf0}.key-status span{color:#a66000;font-size:.7rem;font-weight:700}.key-status span.ok{color:var(--success)}.key-status small{color:var(--dim);font-size:.65rem}.actions{display:flex;justify-content:flex-end;gap:.6rem;margin-top:1.4rem;padding-top:1rem;border-top:1px solid var(--line)}button{padding:.7rem 1rem;font-size:.72rem}.secondary{border:1px solid #c5d7f2;background:#f7faff;color:var(--acid)}button:disabled{cursor:not-allowed;opacity:.55}.notice{margin-top:1rem;padding:.8rem 1rem;border:1px solid #bce5cf;border-radius:10px;background:#f5fff8;color:#207544;font-size:.74rem}.error{margin-top:1rem;font-size:.76rem}.health-panel{display:flex;min-height:280px;flex-direction:column}.health-copy{margin:0;color:var(--dim);font-size:.75rem;line-height:1.55}.pulse{width:.65rem;height:.65rem;border-radius:50%;background:#a8b5c8;box-shadow:0 0 0 5px #eef2f7}.health-result{display:grid;gap:.35rem;margin-top:1.3rem;padding:1rem;border:1px solid #bce5cf;border-radius:10px;background:#f5fff8}.health-result.failed{border-color:#f3c6c6;background:#fff7f7}.health-result strong{color:var(--success);font-size:1rem}.health-result.failed strong{color:#b33a3a}.health-result span{color:var(--bone);font-family:"Manrope",sans-serif;font-size:1.7rem;font-weight:800;letter-spacing:-.04em}.health-result small{color:var(--dim);font-size:.67rem;line-height:1.4}.empty-health{margin-top:1.3rem;padding:1rem;border:1px dashed #cdd8e8;border-radius:10px;color:var(--dim);font-size:.72rem;line-height:1.5}.loading-state{color:var(--dim);font-size:.8rem}@media(max-width:840px){.settings-grid{grid-template-columns:1fr}}@media(max-width:560px){.panel-heading{flex-direction:column}.actions{justify-content:stretch;flex-direction:column}.actions button{width:100%}}
</style>
