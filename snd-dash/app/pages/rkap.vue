<script setup lang="ts">
// app/pages/rkap.vue
//
definePageMeta({ layout: 'dashboard' })
//
// FR-23 (§23.13) — Tabel RKAP + progress: Capital Item (Initial/Final Requirement,
// Fulfillment, Fulfillment Rate, Shortfall, Utilization, Achievement, Held) +
// agregat + ringkasan batas penyesuaian + ruang & Quantity Left per Capital Type.
//
// Keterbukaan §4.8: permukaan 'rkap_view' TERBUKA untuk semua principal
// terautentikasi termasuk Owner tanpa saham (§15.6). Server otoritas via
// assertSurfaceAccess; halaman ini hanya menampilkan.
//
// AD-10: seluruh uang/rasio adalah STRING dan dirender apa adanya via
// formatMoney/formatRatioPercent (tanpa Number()/parseFloat()).

import type { CapitalType } from '../../shared/domain/types'
import { apiGet, formatMoney, formatRatioPercent } from '../composables/useApi'

interface CapitalItemView {
  id: string
  name: string
  capitalType: CapitalType
  initialRequirement: string
  finalRequirement: string
  fulfillment: string
  fulfillmentRate: string
  shortfall: string
  utilization: string
  achievement: string
  held: string
}
interface RkapAggregates {
  totalInitialRequirement: string
  totalFinalRequirement: string
  totalFulfillment: string
  totalShortfall: string
  totalUtilization: string
  totalHeld: string
}
interface AdjustmentLimitSummary { budget: string; used: string; remaining: string }
interface CapitalTypeSpaceView { ruang: string; quantityLeft: number | null }
interface RkapPhaseView {
  phase: { id: string; name: string; isActive: boolean; instantAdjustmentBudget: string; instantAdjustmentUsed: string; momRef: string | null }
  items: CapitalItemView[]
  aggregates: RkapAggregates
  limitSummary: AdjustmentLimitSummary
  spaceByCapitalType: Record<string, CapitalTypeSpaceView>
}

const runningPrice = ref<string>('')
const view = ref<RkapPhaseView | null>(null)
const errorMsg = ref<string | null>(null)
const loading = ref(false)

async function load() {
  loading.value = true
  errorMsg.value = null
  const query: Record<string, string> = {}
  if (runningPrice.value.trim() !== '') query.runningPrice = runningPrice.value.trim()
  const res = await apiGet<RkapPhaseView>('/api/rkap/view', query)
  if (res.error) {
    errorMsg.value = res.error.message
    view.value = null
  } else {
    view.value = res.data
  }
  loading.value = false
}

onMounted(load)

const spaceEntries = computed(() =>
  view.value
    ? Object.entries(view.value.spaceByCapitalType) as [CapitalType, CapitalTypeSpaceView][]
    : [],
)
</script>

