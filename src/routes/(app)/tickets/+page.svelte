<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { api, ApiError, type Category, type Ticket, type User } from "$lib/api";
  import PriorityChip from "$lib/components/PriorityChip.svelte";
  import StatusChip from "$lib/components/StatusChip.svelte";
  import SlaIndicator from "$lib/components/SlaIndicator.svelte";

  const statusLabels: Record<string, string> = {
    OPEN: "Baru", ASSIGNED: "Ditugaskan", IN_PROGRESS: "Dikerjakan", RESOLVED: "Terselesaikan", CLOSED: "Ditutup"
  };
  const priorityLabels: Record<string, string> = { LOW: "Rendah", MEDIUM: "Sedang", HIGH: "Tinggi", URGENT: "Urgent" };
  const statusOrder = ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"];
  const priorityOrder = ["LOW", "MEDIUM", "HIGH", "URGENT"];

  type AgentOption = { id: string; name: string };
  type KpiAgents = { perAgent: AgentOption[] };

  let tickets: Ticket[] = [];
  let categories: Category[] = [];
  let agents: AgentOption[] = [];
  let users: User[] = [];
  let filters = { status: "", categoryId: "", agentId: "", search: "" };
  let createOpen = false;
  let title = "";
  let description = "";
  let categoryId = "";
  let priority = "MEDIUM";
  let userId = "";
  let errorMessage = "";
  let formError = "";

  async function loadMeta() {
    const [categoryData, userData, kpi] = await Promise.all([
      api<Category[]>("/categories"),
      api<User[]>("/users"),
      api<KpiAgents>("/kpi/overview")
    ]);
    categories = categoryData;
    users = userData;
    agents = kpi.perAgent;
    categoryId ||= categories[0]?.id ?? "";
    userId ||= users[0]?.id ?? "";
  }

  async function loadTickets() {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.agentId) params.set("agentId", filters.agentId);
    if (filters.search.trim()) params.set("search", filters.search.trim());
    tickets = await api<Ticket[]>(`/tickets${params.toString() ? `?${params}` : ""}`);
  }

  onMount(() => {
    Promise.all([loadMeta(), loadTickets()]).catch((cause) => {
      errorMessage = cause instanceof Error ? cause.message : "Gagal memuat tiket";
    });
  });

  function refreshTickets() {
    loadTickets().catch((cause) => { errorMessage = cause instanceof Error ? cause.message : "Gagal memuat tiket"; });
  }

  async function create() {
    formError = "";
    if (!categoryId) { formError = "Pilih kategori terlebih dahulu"; return; }
    try {
      await api<Ticket>("/tickets", { method: "POST", body: JSON.stringify({ title, description, categoryId, priority, userId: userId || undefined }) });
      title = ""; description = ""; categoryId = categories[0]?.id ?? ""; priority = "MEDIUM"; userId = users[0]?.id ?? ""; createOpen = false; await loadTickets();
    } catch (cause) {
      formError = cause instanceof ApiError ? cause.message : "Gagal membuat tiket";
    }
  }
</script>

<svelte:head><title>Tickets — Ticket.Ops</title></svelte:head>

