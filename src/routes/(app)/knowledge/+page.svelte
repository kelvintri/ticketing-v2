<script lang="ts">
  import { onMount } from "svelte";
  import { api, ApiError, type Category } from "$lib/api";

  type Article = { id: string; title: string; body: string; keywords: string; active: boolean; updatedAt: string; category: Category | null; categoryId: string | null };
  let articles: Article[] = [];
  let categories: Category[] = [];
  let search = "";
  let modalOpen = false;
  let editing: Article | null = null;
  let title = ""; let body = ""; let keywords = ""; let categoryId = ""; let active = true; let errorMessage = ""; let formError = "";

  async function load() {
    const [articleData, categoryData] = await Promise.all([api<Article[]>(`/knowledge${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""}`), api<Category[]>("/categories")]);
    articles = articleData; categories = categoryData;
  }
  onMount(() => { load().catch((cause) => { errorMessage = cause instanceof Error ? cause.message : "Gagal memuat artikel"; }); });
  function openNew() { editing = null; title = ""; body = ""; keywords = ""; categoryId = ""; active = true; formError = ""; modalOpen = true; }
  function openEdit(article: Article) { editing = article; title = article.title; body = article.body; keywords = article.keywords; categoryId = article.categoryId ?? ""; active = article.active; formError = ""; modalOpen = true; }
  async function save() {
    formError = "";
    try {
      const payload = { title, body, keywords, categoryId: categoryId || null, active };
      await api(editing ? `/knowledge/${editing.id}` : "/knowledge", { method: editing ? "PUT" : "POST", body: JSON.stringify(payload) });
      modalOpen = false; await load();
    } catch (cause) { formError = cause instanceof ApiError ? cause.message : "Gagal menyimpan artikel"; }
  }
  async function remove(article: Article) {
    if (!window.confirm(`Hapus artikel "${article.title}"?`)) return;
    try { await api(`/knowledge/${article.id}`, { method: "DELETE" }); await load(); }
    catch (cause) { errorMessage = cause instanceof Error ? cause.message : "Gagal menghapus artikel"; }
  }
  function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
  $: activeArticles = articles.filter((article) => article.active).length;
</script>

