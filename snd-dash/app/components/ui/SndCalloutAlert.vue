<script setup lang="ts">
// app/components/ui/SndCalloutAlert.vue
//
// Primitif UI ringan (mandiri, tanpa dependensi) untuk kotak sorotan/alert.
// Nama unik `Snd*` agar tidak bentrok dengan primitif shadcn-vue yang mungkin
// ditambahkan tugas paralel lain. Dipakai a.l. oleh `PanelPratinjauPerhitungan`
// untuk "Alert Penolakan Terhitung" (varian `danger`).

withDefaults(
  defineProps<{
    /** Nada visual: info netral, sukses hijau, peringatan kuning, bahaya merah. */
    variant?: 'info' | 'success' | 'warning' | 'danger'
    /** Judul opsional (mis. "Alert Penolakan Terhitung"). */
    title?: string
  }>(),
  { variant: 'info', title: undefined },
)
</script>

<template>
  <div class="snd-callout" :class="`snd-callout--${variant}`" role="alert">
    <p v-if="title" class="snd-callout__title">{{ title }}</p>
    <div class="snd-callout__body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.snd-callout {
  border: 1px solid var(--snd-callout-border, #cbd5e1);
  border-left-width: 4px;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  background: var(--snd-callout-bg, #f8fafc);
  color: var(--snd-callout-fg, #0f172a);
}
.snd-callout__title {
  margin: 0 0 0.35rem;
  font-weight: 600;
  font-size: 0.95rem;
}
.snd-callout__body {
  font-size: 0.9rem;
}
.snd-callout--info {
  --snd-callout-border: #3b82f6;
  --snd-callout-bg: #eff6ff;
}
.snd-callout--success {
  --snd-callout-border: #16a34a;
  --snd-callout-bg: #f0fdf4;
}
.snd-callout--warning {
  --snd-callout-border: #d97706;
  --snd-callout-bg: #fffbeb;
}
.snd-callout--danger {
  --snd-callout-border: #dc2626;
  --snd-callout-bg: #fef2f2;
  --snd-callout-fg: #7f1d1d;
}
</style>
