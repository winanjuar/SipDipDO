<script setup lang="ts">
// Prompt pembaruan service worker (AD-12):
// - registerType 'prompt' — versi baru TIDAK aktif otomatis (tanpa skipWaiting);
//   aktif saat muat natural berikutnya setelah aksi eksplisit pengguna ini.
// - Prompt TIDAK boleh muncul di atas dialog transaksional (MFA, konfirmasi,
//   input langsung, cut-off, penyesuaian RKAP): z-index di bawah overlay
//   dialog (z-50); permukaan transaksional menahan prompt selama dialog
//   terbuka — disiplin ditegakkan per permukaan pada story masing-masing.
const pwa = usePWA()
const needRefresh = computed(() => pwa?.needRefresh ?? false)

function muatVersiBaru() {
  pwa?.updateServiceWorker(true)
}
</script>

<template>
  <output
    v-if="needRefresh"
    aria-live="polite"
    data-testid="prompt-pembaruan"
    class="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg border bg-popover px-4 py-3 text-popover-foreground shadow-lg"
  >
    <span class="text-sm">Pembaruan aplikasi tersedia.</span>
    <button
      type="button"
      class="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
      @click="muatVersiBaru"
    >
      Muat versi baru
    </button>
  </output>
</template>
