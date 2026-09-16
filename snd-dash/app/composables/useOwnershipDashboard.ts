// app/composables/useOwnershipDashboard.ts
//
// Composable pengambilan data dashboard kepemilikan (FR-4/FR-5/FR-18).
//
// Membungkus `useFetch` ke `/api/dashboard/ownership` (route TIPIS task 19.2) dan
// mengekspos tipe kontrak baris tabel + Grand Total agar tabel (TabelKepemilikan)
// dan chart (ChartPortion / ChartDistribusiPemodalan / ChartBigCap) berbagi SATU
// sumber data — sehingga chart selalu sinkron dengan tabel (§5.3/§18.4) dan Owner
// baru muncul otomatis di keduanya (§5.2/§18.5).
//
// Nilai rasio/uang tetap STRING desimal berskala tetap (AD-10); komponen
// menampilkan half-up 2 desimal via helper displayRatio/displayMoney di
// shared/domain saat render.

import type {
  CapitalType,
  MoneyString,
  RatioString,
  Uuid,
} from '../../shared/domain/types'

/** Satu baris kepemilikan per Owner (cermin kontrak server FR-4 §4.1). */
export interface OwnershipRow {
  ownerId: Uuid
  ownerName: string
  quantity: number
  shares: number
  portion: RatioString
  ceil: number
  strength: RatioString
  actual: MoneyString
  rtl: number
  sharesByType: Record<CapitalType, number>
  ceilByType: Record<CapitalType, number>
}

/** Baris Grand Total (FR-4 §4.1/§4.3). */
export interface OwnershipGrandTotal {
  quantity: number
  shares: number
  portion: RatioString
  ceil: number
  strength: RatioString
  actual: MoneyString
  rtl: number
  sharesByType: Record<CapitalType, number>
  ceilByType: Record<CapitalType, number>
}

export interface OwnershipDashboard {
  rows: OwnershipRow[]
  grandTotal: OwnershipGrandTotal
}

interface OwnershipEnvelope {
  data: OwnershipDashboard
}

/**
 * Mengambil data dashboard kepemilikan. Mengembalikan `data` (dashboard),
 * `pending`, `error`, dan `refresh` dari `useFetch` sehingga halaman dapat
 * menampilkan status muat / coba lagi (design.md Error Handling: angka basi tidak
 * pernah ditampilkan).
 */
export function useOwnershipDashboard() {
  const { data, pending, error, refresh } = useFetch<OwnershipEnvelope>(
    '/api/dashboard/ownership',
    {
      key: 'dashboard-ownership',
      // Nilai kepemilikan selalu daring (AD-12) — jangan cache stale di klien.
      server: true,
    },
  )

  const dashboard = computed<OwnershipDashboard | null>(() => data.value?.data ?? null)
  const rows = computed<OwnershipRow[]>(() => dashboard.value?.rows ?? [])
  const grandTotal = computed<OwnershipGrandTotal | null>(
    () => dashboard.value?.grandTotal ?? null,
  )

  return { dashboard, rows, grandTotal, pending, error, refresh }
}
