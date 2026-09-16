<script setup lang="ts">
// Shell offline statis (AD-12): isi persis status global "Tidak dapat
// terhubung" + Coba lagi (= navigasi ulang penuh — anchor biasa, bukan
// router-link). Halaman ini di-prerender (`routeRules '/offline'`) lalu
// di-precache oleh service worker sebagai SATU-SATUNYA HTML — tidak boleh
// bergantung pada data runtime apa pun.
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
    <h1 class="text-2xl font-semibold">Tidak dapat terhubung</h1>
    <p class="max-w-sm text-muted-foreground">
      Data dashboard selalu membutuhkan koneksi. Periksa koneksi internet Anda, lalu coba lagi.
    </p>
    <a
      href="/"
      class="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground"
    >
      Coba lagi
    </a>
  </main>
</template>
