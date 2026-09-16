<script setup lang="ts">
// app/components/PanelPratinjauPerhitungan.client.vue
//
// Pulau KLIEN (`.client.vue`) pratinjau perhitungan Pesanan Pembelian (FR-1
// §1.1/§1.2/§1.15). Memakai `evalStrengthGate` dari `#shared/domain/gates` —
// JALUR KODE YANG SAMA dengan validasi server (AD-6) — sehingga proyeksi
// pratinjau tidak pernah berbeda dengan hasil validasi server saat submit.
//
// Perilaku:
//  - Live preview: proyeksi Ceil/Shares/Strength/RTL berubah seketika saat
//    Jenis Modal atau Quantity berubah (§1.1). Strength sebagai persentase
//    presisi 2 angka di belakang koma; RTL sebagai bilangan bulat.
//  - Saat proyeksi Strength > 100% (§1.2): tampilkan "Alert Penolakan Terhitung"
//    dengan angka lengkap (Shares/Ceil/Strength + batas 100%) dan KUNCI tombol
//    submit.
//  - Validasi rentang Quantity (§1.15): integer, ≥ 1, ≤ maxQuantity (bila ada).
//
// Aturan (AD-10): nilai rasio/persen selalu lewat pembungkus decimal bersama;
// TANPA `Number()`/`parseFloat()` atas nilai rasio.

import { computed } from 'vue'
import { useSharedDomain } from '~/composables/useSharedDomain'
import type { CapitalType } from '#shared/domain/types'
import SndCalloutAlert from '~/components/ui/SndCalloutAlert.vue'

const { evalStrengthGate, rtl, displayStrengthPercent } = useSharedDomain()

interface PosisiTerkini {
  totalShares: number
  totalCeil: number
}

interface PendingOrder {
  capitalType: CapitalType
  quantity: number
}

const props = withDefaults(
  defineProps<{
    /** Posisi terkini owner (agregat Shares/Ceil efektif) — payload SSR bersama (AD-12). */
    posisi: PosisiTerkini
    /** Seluruh pesanan pending kanonik owner (TIDAK termasuk calon). */
    pesananPending?: PendingOrder[]
    /** Jenis modal calon yang dipilih di form pesanan. */
    capitalType: CapitalType
    /** Quantity calon yang diinput di form pesanan. */
    quantity: number
    /** Quantity maksimal berlaku (per RKAP/RTL) — `null` bila tak dihitung (§1.15). */
    maxQuantity?: number | null
  }>(),
  { pesananPending: () => [], maxQuantity: null },
)

/**
 * Validasi rentang Quantity (§1.15): harus bilangan bulat, ≥ 1, dan ≤ maxQuantity
 * bila tersedia. Mengembalikan pesan rentang yang diizinkan bila tidak valid.
 */
const quantityValidation = computed<{ valid: boolean; message: string | null }>(() => {
  const q = props.quantity
  const max = props.maxQuantity
  const batasAtas = max === null || max === undefined ? '∞' : String(max)
  const rentang = `Masukkan Quantity bilangan bulat antara 1 sampai ${batasAtas}.`

  if (!Number.isInteger(q) || q < 1) {
    return { valid: false, message: rentang }
  }
  if (max !== null && max !== undefined && q > max) {
    return { valid: false, message: rentang }
  }
  return { valid: true, message: null }
})

/**
 * Proyeksi gerbang Strength — JALUR SAMA dengan server (AD-6). Untuk quantity
 * tak valid (mis. 0/desimal saat mengetik), gunakan 0 agar proyeksi tetap
 * mencerminkan posisi + pending tanpa calon (menghindari NaN); validasi rentang
 * ditangani terpisah oleh `quantityValidation`.
 */
const gate = computed(() => {
  const q = Number.isInteger(props.quantity) && props.quantity > 0 ? props.quantity : 0
  return evalStrengthGate({
    posisiTerkini: props.posisi,
    pesananPendingKanonik: props.pesananPending,
    calon: { capitalType: props.capitalType, quantity: q },
  })
})

