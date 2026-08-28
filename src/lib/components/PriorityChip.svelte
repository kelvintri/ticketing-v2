<script lang="ts">
  export let priority: string;
  const labels: Record<string, string> = { LOW: "Rendah", MEDIUM: "Sedang", HIGH: "Tinggi", URGENT: "Urgent" };
</script>

<span class={`priority-chip priority-${priority.toLowerCase()}`}>{labels[priority] ?? priority}</span>
