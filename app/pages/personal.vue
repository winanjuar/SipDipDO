<script setup lang="ts">
/**
 * Halaman Personal — landing owner tanpa saham / Keluar (UX-DR14). KERANGKA
 * state kosong (UX-DR19): Profile, Pesanan Pembelian, harga & RKAP adalah
 * scope nyata Story 1.7/1.8 dan Epic 2–3 — jangan diimplementasi di sini.
 */
definePageMeta({ auth: true })

useHead({ title: 'Halaman Personal — Sip & Dip' })
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-8">
    <header>
      <h1 class="text-2xl font-semibold">Halaman Personal</h1>
      <p class="text-sm text-muted-foreground">Profile dan pesanan Anda.</p>
    </header>

    <section class="flex flex-1 items-center justify-center rounded-lg border border-dashed p-10 text-center">
      <p class="text-sm text-muted-foreground">
        Belum ada data personal untuk ditampilkan.
      </p>
    </section>
  </main>
</template>
