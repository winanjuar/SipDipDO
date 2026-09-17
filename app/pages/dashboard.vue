<script setup lang="ts">
/**
 * Dashboard Kepemilikan — landing pemegang saham (UX-DR14). KERANGKA state
 * kosong (UX-DR19): tabel/chart kepemilikan adalah scope nyata Story 1.7
 * (navigasi) dan Epic 2 (dashboard) — jangan diimplementasi di story ini.
 */
definePageMeta({ auth: true })

useHead({ title: 'Dashboard — Sip & Dip' })
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-7xl flex-col gap-6 px-4 py-8">
    <header>
      <h1 class="text-2xl font-semibold">Dashboard</h1>
      <p class="text-sm text-muted-foreground">Kepemilikan saham seluruh owner.</p>
    </header>

    <section class="flex flex-1 items-center justify-center rounded-lg border border-dashed p-10 text-center">
      <p class="text-sm text-muted-foreground">
        Belum ada data kepemilikan untuk ditampilkan.
      </p>
    </section>
  </main>
</template>