/** Proyeksi RTL (weighting.rtl) = Floor((Ceil − Shares) ÷ 2) — bilangan bulat (§1.1). */
const proyeksiRtl = computed(() => rtl(gate.value.proyeksiCeil, gate.value.proyeksiShares))

/** Persentase Strength presisi 2 angka di belakang koma (§1.1/§1.2). */
const strengthPersen = computed(() => displayStrengthPercent(gate.value.proyeksiStrength))

/** true bila proyeksi Strength > 100% (gerbang gagal) → Alert + kunci submit (§1.2). */
const strengthMelebihi = computed(() => !gate.value.ok)

/**
 * Tombol submit TERKUNCI bila proyeksi Strength > 100% (§1.2) ATAU Quantity di
 * luar rentang yang diizinkan (§1.15). Diekspos ke induk agar form pesanan dapat
 * menonaktifkan tombol submit-nya sendiri secara konsisten.
 */
const submitLocked = computed(() => strengthMelebihi.value || !quantityValidation.value.valid)

defineExpose({ submitLocked, gate, proyeksiRtl })
</script>

<template>
  <section class="panel" aria-label="Pratinjau perhitungan pesanan">
    <h3 class="panel__title">Pratinjau Perhitungan</h3>

    <dl class="panel__grid">
      <div class="panel__row">
        <dt>Proyeksi Ceil</dt>
        <dd class="mono">{{ gate.proyeksiCeil }}</dd>
      </div>
      <div class="panel__row">
        <dt>Proyeksi Shares</dt>
        <dd class="mono">{{ gate.proyeksiShares }}</dd>
      </div>
      <div class="panel__row">
        <dt>Proyeksi Strength</dt>
        <dd class="mono" :class="{ 'is-danger': strengthMelebihi }">{{ strengthPersen }}%</dd>
      </div>
      <div class="panel__row">
        <dt>Proyeksi RTL</dt>
        <dd class="mono">{{ proyeksiRtl }}</dd>
      </div>
    </dl>

    <!-- Validasi rentang Quantity (§1.15) -->
    <SndCalloutAlert
      v-if="!quantityValidation.valid"
      variant="warning"
      title="Quantity tidak valid"
    >
      <p>{{ quantityValidation.message }}</p>
    </SndCalloutAlert>

    <!-- Alert Penolakan Terhitung — angka lengkap (§1.2) -->
    <SndCalloutAlert
      v-if="strengthMelebihi"
      variant="danger"
      title="Alert Penolakan Terhitung"
    >
      <p>
        Proyeksi Strength melebihi batas maksimum. Pesanan tidak dapat diajukan
        hingga Strength ≤ 100%.
      </p>
      <ul class="penolakan">
        <li>Proyeksi Shares: <span class="mono">{{ gate.proyeksiShares }}</span></li>
        <li>Proyeksi Ceil: <span class="mono">{{ gate.proyeksiCeil }}</span></li>
        <li>Proyeksi Strength: <span class="mono">{{ strengthPersen }}%</span></li>
        <li>Batas maksimum: <span class="mono">100.00%</span></li>
      </ul>
    </SndCalloutAlert>

    <p v-if="submitLocked" class="panel__lock" role="status">
      Tombol submit terkunci sampai perhitungan memenuhi syarat.
    </p>
  </section>
</template>

<style scoped>
.panel {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.panel__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}
.panel__grid {
  margin: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.4rem;
}
.panel__row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-bottom: 1px dashed #e2e8f0;
  padding-bottom: 0.25rem;
}
.panel__row dt {
  color: #475569;
}
.panel__row dd {
  margin: 0;
  font-weight: 600;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.is-danger {
  color: #dc2626;
}
.penolakan {
  margin: 0.5rem 0 0;
  padding-left: 1.1rem;
}
.penolakan li {
  margin-bottom: 0.15rem;
}
.panel__lock {
  margin: 0;
  font-size: 0.85rem;
  color: #b45309;
}
</style>