<template>
  <main class="page">
    <header class="page-head">
      <h1>RKAP &amp; Progress</h1>
      <p class="sub">Rencana Kerja &amp; Anggaran Perusahaan: kebutuhan modal, pemenuhan (Fulfillment), dan ruang tersisa.</p>
    </header>

    <div class="toolbar">
      <label>
        Harga berjalan (opsional, untuk Quantity Left)
        <input v-model="runningPrice" inputmode="decimal" placeholder="mis. 52000.00" />
      </label>
      <button type="button" @click="load" :disabled="loading">Hitung ulang</button>
    </div>

    <p v-if="errorMsg" class="error" role="alert">Tidak dapat memuat data: {{ errorMsg }}</p>
    <p v-if="loading" class="muted">Memuat…</p>

    <template v-if="view">
      <section class="card">
        <h2>Fase: {{ view.phase.name }} <span v-if="view.phase.isActive" class="badge">Aktif</span></h2>
        <div class="summary-grid">
          <div><span class="label">Batas penyesuaian</span><span class="mono">{{ formatMoney(view.limitSummary.budget) }}</span></div>
          <div><span class="label">Terpakai</span><span class="mono">{{ formatMoney(view.limitSummary.used) }}</span></div>
          <div><span class="label">Sisa kuota</span><span class="mono">{{ formatMoney(view.limitSummary.remaining) }}</span></div>
        </div>
      </section>

      <section class="card">
        <h2>Ruang RKAP &amp; Quantity Left per Capital Type</h2>
        <table>
          <thead>
            <tr><th>Capital Type</th><th class="num">Ruang</th><th class="num">Quantity Left</th></tr>
          </thead>
          <tbody>
            <tr v-for="[type, space] in spaceEntries" :key="type">
              <td>{{ type }}</td>
              <td class="num mono">{{ formatMoney(space.ruang) }}</td>
              <td class="num mono">{{ space.quantityLeft === null ? '—' : space.quantityLeft }}</td>
            </tr>
          </tbody>
        </table>
        <p class="hint">Quantity Left tampil hanya bila harga berjalan diisi.</p>
      </section>

      <section class="card wide">
        <h2>Tabel Capital Item (FR-23)</h2>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Capital Item</th>
                <th>Type</th>
                <th class="num">Initial Req.</th>
                <th class="num">Final Req.</th>
                <th class="num">Fulfillment</th>
                <th class="num">Fulfill. Rate</th>
                <th class="num">Shortfall</th>
                <th class="num">Utilization</th>
                <th class="num">Achievement</th>
                <th class="num">Held</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in view.items" :key="item.id">
                <td>{{ item.name }}</td>
                <td>{{ item.capitalType }}</td>
                <td class="num mono">{{ formatMoney(item.initialRequirement) }}</td>
                <td class="num mono">{{ formatMoney(item.finalRequirement) }}</td>
                <td class="num mono">{{ formatMoney(item.fulfillment) }}</td>
                <td class="num mono">{{ formatRatioPercent(item.fulfillmentRate) }}</td>
                <td class="num mono">{{ formatMoney(item.shortfall) }}</td>
                <td class="num mono">{{ formatMoney(item.utilization) }}</td>
                <td class="num mono">{{ formatRatioPercent(item.achievement) }}</td>
                <td class="num mono">{{ formatMoney(item.held) }}</td>
              </tr>
              <tr v-if="!view.items.length"><td colspan="10" class="muted">Belum ada Capital Item pada fase ini.</td></tr>
            </tbody>
            <tfoot v-if="view.items.length">
              <tr class="grand">
                <td colspan="2">Grand Total</td>
                <td class="num mono">{{ formatMoney(view.aggregates.totalInitialRequirement) }}</td>
                <td class="num mono">{{ formatMoney(view.aggregates.totalFinalRequirement) }}</td>
                <td class="num mono">{{ formatMoney(view.aggregates.totalFulfillment) }}</td>
                <td></td>
                <td class="num mono">{{ formatMoney(view.aggregates.totalShortfall) }}</td>
                <td class="num mono">{{ formatMoney(view.aggregates.totalUtilization) }}</td>
                <td></td>
                <td class="num mono">{{ formatMoney(view.aggregates.totalHeld) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.page { max-width: 1200px; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
.page-head h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
.sub { color: #555; margin: 0 0 1rem; }
.toolbar { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; margin-bottom: 1rem; }
.toolbar label { display: flex; flex-direction: column; gap: .25rem; font-size: .85rem; }
input, button { padding: .5rem .6rem; border: 1px solid #ccc; border-radius: 6px; background: #fff; }
button { cursor: pointer; }
button:disabled { opacity: .6; cursor: default; }
.card { border: 1px solid #e5e5e5; border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 1.25rem; background: #fff; }
.card h2 { font-size: 1.05rem; margin: 0 0 .75rem; }
.badge { font-size: .7rem; background: #e6f4ea; color: #1e7e34; padding: .1rem .5rem; border-radius: 999px; vertical-align: middle; }
.summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: .75rem; }
.summary-grid .label { display: block; font-size: .75rem; color: #777; }
.table-scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: .9rem; }
th, td { text-align: left; padding: .45rem .55rem; border-bottom: 1px solid #eee; white-space: nowrap; }
th.num, td.num { text-align: right; }
tfoot .grand td { font-weight: 700; border-top: 2px solid #ccc; }
.mono { font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.muted { color: #888; }
.hint { font-size: .78rem; color: #888; margin: .5rem 0 0; }
.error { color: #b00020; background: #fdecef; padding: .6rem .8rem; border-radius: 6px; }
</style>
