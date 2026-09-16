<script setup lang="ts">
// Kerangka landing scaffold (Story 1.1) — landing sesuai role menyusul di
// Story 1.2 (UX-DR14). Halaman ini hanya memastikan `/` ter-render SSR dengan
// header no-store (verifikasi AD-12).
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
    <h1 class="text-3xl font-semibold text-primary">Sip &amp; Dip</h1>
    <p class="text-muted-foreground">Owner Dashboard</p>
    <NuxtLink
      to="/smoke"
      class="inline-flex h-11 items-center justify-center rounded-md border px-4 text-sm font-medium"
    >
      Halaman smoke substrat
    </NuxtLink>
  </main>
</template>
