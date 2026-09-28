<script setup lang="ts">
/**
 * AdjustmentSummaryCard — Card ringkasan batas penyesuaian untuk fase RKAP.
 *
 * Menampilkan metrik kunci untuk memahami kapasitas penyesuaian tersisa:
 * - Batas Penyesuaian (adjustment limit = 1% + 1 saham)
 * - Terpakai (adjustment used)
 * - Persentase terpakai (percentage used)
 * - Sisa (remaining adjustment capacity)
 * - Quantity_Left (remaining shares that can be purchased)
 *
 * Semua angka diformat dengan tabular-nums dan locale id-ID.
 *
 * Role-based visibility (Req-6):
 * - Card visible to all users (informational)
 * - COO indicator shown when isCoo=true (can make adjustments)
 *
 * **Validates: Requirements 6, 10** (Req-6 AC1-3, Req-10 AC1, AC3, AC4)
 */
import type { RkapPhaseSummary } from '#shared/domain/rkap'
import { formatRatioAsPercent } from '#shared/domain/ratio'
import { formatRupiah } from '~/lib/harga'
import { computed } from 'vue'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

const props = defineProps<{
  /** Ringkasan batas penyesuaian dari API */
  summary: RkapPhaseSummary
  /** Apakah user adalah COO — menampilkan indikator aksi jika true (Req-6) */
  isCoo?: boolean
}>()

// ---------------------------------------------------------------------------
// Computed: Calculate usage ratio
// ---------------------------------------------------------------------------

/**
 * Hitung persentase terpakai dari batas penyesuaian.
 * Ratio = adjustmentUsed / adjustmentLimit
 */
const usageRatio = computed((): string => {
  const used = Number.parseFloat(props.summary.adjustmentUsed)
  const limit = Number.parseFloat(props.summary.adjustmentLimit)
  
  if (Number.isNaN(limit) || limit === 0) return '0.000000'
  if (Number.isNaN(used)) return '0.000000'
  
  return (used / limit).toFixed(6)
})

/**
 * Determine color styling based on usage percentage.
 * - < 80%: green (healthy)
 * - 80-95%: amber (warning)
 * - >= 95%: red (critical)
 */
const usageColorClass = computed((): string => {
  const ratio = Number.parseFloat(usageRatio.value)
  
  if (ratio >= 0.95) {
    return 'text-red-600 dark:text-red-400'
  }
  if (ratio >= 0.80) {
    return 'text-amber-600 dark:text-amber-400'
  }
  return 'text-green-600 dark:text-green-400'
})

/**
 * Progress bar width percentage (capped at 100%).
 */
const progressWidth = computed((): string => {
  const ratio = Number.parseFloat(usageRatio.value)
  const percent = Math.min(ratio * 100, 100)
  return `${percent}%`
})

/**
 * Progress bar color class based on usage.
 */
const progressColorClass = computed((): string => {
  const ratio = Number.parseFloat(usageRatio.value)
  
  if (ratio >= 0.95) {
    return 'bg-red-500'
  }
  if (ratio >= 0.80) {
    return 'bg-amber-500'
  }
  return 'bg-green-500'
})

/**
 * Format quantity left dengan locale id-ID (titik sebagai pemisah ribuan).
 */
function formatQuantity(qty: number): string {
  return new Intl.NumberFormat('id-ID').format(qty)
}
</script>

<template>
  <div
    class="rounded-lg border bg-card p-6 shadow-sm"
    data-testid="adjustment-summary-card"
  >
    <!-- Card Header with role indicator (Req-6) -->
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-sm font-medium text-muted-foreground">
        Ringkasan Batas Penyesuaian
      </h3>
      <!-- Read-only indicator for non-COO users (Req-6 AC1, AC2) -->
      <span
        v-if="!isCoo"
        class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
        data-testid="readonly-indicator"
      >
        Lihat saja
      </span>
    </div>

    <!-- Progress Bar -->
    <div class="mb-6">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-sm text-muted-foreground">Kapasitas Terpakai</span>
        <span
          class="text-sm font-medium tabular-nums"
          :class="usageColorClass"
          data-testid="usage-percent"
        >
          {{ formatRatioAsPercent(usageRatio) }}
        </span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          class="h-full rounded-full transition-all duration-300"
          :class="progressColorClass"
          :style="{ width: progressWidth }"
          data-testid="usage-progress-bar"
        />
      </div>
    </div>

    <!-- Summary Grid -->
    <div class="grid grid-cols-2 gap-4">
      <!-- Batas Penyesuaian (Adjustment Limit) -->
      <div class="space-y-1">
        <span class="text-xs text-muted-foreground">
          Batas (1% + 1 saham)
        </span>
        <p
          class="text-lg font-semibold tabular-nums"
          data-testid="adjustment-limit"
        >
          {{ formatRupiah(summary.adjustmentLimit) }}
        </p>
      </div>

      <!-- Terpakai (Adjustment Used) -->
      <div class="space-y-1">
        <span class="text-xs text-muted-foreground">
          Terpakai
        </span>
        <p
          class="text-lg font-semibold tabular-nums"
          data-testid="adjustment-used"
        >
          {{ formatRupiah(summary.adjustmentUsed) }}
        </p>
      </div>

      <!-- Sisa (Adjustment Remaining) -->
      <div class="space-y-1">
        <span class="text-xs text-muted-foreground">
          Sisa
        </span>
        <p
          class="text-lg font-semibold tabular-nums"
          :class="Number.parseFloat(summary.adjustmentRemaining) < 0 ? 'text-red-600 dark:text-red-400' : ''"
          data-testid="adjustment-remaining"
        >
          {{ formatRupiah(summary.adjustmentRemaining) }}
        </p>
      </div>

      <!-- Quantity Left -->
      <div class="space-y-1">
        <span class="text-xs text-muted-foreground">
          Sisa Saham (Quantity Left)
        </span>
        <p
          class="text-lg font-semibold tabular-nums"
          data-testid="quantity-left"
        >
          {{ formatQuantity(summary.quantityLeft) }} saham
        </p>
      </div>
    </div>

    <!-- Total Initial Reference (smaller, below main metrics) -->
    <div class="mt-4 border-t pt-3">
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted-foreground">Total Initial Requirement</span>
        <span
          class="font-medium tabular-nums"
          data-testid="total-initial-requirement"
        >
          {{ formatRupiah(summary.totalInitialRequirement) }}
        </span>
      </div>
    </div>
  </div>
</template>
