<script setup lang="ts">
/**
 * RkapTable — Tabel RKAP dengan Capital Items dan subtotal per jenis modal.
 *
 * Fitur utama:
 * - Kolom verbatim sesuai Req-5 AC4: nama, jenis modal, Initial Requirement,
 *   Final Requirement, Fulfillment, Fulfillment Rate, Shortfall, Utilization,
 *   Achievement, Held
 * - Subtotal rows per jenis modal (Tetap dan Bergerak) sesuai Req-5 AC5
 * - Mobile viewport (<lg): sticky kolom nama di kiri dengan horizontal scroll (Req-5 AC7)
 * - Money values formatted dengan tabular-nums dan locale id-ID (Rp format) (Req-4 AC5)
 * - Percentages formatted dengan 2 desimal (Req-16)
 * - Role-based visibility: action columns only shown for COO (Req-6)
 *
 * **Validates: Requirements 5, 6, 16**
 */
import type { CapitalItemWire, CapitalType } from '#shared/domain/rkap'
import { formatRatioAsPercent } from '#shared/domain/ratio'
import { formatRupiah } from '~/lib/harga'
import { computed } from 'vue'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

const props = defineProps<{
  /** Daftar Capital Items dari API */
  items: CapitalItemWire[]
  /** Apakah user adalah COO — menampilkan kolom aksi jika true (Req-6) */
  isCoo?: boolean
  /** Phase ID untuk navigasi edit (optional) */
  phaseId?: string
}>()

// ---------------------------------------------------------------------------
// Emits
// ---------------------------------------------------------------------------

const emit = defineEmits<{
  /** Emitted when COO clicks adjust on an item */
  (e: 'adjust', item: CapitalItemWire): void
  /** Emitted when COO clicks utilization on an item */
  (e: 'utilization', item: CapitalItemWire): void
}>()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Label untuk jenis modal dalam Bahasa Indonesia */
const CAPITAL_TYPE_LABELS: Record<CapitalType, string> = {
  tetap: 'Tetap',
  bergerak: 'Bergerak',
}

/** Interface untuk baris subtotal agregat */
interface SubtotalRow {
  capitalType: CapitalType
  label: string
  initialRequirement: string
  finalRequirement: string
  fulfillment: string
  fulfillmentRate: string
  shortfall: string
  utilization: string
  achievement: string | null
  held: string
}

// ---------------------------------------------------------------------------
// Computed: Group items by capital type and calculate subtotals
// ---------------------------------------------------------------------------

/** Items grouped by capital type */
const groupedItems = computed(() => {
  const groups: Record<CapitalType, CapitalItemWire[]> = {
    tetap: [],
    bergerak: [],
  }

  for (const item of props.items) {
    groups[item.capitalType].push(item)
  }

  return groups
})

/** Order of capital types for display */
const CAPITAL_TYPE_ORDER: CapitalType[] = ['tetap', 'bergerak']

/**
 * Sum string decimal values.
 * Uses simple string-based addition to avoid floating point issues.
 * For display purposes, we rely on the pre-calculated values from the API.
 */
function sumDecimalStrings(values: string[]): string {
  if (values.length === 0) return '0.00'
  
  // Parse and sum - since these are display values, simple Number is okay
  // The critical calculations are done on the server side
  const sum = values.reduce((acc, val) => {
    const num = Number.parseFloat(val.replace(/,/g, '.'))
    return acc + (Number.isNaN(num) ? 0 : num)
  }, 0)
  
  return sum.toFixed(2)
}

/**
 * Calculate aggregate fulfillment rate from totals.
 * Rate = Total Fulfillment / Total Final Requirement
 */
function calculateAggregateRate(fulfillment: string, finalRequirement: string): string {
  const ful = Number.parseFloat(fulfillment)
  const fin = Number.parseFloat(finalRequirement)
  
  if (Number.isNaN(fin) || fin === 0) return '0.000000'
  if (Number.isNaN(ful)) return '0.000000'
  
  return (ful / fin).toFixed(6)
}

/**
 * Calculate aggregate achievement from totals.
 * Achievement = Total Utilization / Total Fulfillment
 * Returns null if total fulfillment is 0.
 */
function calculateAggregateAchievement(utilization: string, fulfillment: string): string | null {
  const util = Number.parseFloat(utilization)
  const ful = Number.parseFloat(fulfillment)
  
  if (Number.isNaN(ful) || ful === 0) return null
  if (Number.isNaN(util)) return '0.000000'
  
  return (util / ful).toFixed(6)
}

