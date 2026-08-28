<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { api, ApiError, getToken, setToken, type LoginResponse } from "$lib/api";

  let email = "";
  let password = "";
  let message = "";
  let loading = false;

  onMount(() => {
    if (getToken()) void goto("/dashboard");
  });

  async function submit() {
    loading = true;
    message = "";
    try {
      const result = await api<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setToken(result.token);
      await goto("/dashboard");
    } catch (cause) {
      message = cause instanceof ApiError ? cause.message : "Login gagal";
    } finally {
      loading = false;
    }
  }
</script>

<svelte:head><title>Login — Ticket.Ops</title></svelte:head>

<div class="login-page">
  <section class="login-brand">
    <p class="brand-label">IT Helpdesk platform</p>
    <h1>Support that<br />moves <span>forward.</span></h1>
    <p class="tagline">Satu workspace untuk menerima, memprioritaskan, dan menyelesaikan setiap permintaan layanan IT.</p>
    <div class="benefits" aria-label="Keunggulan Ticket Ops">
      <article><div><strong>Telegram intake</strong><small>Tiket masuk dari kanal yang dipakai pengguna.</small></div></article>
      <article><div><strong>SLA monitoring</strong><small>Prioritas dan risiko layanan selalu terlihat.</small></div></article>
      <article><div><strong>AI knowledge assist</strong><small>Draft respons tetap ditinjau oleh agen.</small></div></article>
    </div>
  </section>
  <section class="login-panel">
    <h2>Selamat datang</h2>
    <p class="login-copy">Masuk untuk mengelola antrian layanan dan menjaga komitmen SLA.</p>
    <form on:submit|preventDefault={submit}>
      <label>Email<input type="email" bind:value={email} placeholder="admin@helpdesk.local" autocomplete="username" required /></label>
      <label>Password<input type="password" bind:value={password} placeholder="••••••••" autocomplete="current-password" required /></label>
      {#if message}<p class="error">{message}</p>{/if}
      <button class="primary" disabled={loading} aria-busy={loading}>{loading ? "Memeriksa…" : "Masuk ke workspace"}</button>
    </form>
    <p class="footnote">Hanya untuk agen dan administrator terdaftar.</p>
  </section>
</div>

<style>
  .login-page { display:grid; grid-template-columns:minmax(0,1.12fr) minmax(420px,.88fr); min-height:100svh; }.login-brand { display:flex; flex-direction:column; justify-content:center; padding:clamp(2.5rem,7vw,7rem); background:radial-gradient(40rem 32rem at 0 10%,#224d8e 0,transparent 65%),linear-gradient(135deg,#102a52,#163c73); color:#fff; }.brand-label { margin:0 0 1.2rem; color:#b9d5ff; font-size:.72rem; font-weight:700; letter-spacing:.09em; text-transform:uppercase; } h1 { margin:0; color:#fff; font-family:"Manrope",sans-serif; font-size:clamp(2.8rem,5.7vw,5.5rem); font-weight:800; letter-spacing:-.04em; line-height:.98; } h1 span { color:#7dd3fc; }.tagline { max-width:34rem; margin:1.4rem 0 0; color:#c6d9f4; font-size:.95rem; line-height:1.65; }.benefits { display:grid; gap:.8rem; max-width:34rem; margin-top:3rem; }.benefits article { display:flex; gap:.8rem; align-items:flex-start; padding:.85rem 0; border-top:1px solid rgb(255 255 255 / 18%); }.benefits article::before { content:""; width:.4rem; height:.4rem; flex:0 0 .4rem; margin-top:.38rem; border-radius:999px; background:#7dd3fc; }.benefits strong { display:block; color:#fff; font-size:.82rem; }.benefits small { display:block; margin-top:.22rem; color:#b9d5f7; font-size:.72rem; }
  .login-panel { display:flex; flex-direction:column; justify-content:center; width:min(410px,calc(100% - 3rem)); margin:auto; } h2 { margin:0; color:var(--bone); font-family:"Manrope",sans-serif; font-size:2rem; letter-spacing:-.035em; }.login-copy { margin:.65rem 0 2rem; color:var(--dim); font-size:.82rem; line-height:1.55; } form { display:grid; gap:1.1rem; } label { display:grid; gap:.5rem; color:#4e617d; font-size:.72rem; font-weight:700; } input { width:100%; padding:.8rem .85rem; font-size:.9rem; } input::placeholder { color:#a1aec0; } button { margin-top:.35rem; padding:.85rem; font-size:.78rem; } button.primary:not(:disabled):hover { transform:translateY(-1px); box-shadow:0 .5rem 1rem rgb(23 105 224 / 22%); } button:focus-visible { outline:3px solid rgb(8 126 164 / 30%); outline-offset:3px; }
  button:disabled { cursor:wait; opacity:.72; }
  .error { margin:0; color:var(--alert); font-size:.72rem; }
  .footnote { margin:1.8rem 0 0; color:var(--dim); font-size:.7rem; }.error { margin:0; font-size:.76rem; } @media(max-width:760px) { .login-page { display:block; } .login-brand { min-height:0; padding:2.25rem 1.5rem 2rem; } h1 { font-size:clamp(2.5rem,13vw,3.45rem); }.tagline { margin-top:1.25rem; font-size:.92rem; }.benefits { grid-template-columns:repeat(3,minmax(0,1fr)); gap:1rem; margin-top:1.75rem; }.benefits article { gap:.5rem; }.benefits article::before { width:.32rem; height:.32rem; flex-basis:.32rem; margin-top:.32rem; }.benefits small { font-size:.75rem; line-height:1.4; }.login-panel { display:block; width:100%; margin:0; padding:2.25rem 1.5rem 3rem; } }
</style>
