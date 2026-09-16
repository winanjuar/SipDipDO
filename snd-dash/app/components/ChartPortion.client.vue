<script setup lang="ts">
// app/components/ChartPortion.client.vue
//
// FR-18 §18.1 — Pie "Portion Kepemilikan": label nama Owner + persentase Portion.
//
// Klien-saja (ECharts butuh DOM). Data dari props `rows` (satu sumber dengan
// tabel) sehingga chart sinkron dengan tabel (§18.4) dan Owner baru muncul
// otomatis (§18.5). Persentase dihitung ECharts dari nilai Shares (proporsi
// identik dengan Portion = Shares owner ÷ Σ Shares).

import type { EChartsOption } from 'echarts'
import { useEChart } from '../composables/useEChart.client'
import type { OwnershipRow } from '../composables/useOwnershipDashboard'

const props = defineProps<{ rows: OwnershipRow[] }>()

const el = ref<HTMLElement | null>(null)

const option = computed<EChartsOption>(() => ({
  tooltip: {
    trigger: 'item',
    formatter: '{b}: {d}%',
  },
  legend: {
    type: 'scroll',
    orient: 'horizontal',
    bottom: 0,
  },
  series: [
    {
      name: 'Portion Kepemilikan',
      type: 'pie',
      radius: '62%',
      center: ['50%', '46%'],
      // Nilai seri = Shares; ECharts menurunkan persentase = Portion (§18.1).
      data: props.rows.map((r) => ({ name: r.ownerName, value: r.shares })),
      label: {
        formatter: '{b}\n{d}%',
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.3)',
        },
      },
    },
  ],
}))

useEChart(el, option)
</script>

<template>
  <figure class="chart-card">
    <figcaption class="chart-title">Portion Kepemilikan</figcaption>
    <div ref="el" class="chart-canvas" role="img" aria-label="Pie chart Portion Kepemilikan per Owner" />
    <p v-if="props.rows.length === 0" class="chart-empty">Belum ada data kepemilikan.</p>
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
  height: 320px;
}
.chart-empty {
  text-align: center;
  color: #64748b;
  font-style: italic;
}
</style>
