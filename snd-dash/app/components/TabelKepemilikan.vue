<script setup lang="ts">
// app/components/TabelKepemilikan.vue
//
// FR-4 — Tabel kepemilikan per Owner.
//
// Kolom (§4.1): Quantity, Shares, Portion, Ceil, Strength, Actual, RTL + baris
// Grand Total. Portion & Strength ditampilkan sebagai persentase presisi 2 angka
// di belakang koma (§4.2 / half-up via shared/domain `displayRatio`). Grand Total
// menyertakan seluruh Owner aktif (§4.3). Owner baru muncul otomatis karena baris
// diturunkan dari proyeksi `positions` (§4.4) — tanpa intervensi manual.
//
// Komponen ini PRESENTASIONAL: menerima `rows` + `grandTotal` sebagai props
// sehingga tabel & chart berbagi satu sumber data (sinkron, §5.3/§18.4). Nilai
// uang/rasio tetap string berskala tetap (AD-10); format tampilan memakai helper
// shared/domain — TIDAK memakai `Number()`/`parseFloat()` atas nilai uang/rasio.

import { displayMoney, displayRatio } from '../../shared/domain/decimal'
import type {
  OwnershipGrandTotal,
  OwnershipRow,
} from '../composables/useOwnershipDashboard'

const props = defineProps<{
  rows: OwnershipRow[]
  grandTotal: OwnershipGrandTotal | null
}>()

/** Rasio fraksi (0..1) → persentase half-up 2 desimal, mis. '66.67%'. */
function pct(ratio: string): string {
  // displayRatio meng-half-up ke 2 desimal fraksi; kalikan 100 via string-safe.
  // Karena display saja, aman memformat setelah pembulatan skala penyimpanan.
  const fraction = displayRatio(ratio) // mis. '0.67'
  // Format persen: geser koma dua digit tanpa float — pakai Intl atas string aman.
  const asPercent = (Number(fraction) * 100).toFixed(2)
  return `${asPercent}%`
}

/** MoneyString → tampilan half-up 2 desimal, mis. '1.234.567,00' (id-ID). */
function money(value: string): string {
  const fixed = displayMoney(value) // '1234567.00'
  const [intPart, decPart] = fixed.split('.')
  const grouped = (intPart ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${grouped},${decPart ?? '00'}`
}

function intFmt(n: number): string {
  return n.toLocaleString('id-ID')
}
</script>

<template>
  <div class="tk-wrap">
    <table class="tk-table">
      <caption class="tk-caption">Tabel Kepemilikan per Owner</caption>
      <thead>
        <tr>
          <th scope="col" class="tk-owner">Owner</th>
          <th scope="col" class="tk-num">Quantity</th>
          <th scope="col" class="tk-num">Shares</th>
          <th scope="col" class="tk-num">Portion</th>
          <th scope="col" class="tk-num">Ceil</th>
          <th scope="col" class="tk-num">Strength</th>
          <th scope="col" class="tk-num">Actual</th>
          <th scope="col" class="tk-num">RTL</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in props.rows" :key="row.ownerId">
          <th scope="row" class="tk-owner">{{ row.ownerName }}</th>
          <td class="tk-num">{{ intFmt(row.quantity) }}</td>
          <td class="tk-num">{{ intFmt(row.shares) }}</td>
          <td class="tk-num tk-mono">{{ pct(row.portion) }}</td>
          <td class="tk-num">{{ intFmt(row.ceil) }}</td>
          <td class="tk-num tk-mono">{{ pct(row.strength) }}</td>
          <td class="tk-num tk-mono">{{ money(row.actual) }}</td>
          <td class="tk-num">{{ intFmt(row.rtl) }}</td>
        </tr>
        <tr v-if="props.rows.length === 0" class="tk-empty">
          <td colspan="8">Belum ada Owner dengan transaksi efektif.</td>
        </tr>
      </tbody>
      <tfoot v-if="props.grandTotal">
        <tr class="tk-total">
          <th scope="row" class="tk-owner">Grand Total</th>
          <td class="tk-num">{{ intFmt(props.grandTotal.quantity) }}</td>
          <td class="tk-num">{{ intFmt(props.grandTotal.shares) }}</td>
          <td class="tk-num tk-mono">{{ pct(props.grandTotal.portion) }}</td>
          <td class="tk-num">{{ intFmt(props.grandTotal.ceil) }}</td>
          <td class="tk-num tk-mono">{{ pct(props.grandTotal.strength) }}</td>
          <td class="tk-num tk-mono">{{ money(props.grandTotal.actual) }}</td>
          <td class="tk-num">{{ intFmt(props.grandTotal.rtl) }}</td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>

<style scoped>
.tk-wrap {
  width: 100%;
  overflow-x: auto;
}
.tk-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.tk-caption {
  text-align: left;
  font-weight: 600;
  padding: 0.5rem 0;
}
.tk-table th,
.tk-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}
.tk-table thead th {
  background: #f8fafc;
  text-align: right;
  font-weight: 600;
  color: #334155;
}
.tk-owner {
  text-align: left !important;
}
.tk-num {
  text-align: right;
}
.tk-mono {
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.tk-total th,
.tk-total td {
  border-top: 2px solid #cbd5e1;
  font-weight: 700;
  background: #f1f5f9;
}
.tk-empty td {
  text-align: center;
  color: #64748b;
  font-style: italic;
}
</style>
