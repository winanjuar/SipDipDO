<script setup lang="ts">
// app/components/ChartDistribusiPemodalan.client.vue
//
// FR-18 §18.2 — Donut DUA CINCIN "Distribusi Pemodalan":
//   - Cincin DALAM  : per Capital Type (Modal Tetap / Bergerak / Operasional).
//   - Cincin LUAR   : per Owner (dipecah menurut kontribusi Shares tiap Owner
//                     pada masing-masing Capital Type), dikelompokkan sehingga
//                     irisan luar bersarang di dalam irisan cincin dalamnya.
//
// Klien-saja. Data dari props `rows` (satu sumber dengan tabel) → sinkron (§18.4)
// & Owner baru muncul otomatis (§18.5). Basis nilai = Shares per (Owner,
// Capital Type) dari `rows[].sharesByType`.

import type { EChartsOption } from 'echarts'
import { useEChart } from '../composables/useEChart.client'
import type { OwnershipRow } from '../composables/useOwnershipDashboard'
import type { CapitalType } from '../../shared/domain/types'

const props = defineProps<{ rows: OwnershipRow[] }>()

const el = ref<HTMLElement | null>(null)

const CAPITAL_TYPES: CapitalType[] = [
  'Modal Tetap',
  'Modal Bergerak',
  'Modal Operasional',
]

const option = computed<EChartsOption>(() => {
  // Cincin dalam: total Shares per Capital Type.
  const innerData = CAPITAL_TYPES.map((t) => ({
    name: t,
    value: props.rows.reduce((acc, r) => acc + (r.sharesByType[t] ?? 0), 0),
  })).filter((d) => d.value > 0)

  // Cincin luar: setiap Owner di dalam tiap Capital Type (bersarang). Diurutkan
  // menurut Capital Type agar irisan luar sejajar dengan irisan dalamnya.
  const outerData: Array<{ name: string; value: number }> = []
  for (const t of CAPITAL_TYPES) {
    for (const r of props.rows) {
      const v = r.sharesByType[t] ?? 0
      if (v > 0) outerData.push({ name: `${r.ownerName} — ${t}`, value: v })
    }
  }

  return {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      type: 'scroll',
      bottom: 0,
      data: CAPITAL_TYPES,
    },
    series: [
      {
        name: 'Per Capital Type',
        type: 'pie',
        selectedMode: 'single',
        radius: [0, '38%'],
        center: ['50%', '46%'],
        label: { position: 'inner', fontSize: 11, formatter: '{b}' },
        labelLine: { show: false },
        data: innerData,
      },
      {
        name: 'Per Owner',
        type: 'pie',
        radius: ['52%', '72%'],
        center: ['50%', '46%'],
        label: {
          formatter: '{b}\n{d}%',
          fontSize: 10,
        },
        data: outerData,
      },
    ],
  }
})

useEChart(el, option)
</script>

<template>
  <figure class="chart-card">
    <figcaption class="chart-title">Distribusi Pemodalan</figcaption>
    <div ref="el" class="chart-canvas" role="img" aria-label="Donut dua cincin Distribusi Pemodalan per Capital Type dan per Owner" />
    <p v-if="props.rows.length === 0" class="chart-empty">Belum ada data pemodalan.</p>
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
  height: 360px;
}
.chart-empty {
  text-align: center;
  color: #64748b;
  font-style: italic;
}
</style>
