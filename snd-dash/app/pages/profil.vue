<script setup lang="ts">
// app/pages/profil.vue
//
definePageMeta({ layout: 'dashboard' })
//
// FR-22 (§22.1) — Profil owner. Halaman personal yang selalu terbuka bagi
// principal terautentikasi (§22.7). Menampilkan ringkasan yang dapat dibaca dari
// route yang tersedia (poin Contribution berjalan milik sendiri) dan tautan ke
// permukaan lain. Detail Profile lengkap diisi via alur pendaftaran; halaman ini
// menautkan ke sana. Server tetap otoritas akses.

import { apiGet } from '../composables/useApi'

interface PointsView {
  ownerId: string
  currentPeriodPoints: number
  carryOverPoints: number
  totalRunning: number
}

const points = ref<PointsView | null>(null)
const pointsError = ref<string | null>(null)
const loading = ref(true)

onMounted(async () => {
  const res = await apiGet<PointsView>('/api/contribution/points')
  if (res.error) pointsError.value = res.error.message
  else points.value = res.data
  loading.value = false
})
</script>

<template>
  <main class="page">
    <header class="page-head">
      <h1>Profil Saya</h1>
      <p class="sub">Ringkasan personal Anda. Halaman ini selalu terbuka.</p>
    </header>

    <section class="card">
      <h2>Poin Contribution</h2>
      <p v-if="loading" class="muted">Memuat…</p>
      <p v-else-if="pointsError" class="muted">Poin belum tersedia: {{ pointsError }}</p>
      <div v-else-if="points" class="points-grid">
        <div><span class="label">Periode berjalan</span><span class="big mono">{{ points.currentPeriodPoints }}</span></div>
        <div><span class="label">Carry-over</span><span class="big mono">{{ points.carryOverPoints }}</span></div>
        <div><span class="label">Total berjalan</span><span class="big mono">{{ points.totalRunning }}</span></div>
      </div>
    </section>

    <section class="card">
      <h2>Tautan Cepat</h2>
      <ul class="quick">
        <li><NuxtLink to="/harga">Harga Saham &amp; Riwayat</NuxtLink></li>
        <li><NuxtLink to="/rkap">RKAP &amp; Progress</NuxtLink></li>
        <li><NuxtLink to="/kontribusi">Contribution</NuxtLink></li>
        <li><NuxtLink to="/distribusi">Rekap Distribusi Laba</NuxtLink></li>
        <li><NuxtLink to="/pendaftaran">Pendaftaran &amp; Verifikasi</NuxtLink></li>
      </ul>
      <p class="hint">Beberapa permukaan terbuka penuh hanya setelah Pembelian Pertama Anda efektif (matriks keterbukaan §4.8).</p>
    </section>
  </main>
</template>

<style scoped>
.page { max-width: 800px; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
.page-head h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
.sub { color: #555; margin: 0 0 1rem; }
.card { border: 1px solid #e5e5e5; border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 1.25rem; background: #fff; }
.card h2 { font-size: 1.05rem; margin: 0 0 .75rem; }
.points-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: .75rem; }
.points-grid .label { display: block; font-size: .75rem; color: #777; }
.big { font-size: 1.6rem; font-weight: 700; }
.mono { font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.quick { list-style: none; padding: 0; margin: 0; display: grid; gap: .5rem; }
.quick a { color: #0a58ca; text-decoration: none; }
.hint { font-size: .78rem; color: #888; margin-top: .75rem; }
.muted { color: #888; }
</style>
