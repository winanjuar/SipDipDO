<script setup lang="ts">
// app/pages/distribusi.vue
//
definePageMeta({ layout: 'dashboard' })
//
// FR-16 (§16.11) — Rekap distribusi laba: Laba Dibagikan, tiga budget pool
// (Charity/Dividen/Insentif), dan rincian per Owner (Dividen + Insentif + total).
//
// Keterbukaan §4.8 (§16.11): rekap distribusi laba (permukaan 'profit_recap')
// terbuka untuk Owner PEMEGANG SAHAM; Owner tanpa saham / Keluar hanya boleh
// selama masih memiliki poin Contribution yang BELUM ditunaikan. Enforcement
// penuh di server (assertSurfaceAccess 'profit_recap'). Aksi simulate/save adalah
// wewenang COO (requireCoo). Halaman ini hanya form + tampilan; jika server
// menolak akses, error 403 ditampilkan.
//
// AD-10: seluruh uang/rasio adalah STRING dan dirender apa adanya.

import { apiPost, formatMoney, formatRatioPercent } from '../composables/useApi'

interface OwnerRecapLine {
  ownerId: string
  portion: string
  points: number
  dividend: string
  incentive: string
  total: string
}
interface DistributionRecap {
  auditedProfit: string
  retainedProfit: string
  distributableProfit: string
  charityRatio: string
  dividendRatio: string
  incentiveRatio: string
  charityPool: string
  dividendPool: string
  incentivePool: string
  totalPoints: number
  lines: OwnerRecapLine[]
}

const form = reactive({
  auditedProfit: '',
  retainedProfit: '',
  charityRatio: '',
  dividendRatio: '',
  incentiveRatio: '',
  momRef: '',
})

const recap = ref<DistributionRecap | null>(null)
const errorMsg = ref<string | null>(null)
const busy = ref(false)
const savedId = ref<string | null>(null)

function buildBody(): Record<string, unknown> {
  const body: Record<string, unknown> = {
    auditedProfit: form.auditedProfit.trim(),
    retainedProfit: form.retainedProfit.trim(),
    charityRatio: form.charityRatio.trim(),
    dividendRatio: form.dividendRatio.trim(),
    incentiveRatio: form.incentiveRatio.trim(),
  }
  if (form.momRef.trim()) body.momRef = form.momRef.trim()
  return body
}

async function simulate() {
  busy.value = true; errorMsg.value = null; savedId.value = null
  const res = await apiPost<DistributionRecap>('/api/distribution/simulate', buildBody())
  if (res.error) { errorMsg.value = res.error.message; recap.value = null }
  else recap.value = res.data
  busy.value = false
}

async function saveRecap() {
  busy.value = true; errorMsg.value = null
  const res = await apiPost<{ id: string }>('/api/distribution/save', buildBody())
  if (res.error) errorMsg.value = res.error.message
  else savedId.value = res.data?.id ?? null
  busy.value = false
}
</script>

