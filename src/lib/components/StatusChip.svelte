<script lang="ts">
  export let status: string;
  const labels: Record<string, string> = { OPEN: "Baru", ASSIGNED: "Ditugaskan", IN_PROGRESS: "Dikerjakan", RESOLVED: "Terselesaikan", CLOSED: "Ditutup" };
</script>

<span class={`status-chip status-${status.toLowerCase()}`}>{labels[status] ?? status}</span>
