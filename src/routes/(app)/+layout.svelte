<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { api, getToken, setToken, type Agent } from "$lib/api";

  const nav = [
    { href: "/dashboard", code: "01", label: "Dashboard" },
    { href: "/tickets", code: "02", label: "Tickets" },
    { href: "/knowledge", code: "03", label: "Knowledge Base" },
    { href: "/reports", code: "04", label: "Laporan" }
  ];

  let ready = false;
  let agent: Agent | null = null;

  onMount(async () => {
    if (!getToken()) {
      await goto("/login");
      return;
    }
    try {
      agent = await api<Agent>("/auth/me");
      if (agent.role === "ADMIN") nav.push({ href: "/users", code: "05", label: "Users & Join Codes" });
      if (agent.role !== "ADMIN" && page.url.pathname.startsWith("/users")) {
        await goto("/dashboard");
        return;
      }
      ready = true;
    } catch {
      setToken(null);
      await goto("/login");
    }
  });

  function logout() {
    setToken(null);
    void goto("/login");
  }
</script>

{#if ready}
  <div class="app-shell">
    <aside class="sidebar reveal">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">T</div><div><p>IT Helpdesk</p>
        <a href="/dashboard">Ticket<span>.</span>Ops</a></div>
      </div>

      <a class="notification" href="/tickets">
        <span><b>Workspace agen</b><small>Kelola antrian dan SLA</small></span>
        <strong>→</strong>
      </a>

      <nav aria-label="Navigasi utama">
        {#each nav as item}
          <a class:active={page.url.pathname === item.href || page.url.pathname.startsWith(`${item.href}/`)} href={item.href}>
            <span>{item.code}</span>{item.label}
          </a>
        {/each}
      </nav>

      <div class="user-block">
        <p>{agent?.name ?? "—"}</p>
        <small>{agent?.role === "ADMIN" ? "Administrator" : "Agen"}</small>
        <button on:click={logout}>Keluar</button>
      </div>
    </aside>

    <div class="content-shell">
      <header class="mobile-header">
        <span>Ticket<span>.</span>Ops</span>
        <button on:click={logout}>Keluar</button>
      </header>
      <main><slot /></main>
    </div>
  </div>
{:else}
  <div class="loading">Memuat konsol…</div>
{/if}

<style>
  .app-shell { display:flex; min-height:100svh; align-items:flex-start; }
  .sidebar { position:sticky; top:0; display:flex; height:100svh; flex:0 0 264px; flex-direction:column; overflow-y:auto; background:var(--navy); color:#dce9fc; }
  .brand { display:flex; align-items:center; gap:.75rem; padding:1.5rem; border-bottom:1px solid rgb(255 255 255 / 12%); }.brand-mark { display:grid; width:2rem; height:2rem; place-items:center; border-radius:8px; background:#fff; color:var(--navy); font-family:"Manrope",sans-serif; font-weight:800; }
  .brand p { margin:0 0 .15rem; color:#a9c1e6; font-size:.61rem; font-weight:600; letter-spacing:.08em; text-transform:uppercase; }.brand a { color:#fff; font-family:"Manrope",sans-serif; font-size:1.16rem; font-weight:800; letter-spacing:-.04em; text-decoration:none; }.brand a span { color:#7dd3fc; }
  .notification { display:flex; justify-content:space-between; align-items:center; gap:.7rem; margin:1.25rem 1rem .7rem; padding:.85rem; border-radius:10px; background:rgb(255 255 255 / 8%); color:#e7f0ff; text-decoration:none; }.notification b { display:block; font-size:.72rem; }.notification small { display:block; margin-top:.2rem; color:#a9c1e6; font-size:.63rem; }.notification strong { color:#7dd3fc; font-size:1.1rem; }
  nav { flex:1; padding:.65rem .75rem; } nav a { display:block; padding:.75rem; border-radius:8px; color:#abc1e3; font-size:.74rem; font-weight:600; text-decoration:none; transition:background .16s ease,color .16s ease; } nav a span { display:inline-block; width:2rem; color:#7c9bc6; font-size:.65rem; } nav a:hover, nav a.active { background:rgb(255 255 255 / 11%); color:#fff; } nav a.active span { color:#7dd3fc; }
  .user-block { margin:0 .75rem .75rem; padding:1rem .75rem; border-top:1px solid rgb(255 255 255 / 12%); }.user-block p { overflow:hidden; margin:0; color:#fff; font-size:.78rem; font-weight:600; text-overflow:ellipsis; white-space:nowrap; }.user-block small { display:block; margin-top:.3rem; color:#a9c1e6; font-size:.62rem; }.user-block button, .mobile-header button { width:100%; margin-top:.8rem; padding:.55rem; border:1px solid rgb(255 255 255 / 18%); background:transparent !important; color:#b9cde9 !important; font-size:.67rem; }.user-block button:hover, .mobile-header button:hover { color:#fff !important; }
  .content-shell { display:flex; min-width:0; flex:1; flex-direction:column; }.content-shell { background:linear-gradient(180deg,#fbfcff 0,#f6f8fc 38%); } main { width:min(1320px,100%); flex:1; margin:0 auto; padding:2.6rem clamp(1.25rem,4vw,3rem) 4rem; }.mobile-header { display:none; }.loading { display:grid; min-height:100svh; place-items:center; color:var(--dim); font-size:.8rem; }
  @media(max-width:760px) { .sidebar { display:none; } .mobile-header { display:flex; justify-content:space-between; align-items:center; padding:.9rem 1rem; background:var(--navy); color:#fff; font-family:"Manrope",sans-serif; font-size:1rem; font-weight:800; }.mobile-header span span { color:#7dd3fc; }.mobile-header button { width:auto; margin:0; padding:.45rem .7rem; } main { padding-top:1.5rem; } }
</style>