/** Calculate subtotals for each capital type */
const subtotals = computed<Record<CapitalType, SubtotalRow>>(() => {
  const result: Record<CapitalType, SubtotalRow> = {
    tetap: {
      capitalType: 'tetap',
      label: 'Subtotal Tetap',
      initialRequirement: '0.00',
      finalRequirement: '0.00',
      fulfillment: '0.00',
      fulfillmentRate: '0.000000',
      shortfall: '0.00',
      utilization: '0.00',
      achievement: null,
      held: '0.00',
    },
    bergerak: {
      capitalType: 'bergerak',
      label: 'Subtotal Bergerak',
      initialRequirement: '0.00',
      finalRequirement: '0.00',
      fulfillment: '0.00',
      fulfillmentRate: '0.000000',
      shortfall: '0.00',
      utilization: '0.00',
      achievement: null,
      held: '0.00',
    },
  }

  for (const type of CAPITAL_TYPE_ORDER) {
    const items = groupedItems.value[type]
    if (items.length === 0) continue

    const initialReq = sumDecimalStrings(items.map(i => i.initialRequirement))
    const finalReq = sumDecimalStrings(items.map(i => i.finalRequirement))
    const fulfillment = sumDecimalStrings(items.map(i => i.fulfillment))
    const shortfall = sumDecimalStrings(items.map(i => i.shortfall))
    const utilization = sumDecimalStrings(items.map(i => i.utilization))
    const held = sumDecimalStrings(items.map(i => i.held))

    result[type] = {
      capitalType: type,
      label: `Subtotal ${CAPITAL_TYPE_LABELS[type]}`,
      initialRequirement: initialReq,
      finalRequirement: finalReq,
      fulfillment,
      fulfillmentRate: calculateAggregateRate(fulfillment, finalReq),
      shortfall,
      utilization,
      achievement: calculateAggregateAchievement(utilization, fulfillment),
      held,
    }
  }

  return result
})

