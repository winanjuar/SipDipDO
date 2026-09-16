// app/composables/useEChart.client.ts
//
// Helper siklus hidup instance ECharts (klien-saja) untuk chart dashboard FR-18.
//
// Menyediakan init/dispose/resize + `setOption` reaktif sehingga chart selalu
// sinkron dengan data tabel (§18.4): saat `option` berubah (mis. Owner baru),
// chart di-update tanpa membuang instance. Diimpor HANYA oleh komponen
// `*.client.vue` — ECharts butuh DOM & tidak boleh berjalan di SSR.

import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import type { Ref } from 'vue'

/**
 * Mengikat sebuah `HTMLElement` (via template ref) ke instance ECharts dan
 * menerapkan `optionRef` secara reaktif. Menangani resize (ResizeObserver +
 * window) serta dispose saat unmount.
 */
export function useEChart(
  elRef: Ref<HTMLElement | null>,
  optionRef: Ref<EChartsOption>,
) {
  let chart: echarts.ECharts | null = null
  let observer: ResizeObserver | null = null

  function render() {
    if (!chart) return
    // notMerge:true agar penghapusan seri/label lama tidak menyisa (Owner keluar).
    chart.setOption(optionRef.value, { notMerge: true })
  }

  function resize() {
    chart?.resize()
  }

  onMounted(() => {
    if (!elRef.value) return
    chart = echarts.init(elRef.value)
    render()

    observer = new ResizeObserver(() => resize())
    observer.observe(elRef.value)
    window.addEventListener('resize', resize)
  })

  watch(optionRef, render, { deep: true })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', resize)
    observer?.disconnect()
    observer = null
    chart?.dispose()
    chart = null
  })

  return { resize }
}