<template>
  <main class="page">
    <header class="page-head">
      <h1>Rekap Distribusi Laba</h1>
      <p class="sub">Simulasi &amp; penyimpanan rekap RUPS. Keterbukaan mengikuti matriks §4.8: Owner tanpa saham hanya melihat rekap selama masih memiliki poin Contribution belum ditunaikan.</p>
    </header>

    <section class="card">
      <h2>Parameter Rekap <span class="coo-tag">COO</span></h2>
      <form class="form" @submit.prevent="simulate">
        <label>Laba diaudit<input v-model="form.auditedProfit" inputmode="decimal" placeholder="12000000.00" required /></label>
        <label>Laba ditahan<input v-model="form.retainedProfit" inputmode="decimal" placeholder="2000000.00" required /></label>
        <label>Ratio Charity (0..1)<input v-model="form.charityRatio" inputmode="decimal" placeholder="0.05" required /></label>
        <label>Ratio Dividen (0..1)<input v-model="form.dividendRatio" inputmode="decimal" placeholder="0.41" required /></label>
        <label>Ratio Insentif (0..1)<input v-model="form.incentiveRatio" inputmode="decimal" placeholder="0.54" required /></label>
        <label>MoM Ref (opsional)<input v-model="form.momRef" /></label>
        <div class="actions">
          <button type="submit" :disabled="busy">{{ busy ? 'Memproses…' : 'Simulasikan' }}</button>
          <button type="button" class="secondary" :disabled="busy || !recap" @click="saveRecap">Simpan rekap (imutabel)</button>
        </div>
      </form>
      <p v-if="errorMsg" class="error" role="alert">{{ errorMsg }}</p>
      <p v-if="savedId" class="ok">Rekap tersimpan — <span class="mono small">{{ savedId }}</span></p>
    </section>

    <template v-if="recap">
      <section class="card">
        <h2>Ringkasan Laba</h2>
        <div class="summary-grid">
          <div><span class="label">Laba diaudit</span><span class="mono">{{ formatMoney(recap.auditedProfit) }}</span></div>
          <div><span class="label">Laba ditahan</span><span class="mono">{{ formatMoney(recap.retainedProfit) }}</span></div>
          <div><span class="label">Laba Dibagikan</span><span class="mono strong">{{ formatMoney(recap.distributableProfit) }}</span></div>
        </div>
      </section>

      <section class="card">
        <h2>Budget Pool</h2>
        <table>
          <thead><tr><th>Pool</th><th class="num">Ratio</th><th class="num">Nilai</th></tr></thead>
          <tbody>
            <tr><td>Charity (dialokasikan utuh)</td><td class="num mono">{{ formatRatioPercent(recap.charityRatio) }}</td><td class="num mono">{{ formatMoney(recap.charityPool) }}</td></tr>
            <tr><td>Dividen</td><td class="num mono">{{ formatRatioPercent(recap.dividendRatio) }}</td><td class="num mono">{{ formatMoney(recap.dividendPool) }}</td></tr>
            <tr><td>Insentif</td><td class="num mono">{{ formatRatioPercent(recap.incentiveRatio) }}</td><td class="num mono">{{ formatMoney(recap.incentivePool) }}</td></tr>
          </tbody>
        </table>
      </section>

      <section class="card wide">
        <h2>Rincian per Owner <span class="muted small">(Total poin: {{ recap.totalPoints }})</span></h2>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Owner</th><th class="num">Portion</th><th class="num">Poin</th>
                <th class="num">Dividen</th><th class="num">Insentif</th><th class="num">Total Hak</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="line in recap.lines" :key="line.ownerId">
                <td class="mono small">{{ line.ownerId }}</td>
                <td class="num mono">{{ formatRatioPercent(line.portion) }}</td>
                <td class="num mono">{{ line.points }}</td>
                <td class="num mono">{{ formatMoney(line.dividend) }}</td>
                <td class="num mono">{{ formatMoney(line.incentive) }}</td>
                <td class="num mono strong">{{ formatMoney(line.total) }}</td>
              </tr>
              <tr v-if="!recap.lines.length"><td colspan="6" class="muted">Tidak ada Owner pada rekap.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.page { max-width: 1100px; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
.page-head h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
.sub { color: #555; margin: 0 0 1rem; }
.card { border: 1px solid #e5e5e5; border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 1.25rem; background: #fff; }
.card h2 { font-size: 1.05rem; margin: 0 0 .75rem; }
.coo-tag { font-size: .65rem; background: #eef; color: #339; padding: .1rem .45rem; border-radius: 999px; vertical-align: middle; }
.form { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: .75rem; }
.form label { display: flex; flex-direction: column; gap: .25rem; font-size: .85rem; }
.form .actions { grid-column: 1 / -1; display: flex; gap: .75rem; }
input, button { padding: .5rem .6rem; border: 1px solid #ccc; border-radius: 6px; background: #fff; font: inherit; }
button { cursor: pointer; background: #0a58ca; color: #fff; border-color: #0a58ca; }
button.secondary { background: #fff; color: #0a58ca; }
button:disabled { opacity: .6; cursor: default; }
.summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: .75rem; }
.summary-grid .label { display: block; font-size: .75rem; color: #777; }
.table-scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: .9rem; }
th, td { text-align: left; padding: .45rem .55rem; border-bottom: 1px solid #eee; white-space: nowrap; }
th.num, td.num { text-align: right; }
.mono { font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.strong { font-weight: 700; }
.small { font-size: .8rem; color: #666; }
.muted { color: #888; }
.error { color: #b00020; background: #fdecef; padding: .6rem .8rem; border-radius: 6px; }
.ok { color: #1e7e34; }
</style>
