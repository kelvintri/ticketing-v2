<script lang="ts">
  export let label: string;
  export let value: string | number;
  export let detail = "";
  export let tone: "default" | "risk" | "ai" = "default";
</script>

<article class={`metric-card ${tone}`}>
  <span>{label}</span>
  <strong>{value}</strong>
  {#if detail}<small>{detail}</small>{/if}
</article>

<style>
  .metric-card { min-height: 128px; padding: 1.1rem; border: 1px solid var(--line); border-radius: 14px; background: var(--panel); box-shadow: 0 4px 18px rgb(16 42 82 / 4%); }
  .metric-card > span { display:block; color:var(--dim); font-size:.72rem; font-weight:600; }
  strong { display:block; margin-top:.7rem; color:var(--bone); font-family:"Manrope",sans-serif; font-size:1.75rem; letter-spacing:-.05em; }
  small { display:block; margin-top:.6rem; color:var(--dim); font-size:.7rem; }
  .risk { border-color:#f0d19b; background:#fffdfa; }.risk strong { color:#b56900; }
  .ai { border-color:#b9e4ee; background:#fbfeff; }.ai strong { color:var(--cyan); }
</style>
