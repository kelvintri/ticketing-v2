<script lang="ts">
  export let title = "AI Assist";
  export let summary: string;
  export let suggestion: string;
  export let confidence = "Perlu tinjauan agen";
</script>

<aside class="ai-insight" aria-label="Rekomendasi AI">
  <div class="head"><div><span class="spark">✦</span><strong>{title}</strong></div><span class="ai-chip">{confidence}</span></div>
  <p class="label">Ringkasan konteks</p><p>{summary}</p>
  <p class="label">Usulan respons</p><p>{suggestion}</p>
  <small>AI hanya menyiapkan konteks dan draft. Agen tetap meninjau sebelum mengirim atau mengubah tiket.</small>
</aside>

<style>
  .ai-insight { padding:1.15rem; border:1px solid #b9e4ee; border-radius:14px; background:#fbfeff; }
  .head { display:flex; align-items:center; justify-content:space-between; gap:.75rem; }.head > div { display:flex; align-items:center; gap:.45rem; color:var(--cyan); }.spark { font-size:1rem; }
  .ai-insight p { margin:.3rem 0 .9rem; color:#38546c; font-size:.78rem; line-height:1.55; }.ai-insight .label { margin-top:1rem; margin-bottom:.3rem; color:var(--cyan); font-size:.66rem; font-weight:700; text-transform:uppercase; letter-spacing:.07em; }.ai-insight small { display:block; padding-top:.85rem; border-top:1px solid #d8edf2; color:#597082; font-size:.68rem; line-height:1.45; }
</style>