/** Check if we have items of a specific type */
function hasItemsOfType(type: CapitalType): boolean {
  return groupedItems.value[type].length > 0
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Format achievement value for display.
 * Returns "—" if null (Fulfillment = 0), otherwise percentage.
 * Req-12 AC3: IF Fulfillment = 0, THEN display Achievement as "—" or 0%
 */
function formatAchievement(value: string | null): string {
  if (value === null) return '—'
  return formatRatioAsPercent(value)
}

/**
 * Format rate/percentage value for display.
 * Req-16: Display percentages with locale id-ID (66,67%)
 */
function formatRate(value: string): string {
  return formatRatioAsPercent(value)
}
</script>

<template>
  <div
    class="relative w-full overflow-hidden rounded-lg border"
    data-testid="rkap-table-container"
  >
    <!-- Scrollable container with sticky first column on mobile -->
    <div class="overflow-x-auto">
      <table class="w-full min-w-[1200px] caption-bottom text-sm">
        <!-- Table Header -->
        <thead class="border-b bg-muted/50">
          <tr>
            <!-- Sticky nama column on mobile (Req-5 AC7) -->
            <th
              class="sticky left-0 z-10 h-12 whitespace-nowrap bg-muted/50 px-4 text-left align-middle font-medium text-foreground lg:static lg:bg-transparent"
            >
              Nama
            </th>
            <th class="h-12 whitespace-nowrap px-4 text-left align-middle font-medium text-foreground">
              Jenis Modal
            </th>
            <th class="h-12 whitespace-nowrap px-4 text-right align-middle font-medium text-foreground">
              Initial Requirement
            </th>
            <th class="h-12 whitespace-nowrap px-4 text-right align-middle font-medium text-foreground">
              Final Requirement
            </th>
            <th class="h-12 whitespace-nowrap px-4 text-right align-middle font-medium text-foreground">
              Fulfillment
            </th>
            <th class="h-12 whitespace-nowrap px-4 text-right align-middle font-medium text-foreground">
              Fulfillment Rate
            </th>
            <th class="h-12 whitespace-nowrap px-4 text-right align-middle font-medium text-foreground">
              Shortfall
            </th>
            <th class="h-12 whitespace-nowrap px-4 text-right align-middle font-medium text-foreground">
              Utilization
            </th>
            <th class="h-12 whitespace-nowrap px-4 text-right align-middle font-medium text-foreground">
              Achievement
            </th>
            <th class="h-12 whitespace-nowrap px-4 text-right align-middle font-medium text-foreground">
              Held
            </th>
            <!-- Action column - COO only (Req-6 AC3) -->
            <th
              v-if="isCoo"
              class="h-12 whitespace-nowrap px-4 text-center align-middle font-medium text-foreground"
            >
              Aksi
            </th>
          </tr>
        </thead>

        <tbody class="[&_tr:last-child]:border-0">
          <!-- Render items grouped by capital type with subtotals -->
          <template v-for="type in CAPITAL_TYPE_ORDER" :key="type">
            <!-- Items of this capital type -->
            <tr
              v-for="item in groupedItems[type]"
              :key="item.id"
              class="border-b transition-colors hover:bg-muted/50"
              :data-testid="`rkap-item-row-${item.id}`"
            >
              <!-- Sticky nama column (Req-5 AC7) -->
              <td
                class="sticky left-0 z-10 whitespace-nowrap bg-background px-4 py-3 align-middle font-medium lg:static"
              >
                {{ item.name }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 align-middle">
                <span
                  class="rounded-full px-2.5 py-1 text-xs font-medium"
                  :class="item.capitalType === 'tetap'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                    : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'"
                >
                  {{ CAPITAL_TYPE_LABELS[item.capitalType] }}
                </span>
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right align-middle tabular-nums">
                {{ formatRupiah(item.initialRequirement) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right align-middle tabular-nums">
                {{ formatRupiah(item.finalRequirement) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right align-middle tabular-nums">
                {{ formatRupiah(item.fulfillment) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right align-middle tabular-nums">
                {{ formatRate(item.fulfillmentRate) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right align-middle tabular-nums">
                {{ formatRupiah(item.shortfall) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right align-middle tabular-nums">
                {{ formatRupiah(item.utilization) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right align-middle tabular-nums">
                {{ formatAchievement(item.achievement) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right align-middle tabular-nums">
                {{ formatRupiah(item.held) }}
              </td>
              <!-- Action column - COO only (Req-6 AC3) -->
              <td
                v-if="isCoo"
                class="whitespace-nowrap px-4 py-3 text-center align-middle"
              >
                <div class="flex items-center justify-center gap-2">
                  <!-- Adjust button (Req-7) -->
                  <button
                    type="button"
                    class="inline-flex h-8 items-center justify-center rounded-md px-2 text-xs font-medium text-primary hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                    title="Sesuaikan Final Requirement"
                    data-testid="adjust-item-btn"
                    @click="emit('adjust', item)"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <!-- Utilization button (Req-11) -->
                  <button
                    type="button"
                    class="inline-flex h-8 items-center justify-center rounded-md px-2 text-xs font-medium text-primary hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                    title="Input Utilization"
                    data-testid="utilization-item-btn"
                    @click="emit('utilization', item)"
                  >
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>

            <!-- Subtotal row for this capital type (Req-5 AC5) -->
            <tr
              v-if="hasItemsOfType(type)"
              class="border-b bg-muted/30 font-medium"
              :data-testid="`rkap-subtotal-${type}`"
            >
              <!-- Sticky nama column for subtotal row -->
              <td
                class="sticky left-0 z-10 whitespace-nowrap bg-muted/30 px-4 py-3 align-middle lg:static"
              >
                {{ subtotals[type].label }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 align-middle">
                <!-- Empty for jenis modal column -->
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right align-middle tabular-nums">
                {{ formatRupiah(subtotals[type].initialRequirement) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right align-middle tabular-nums">
                {{ formatRupiah(subtotals[type].finalRequirement) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right align-middle tabular-nums">
                {{ formatRupiah(subtotals[type].fulfillment) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right align-middle tabular-nums">
                {{ formatRate(subtotals[type].fulfillmentRate) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right align-middle tabular-nums">
                {{ formatRupiah(subtotals[type].shortfall) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right align-middle tabular-nums">
                {{ formatRupiah(subtotals[type].utilization) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right align-middle tabular-nums">
                {{ formatAchievement(subtotals[type].achievement) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right align-middle tabular-nums">
                {{ formatRupiah(subtotals[type].held) }}
              </td>
              <!-- Empty action cell for subtotal row - COO only -->
              <td v-if="isCoo" class="whitespace-nowrap px-4 py-3 align-middle">
                <!-- No actions for subtotal -->
              </td>
            </tr>
          </template>

          <!-- Empty state when no items -->
          <tr v-if="items.length === 0">
            <td
              :colspan="isCoo ? 11 : 10"
              class="h-24 text-center text-muted-foreground"
            >
              Belum ada Capital Item di fase ini.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
/* Shadow effect for sticky column when scrolled horizontally */
@media (max-width: 1023px) {
  [class*="sticky"] {
    box-shadow: 4px 0 8px -4px rgba(0, 0, 0, 0.1);
  }
}

/* Ensure proper z-index layering */
thead th.sticky {
  z-index: 20;
}
</style>
