<script setup lang="ts">
// app/components/ChartBigCap.client.vue
//
// FR-18 §18.3/§18.6 — Stacked bar "Big Cap": menyandingkan Shares vs Ceil per
// KELOMPOK KAP. Kelompok dihitung dari Portion berjalan tiap Owner (§18.5):
//   - Big Cap    : Portion  > ambang Big   (default 5%)   → tiap Owner satu bar.
//   - Medium Cap : Portion  > ambang Medium (default 2%)  → kelompok AGREGAT.
//   - Small Cap  : Portion ≤ ambang Medium (default 2%)   → kelompok AGREGAT.
// Ambang KONFIGURABEL via props (§18.6). Klien-saja; data dari props `rows`
// (sinkron dengan tabel, §18.4) dan `grandTotal` (basis Portion konsisten).
//
// Perbandingan "Shares vs Ceil" ditampilkan sebagai dua seri bar berdampingan per
// kategori sumbu-x; tumpukan (stack) memisahkan kontribusi tiap Owner dalam Big
// Cap dan agregat pada Medium/Small.

import type { EChartsOption } from 'echarts'
import { useEChart } from '../composables/useEChart.client'
import type {
  OwnershipGrandTotal,
  OwnershipRow,
} from '../composables/useOwnershipDashboard'

const props = withDefaults(
  defineProps<{
    rows: OwnershipRow[]
    grandTotal: OwnershipGrandTotal | null
    /** Ambang Big Cap sebagai fraksi Portion (default 0.05 = 5%). §18.6 */
    bigThreshold?: number
    /** Ambang Medium Cap sebagai fraksi Portion (default 0.02 = 2%). §18.6 */
    mediumThreshold?: number
  }>(),
  {
    bigThreshold: 0.05,
    mediumThreshold: 0.02,
  },
)

const el = ref<HTMLElement | null>(null)

interface CapGroup {
  label: string
  shares: number
  ceil: number
}

const option = computed<EChartsOption>(() => {
  const grandShares = props.grandTotal?.shares ?? 0

  // Portion fraksi per Owner (aman: pembagian display-only untuk klasifikasi kap).
  function portionFraction(shares: number): number {
    return grandShares > 0 ? shares / grandShares : 0
  }

  const big: CapGroup[] = []
  const medium: CapGroup = { label: 'Medium Cap', shares: 0, ceil: 0 }
  const small: CapGroup = { label: 'Small Cap', shares: 0, ceil: 0 }

  for (const r of props.rows) {
    const p = portionFraction(r.shares)
    if (p > props.bigThreshold) {
      big.push({ label: r.ownerName, shares: r.shares, ceil: r.ceil })
    } else if (p > props.mediumThreshold) {
      medium.shares += r.shares
      medium.ceil += r.ceil
    } else {
      small.shares += r.shares
      small.ceil += r.ceil
    }
  }

  // Sumbu-x: tiap Owner Big Cap + kelompok agregat Medium & Small.
  const groups: CapGroup[] = [...big, medium, small]
  const categories = groups.map((g) => g.label)

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    legend: {
      data: ['Shares', 'Ceil'],
      top: 0,
    },
    grid: { left: 48, right: 16, bottom: 56, top: 32 },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: { interval: 0, rotate: categories.length > 4 ? 30 : 0 },
    },
    yAxis: { type: 'value', name: 'Jumlah' },
    series: [
      {
        name: 'Shares',
        type: 'bar',
        stack: 'shares',
        data: groups.map((g) => g.shares),
        itemStyle: { color: '#2563eb' },
      },
      {
        name: 'Ceil',
        type: 'bar',
        stack: 'ceil',
        data: groups.map((g) => g.ceil),
        itemStyle: { color: '#f59e0b' },
      },
    ],
  }
})

useEChart(el, option)
</script>

<template>
  <figure class="chart-card">
    <figcaption class="chart-title">Big Cap — Shares vs Ceil</figcaption>
    <div ref="el" class="chart-canvas" role="img" aria-label="Stacked bar Big Cap menyandingkan Shares dan Ceil per kelompok kap" />
    <p class="chart-note">
      Ambang: Big Cap &gt; {{ (props.bigThreshold * 100).toFixed(0) }}%,
      Medium Cap &gt; {{ (props.mediumThreshold * 100).toFixed(0) }}%,
      Small Cap &le; {{ (props.mediumThreshold * 100).toFixed(0) }}%
    </p>
    <p v-if="props.rows.length === 0" class="chart-empty">Belum ada data kap.</p>
  </figure>
</template>

<style scoped>
.chart-card {
  margin: 0;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  background: #fff;
}
.chart-title {
  font-weight: 600;
  color: #334155;
  margin-bottom: 0.5rem;
}
.chart-canvas {
  width: 100%;
  height: 340px;
}
.chart-note {
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 0.5rem;
}
.chart-empty {
  text-align: center;
  color: #64748b;
  font-style: italic;
}
</style>