<svelte:head><title>Knowledge Base — Ticket.Ops</title></svelte:head>
<section>
  <div class="section-header"><div><p class="section-code">03 / Knowledge base</p><h1>Knowledge that helps.</h1><p class="section-desc">Kelola solusi dan prosedur agar agen—termasuk AI assist—memiliki konteks yang tepercaya.</p></div><button class="primary" on:click={openNew}>+ Artikel baru</button></div>
  {#if errorMessage}<p class="error">{errorMessage}</p>{/if}
  <div class="ai-readiness reveal"><div><span class="ai-chip">✦ AI knowledge context</span><strong>{activeArticles} artikel aktif siap dipakai sebagai referensi</strong><p>Hanya artikel aktif yang sebaiknya dipakai untuk menyusun konteks atau draft respons AI.</p></div><a href="#article-list">Tinjau artikel →</a></div>
  <div class="search reveal" style="animation-delay:160ms"><input bind:value={search} on:input={() => load().catch(() => undefined)} placeholder="Cari judul / isi / kata kunci…" aria-label="Cari artikel" /></div>
  <div class="articles reveal" id="article-list" style="animation-delay:200ms">{#if articles.length === 0}<p class="empty">Tidak ada artikel. Coba kata kunci lain atau buat artikel baru.</p>{:else}{#each articles as article}<article class="article"><div class="article-head"><h3>{article.title}</h3><span class:inactive={!article.active}>{article.active ? "Siap untuk AI" : "Tidak dipakai AI"}</span></div><p>{article.body}</p><div class="keywords">{#each article.keywords.split(",") as keyword}<span>{keyword.trim()}</span>{/each}</div><div class="article-foot"><span>{article.category?.name ?? "Tanpa kategori"} · Diperbarui {formatDate(article.updatedAt)}</span><span class="article-actions"><button on:click={() => openEdit(article)}>Edit</button><button class="danger" on:click={() => remove(article)}>Hapus</button></span></div></article>{/each}{/if}</div>
</section>
{#if modalOpen}<div class="modal-backdrop" role="presentation" on:click={(event) => { if (event.target === event.currentTarget) modalOpen = false; }}><div class="modal" role="dialog" aria-modal="true" aria-labelledby="article-title" tabindex="-1"><div class="modal-head"><div><p class="section-code">KNOWLEDGE ENTRY</p><h2 id="article-title">{editing ? "Edit Artikel" : "Artikel Baru"}</h2></div><button class="close" on:click={() => modalOpen = false} aria-label="Tutup">×</button></div><form on:submit|preventDefault={save}><label>Judul<input bind:value={title} required minlength="3" /></label><label>Isi<textarea bind:value={body} rows="6" required></textarea></label><label>Kata kunci (pisahkan dengan koma)<input bind:value={keywords} required placeholder="wifi, internet, koneksi" /></label><div class="modal-grid"><label>Kategori<select bind:value={categoryId}><option value="">Tanpa kategori</option>{#each categories as category}<option value={category.id}>{category.name}</option>{/each}</select></label><label>Status<span class="status-toggle"><input type="checkbox" bind:checked={active} /><span>Aktif</span></span></label></div>{#if formError}<p class="error">{formError}</p>{/if}<div class="modal-actions"><button type="button" class="ghost" on:click={() => modalOpen = false}>Batal</button><button type="submit" class="primary">Simpan</button></div></form></div></div>{/if}
<style>
  .section-header{display:flex;justify-content:space-between;align-items:flex-end;gap:2rem}.section-header h1{margin:.35rem 0 .55rem;font-size:clamp(1.8rem,4vw,2.7rem)}.section-desc{max-width:620px;margin:0;color:var(--dim);font-size:.82rem;line-height:1.55}.primary,.ghost,.close{padding:.7rem 1rem;font-size:.72rem}.close{padding:.1rem .4rem;background:transparent!important;color:var(--dim)!important;font-size:1.4rem}.ai-readiness{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:1.5rem;padding:1rem 1.15rem;border:1px solid #b9e4ee;border-radius:14px;background:#fbfeff}.ai-readiness strong{display:block;margin-top:.45rem;color:#28536c;font-size:.82rem}.ai-readiness p{margin:.25rem 0 0;color:#668093;font-size:.72rem}.ai-readiness a{color:var(--cyan);font-size:.74rem;font-weight:700;text-decoration:none;white-space:nowrap}.search{max-width:30rem;margin-top:1.5rem}.search input{width:100%;padding:.78rem;font-size:.76rem}.articles{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1.25rem}.article,.articles>.empty{padding:1.2rem;border:1px solid var(--line);border-radius:14px;background:#fff;box-shadow:0 4px 18px rgb(16 42 82 / 4%)}.article-head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.article h3{margin:0;color:var(--bone);font-family:"Manrope",sans-serif;font-size:1.05rem;line-height:1.3}.article-head span{flex:none;padding:.28rem .5rem;border-radius:999px;background:#e8f7ef;color:var(--success);font-size:.62rem;font-weight:700}.article-head span.inactive{background:#eef1f6;color:#64748b}.article p{display:-webkit-box;overflow:hidden;margin:1rem 0;color:var(--dim);font-size:.76rem;line-height:1.65;-webkit-box-orient:vertical;-webkit-line-clamp:3;line-clamp:3}.keywords{display:flex;flex-wrap:wrap;gap:.4rem}.keywords span{padding:.25rem .45rem;border-radius:6px;background:#f0f4fa;color:#58708b;font-size:.62rem}.article-foot{display:flex;justify-content:space-between;gap:.7rem;margin-top:1rem;padding-top:.8rem;border-top:1px solid var(--line);color:var(--dim);font-size:.62rem}.article-actions{display:flex;gap:.75rem}.article-actions button{padding:0;border:0;background:transparent!important;color:var(--acid)!important;font-size:.67rem;font-weight:700}.article-actions button.danger{color:var(--alert)!important}.empty{color:var(--dim);font-size:.76rem}.modal-backdrop{position:fixed;inset:0;z-index:10;display:grid;place-items:center;padding:1rem;background:rgb(16 42 82 / 34%);backdrop-filter:blur(4px)}.modal{width:min(680px,100%);padding:1.5rem;border:1px solid var(--line);border-radius:16px;background:#fff;box-shadow:0 24px 80px rgb(16 42 82 / 20%)}.modal-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.5rem}.modal h2{margin:.35rem 0 0;font-size:1.5rem}.modal form{display:grid;gap:1rem}.modal label{display:grid;gap:.45rem;color:var(--dim);font-size:.7rem;font-weight:700}.modal input,.modal textarea,.modal select{padding:.75rem;font-size:.8rem}.modal-grid{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}.modal-actions{display:flex;justify-content:flex-end;gap:.6rem;border-top:1px solid var(--line);padding-top:1rem}.error{font-size:.76rem}@media(max-width:760px){.articles{grid-template-columns:1fr}.section-header{align-items:flex-start;flex-direction:column}.ai-readiness{align-items:flex-start;flex-direction:column}}@media(max-width:560px){.modal-grid{grid-template-columns:1fr}.modal{padding:1rem}}
</style>
