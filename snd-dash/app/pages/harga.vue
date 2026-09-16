<script setup lang="ts">
// app/pages/harga.vue
//
// FR-6 (§6.5) / FR-7 (§7.1) — Harga berjalan & riwayat harga + MoM ringkas.
//
// Keterbukaan §4.8: harga berjalan & riwayat harga TERBUKA untuk SEMUA principal
// terautentikasi, termasuk Owner tanpa saham (permukaan 'price_history', §15.6).
// Server (assertSurfaceAccess) tetap otoritas; halaman ini hanya menampilkan.
//
// AD-10: `price` datang sebagai MoneyString (string) — dirender apa adanya via
// formatMoney (tanpa Number()/parseFloat()).

definePageMeta({ layout: 'dashboard' })

import type { PriceKind } from '../../shared/domain/types'
import { apiGet, formatMoney, formatDate } from '../composables/useApi'

interface PricePeriodView {
  id: string
  kind: PriceKind
  price: string
  effectiveDate: string
  momRef: string | null
  createdAt: string
}

const kind = ref<PriceKind>('beli')

const current = ref<PricePeriodView | null>(null)
const history = ref<PricePeriodView[]>([])
const errorMsg = ref<string | null>(null)
const loading = ref(false)

async function load() {
  loading.value = true
  errorMsg.value = null
  const [cur, hist] = await Promise.all([
    apiGet<PricePeriodView>('/api/pricing/current', { kind: kind.value }),
    apiGet<PricePeriodView[]>('/api/pricing/history', { kind: kind.value }),
  ])
  if (cur.error) errorMsg.value = cur.error.message
  else current.value = cur.data
  if (hist.error) errorMsg.value = hist.error.message
  else history.value = hist.data ?? []
  loading.value = false
}

watch(kind, load)
onMounted(load)
</script>

<template>
  <main class="page">
    <header class="page-head">
      <h1>Harga Saham</h1>
      <p class="sub">Harga berjalan &amp; riwayat lengkap. Terbuka untuk semua Owner (termasuk yang belum memiliki saham).</p>
    </header>

    <div class="toolbar">
      <label>
        Jenis Harga
        <select v-model="kind">
          <option value="beli">Beli</option>
          <option value="jual">Jual (Phase 2)</option>
        </select>
      </label>
      <button type="button" @click="load" :disabled="loading">Muat ulang</button>
    </div>

    <p v-if="errorMsg" class="error" role="alert">Tidak dapat memuat data: {{ errorMsg }}</p>

    <section class="card" aria-label="Harga berjalan">
      <h2>Harga Berjalan</h2>
      <p v-if="loading" class="muted">Memuat…</p>
      <template v-else-if="current">
        <p class="big-money mono">{{ formatMoney(current.price) }}</p>
        <p class="muted">Efektif sejak {{ formatDate(current.effectiveDate) }}</p>
      </template>
      <p v-else class="muted">Belum ada harga tercatat untuk jenis ini.</p>
    </section>

    <section class="card" aria-label="Riwayat harga">
      <h2>Riwayat Harga</h2>
      <table v-if="history.length">
        <thead>
          <tr>
            <th>Tanggal Efektif</th>
            <th class="num">Harga</th>
            <th>MoM</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in history" :key="row.id">
            <td>{{ formatDate(row.effectiveDate) }}</td>
            <td class="num mono">{{ formatMoney(row.price) }}</td>
            <td class="mono small">{{ row.momRef ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else-if="!loading" class="muted">Belum ada riwayat harga.</p>
    </section>

    <nav class="links">
      <NuxtLink to="/mom">Minutes of Meeting →</NuxtLink>
    </nav>
  </main>
</template>

<style scoped>
.page { max-width: 960px; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
.page-head h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
.sub { color: #555; margin: 0 0 1rem; }
.toolbar { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; margin-bottom: 1rem; }
.toolbar label { display: flex; flex-direction: column; gap: .25rem; font-size: .85rem; }
select, button { padding: .5rem .6rem; border: 1px solid #ccc; border-radius: 6px; background: #fff; }
button { cursor: pointer; }
button:disabled { opacity: .6; cursor: default; }
.card { border: 1px solid #e5e5e5; border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 1.25rem; background: #fff; }
.card h2 { font-size: 1.05rem; margin: 0 0 .75rem; }
.big-money { font-size: 1.8rem; font-weight: 700; margin: 0; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: .5rem .6rem; border-bottom: 1px solid #eee; }
th.num, td.num { text-align: right; }
.mono { font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.small { font-size: .8rem; color: #666; }
.muted { color: #888; }
.error { color: #b00020; background: #fdecef; padding: .6rem .8rem; border-radius: 6px; }
.links { margin-top: 1rem; }
.links a { color: #0a58ca; text-decoration: none; }
</style>
