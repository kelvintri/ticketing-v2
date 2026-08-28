<script lang="ts">
  export let dueAt: string | null | undefined;
  export let breached = false;
  export let resolved = false;

  function state() {
    if (!dueAt) return "neutral";
    if (breached) return "breach";
    if (resolved) return "safe";
    const minutes = (Date.parse(dueAt) - Date.now()) / 60_000;
    return minutes <= 120 ? "risk" : "safe";
  }
  function label() {
    const current = state();
    if (current === "breach") return "SLA terlewati";
    if (!dueAt) return "SLA belum tersedia";
    if (resolved) return "SLA selesai";
    const minutes = Math.max(0, Math.round((Date.parse(dueAt) - Date.now()) / 60_000));
    if (current === "risk") return `Risiko SLA · ${minutes} mnt`;
    const hours = Math.floor(minutes / 60);
    return `SLA aman · ${hours ? `${hours}j ${minutes % 60}mnt` : `${minutes} mnt`}`;
  }
</script>

<span class={`sla-chip sla-${state()}`}>{label()}</span>
