<script setup lang="ts">
/**
 * Antrian Beli — landing COO (UX-DR14). KERANGKA state kosong (UX-DR19):
 * antrian pesanan, konfirmasi COO, dan input langsung adalah scope nyata
 * Story 1.7 (navigasi) dan Epic 3 — jangan diimplementasi di story ini.
 */
definePageMeta({ auth: true })

useSekaliToastMasuk()

useHead({ title: 'Antrian Beli — Sip & Dip' })
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-7xl flex-col gap-6 px-4 py-8">
    <header>
      <h1 class="text-2xl font-semibold">Antrian Beli</h1>
      <p class="text-sm text-muted-foreground">Pesanan pembelian menunggu konfirmasi.</p>
    </header>

    <section class="flex flex-1 items-center justify-center rounded-lg border border-dashed p-10 text-center">
      <p class="text-sm text-muted-foreground">
        Antrian kosong — belum ada pesanan menunggu konfirmasi.
      </p>
    </section>
  </main>
</template>