<section>
  <div class="section-header">
    <div><p class="section-code">02 / Workspace tiket</p><h1>Ticket queue</h1><p class="section-desc">Kelola antrian layanan dengan konteks requester, prioritas, status, dan waktu SLA dalam satu tampilan.</p></div>
    <button class="primary" on:click={() => createOpen = true}>+ Buat Ticket</button>
  </div>

  {#if errorMessage}<p class="error">{errorMessage}</p>{/if}
  <div class="filters reveal" style="animation-delay:160ms">
    <input bind:value={filters.search} on:input={refreshTickets} placeholder="Cari kode / judul…" aria-label="Cari tiket" />
    <select bind:value={filters.status} on:change={refreshTickets} aria-label="Filter status"><option value="">Semua status</option>{#each statusOrder as status}<option value={status}>{statusLabels[status]}</option>{/each}</select>
    <select bind:value={filters.categoryId} on:change={refreshTickets} aria-label="Filter kategori"><option value="">Semua kategori</option>{#each categories as category}<option value={category.id}>{category.name}</option>{/each}</select>
    <select bind:value={filters.agentId} on:change={refreshTickets} aria-label="Filter agen"><option value="">Semua agen</option>{#each agents as agent}<option value={agent.id}>{agent.name}</option>{/each}</select>
  </div>

  <div class="table-wrap reveal" style="animation-delay:200ms">
    {#if tickets.length === 0}<p class="empty">Tidak ada tiket. Ubah filter atau buat tiket baru.</p>{:else}
      <div class="table-scroll"><table><thead><tr><th>Kode</th><th>Judul</th><th>Prioritas</th><th>Status</th><th>SLA resolusi</th><th>Requester</th><th>Agen</th><th>Dibuat</th></tr></thead><tbody>
        {#each tickets as ticket}<tr on:click={() => goto(`/tickets/${ticket.id}`)}><td class="code">{ticket.code}</td><td class="title"><strong>{ticket.title}</strong><small>{ticket.category.name}</small></td><td><PriorityChip priority={ticket.priority}/></td><td><StatusChip status={ticket.status}/></td><td><SlaIndicator dueAt={ticket.slaResolutionDueAt} breached={ticket.slaResolutionBreached ?? false} resolved={!!ticket.resolvedAt}/></td><td>{ticket.user.name}</td><td>{ticket.agent?.name ?? "Belum ditugaskan"}</td><td>{new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(ticket.createdAt))}</td></tr>{/each}
      </tbody></table></div>
    {/if}
  </div>
</section>

{#if createOpen}
  <div class="modal-backdrop" role="presentation" on:click={(event) => { if (event.target === event.currentTarget) createOpen = false; }}>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="create-title" tabindex="-1">
      <div class="modal-head"><div><p class="section-code">NEW REQUEST</p><h2 id="create-title">Buat Ticket</h2></div><button class="close" on:click={() => createOpen = false} aria-label="Tutup">×</button></div>
      <form on:submit|preventDefault={create}>
        <label>Judul<input bind:value={title} placeholder="Ringkasan masalah" required minlength="3" /></label>
        <label>Deskripsi<textarea bind:value={description} placeholder="Jelaskan detail masalah…" rows="4" required></textarea></label>
        <div class="modal-grid"><label>Kategori<select bind:value={categoryId} required><option value="" disabled>Pilih kategori</option>{#each categories as category}<option value={category.id}>{category.name}</option>{/each}</select></label><label>Prioritas<select bind:value={priority}>{#each priorityOrder as item}<option value={item}>{priorityLabels[item]}</option>{/each}</select></label><label>Requester<select bind:value={userId}><option value="">Otomatis</option>{#each users as user}<option value={user.id}>{user.name}{user.department ? ` — ${user.department}` : ""}</option>{/each}</select></label></div>
        {#if formError}<p class="error">{formError}</p>{/if}<div class="modal-actions"><button type="button" class="ghost" on:click={() => createOpen = false}>Batal</button><button type="submit" class="primary">Simpan</button></div>
      </form>
    </div>
  </div>
{/if}

<style>
  .section-header{display:flex;justify-content:space-between;align-items:flex-end;gap:2rem}.section-header h1{margin:.35rem 0 .55rem;font-size:clamp(1.8rem,4vw,2.7rem)}.section-desc{margin:0;max-width:660px;color:var(--dim);font-size:.82rem;line-height:1.55}.primary,.ghost,.close{padding:.7rem 1rem;font-size:.72rem}.close{padding:.1rem .4rem;background:transparent!important;color:var(--dim)!important;font-size:1.4rem}.filters{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:.75rem;margin-top:2rem}.filters input,.filters select{width:100%;padding:.78rem;font-size:.76rem}.table-wrap{margin-top:1.25rem;overflow:hidden;border:1px solid var(--line);border-radius:14px;background:#fff;box-shadow:0 4px 18px rgb(16 42 82 / 4%)}.table-scroll{overflow-x:auto}.empty{padding:2rem 1.25rem;color:var(--dim);font-size:.8rem}table{width:100%;min-width:900px;border-collapse:collapse;font-size:.76rem}th{padding:.8rem 1rem;border-bottom:1px solid var(--line);color:var(--dim);font-size:.66rem;text-align:left}td{padding:.9rem 1rem;border-bottom:1px solid #eef2f7;color:var(--dim)}tr{cursor:pointer;transition:background .16s ease}tr:hover{background:#f8fbff}tr:last-child td{border:0}td.code{color:var(--acid);font-size:.7rem;font-weight:700}td.title{max-width:270px}td.title strong,td.title small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}td.title strong{color:var(--bone);font-size:.78rem}td.title small{margin-top:.25rem;color:var(--dim);font-size:.67rem}.modal-backdrop{position:fixed;inset:0;z-index:10;display:grid;place-items:center;padding:1rem;background:rgb(16 42 82 / 34%);backdrop-filter:blur(4px)}.modal{width:min(680px,100%);padding:1.5rem;border:1px solid var(--line);border-radius:16px;background:#fff;box-shadow:0 24px 80px rgb(16 42 82 / 20%)}.modal-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.5rem}.modal h2{margin:.35rem 0 0;font-size:1.5rem}.modal form{display:grid;gap:1rem}.modal label{display:grid;gap:.45rem;color:var(--dim);font-size:.7rem;font-weight:700}.modal input,.modal textarea,.modal select{padding:.75rem;font-size:.8rem}.modal textarea{resize:vertical}.modal-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.75rem}.modal-actions{display:flex;justify-content:flex-end;gap:.6rem;border-top:1px solid var(--line);padding-top:1rem}.error{font-size:.76rem}@media(max-width:800px){.filters{grid-template-columns:1fr 1fr}.section-header{align-items:flex-start;flex-direction:column}}@media(max-width:560px){.filters,.modal-grid{grid-template-columns:1fr}.modal{padding:1rem}}
</style>
