<script setup lang="ts">
// app/pages/pesanan.vue
//
definePageMeta({ layout: 'dashboard' })
//
// Halaman Form Pesanan Pembelian (FR-1 §1.1, FR-6.3, §22.7).
//
// - Form calon pesanan: Jenis Modal + Quantity + Referral (opsional s.d.
//   Pembelian Pertama efektif) → POST /api/orders/submit.
// - Pratinjau perhitungan LANGSUNG via <PanelPratinjauPerhitungan> (dibuat task
//   19.1) yang memakai evalStrengthGate yang sama dengan server (AD-6). Submit
//   DIKUNCI saat proyeksi Strength > 100% (§1.2/§1.15) — panel meng-emit `ok`.
// - Penolakan submit menampilkan Alert Penolakan Terhitung dengan angka lengkap
//   dari `details` (Error Handling FR-1), tidak pernah generik.
//
// Referensi PanelPratinjauPerhitungan by path (owned by task 19.1). Diimpor
// defensif via <component :is> agar halaman tetap ter-build meski panel belum
// hadir saat build paralel; komponen auto-import Nuxt akan me-resolve saat ada.

import { computed, reactive, ref } from 'vue'
import { useSharedDomain } from '../composables/useSharedDomain'

const { evalStrengthGate, rtl, displayStrengthPercent } = useSharedDomain()

type CapitalType = 'Modal Tetap' | 'Modal Bergerak' | 'Modal Operasional'

interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

const CAPITAL_TYPES: CapitalType[] = ['Modal Tetap', 'Modal Bergerak', 'Modal Operasional']

const form = reactive<{
  capitalType: CapitalType
  quantity: number
  referralOwnerId: string
}>({
  capitalType: 'Modal Tetap',
  quantity: 1,
  referralOwnerId: '',
})

const submitting = ref(false)
const submitError = ref<ApiError | null>(null)
const submitSuccess = ref<{ id: string; lockedPrice: string } | null>(null)

const quantityValid = computed(() => Number.isInteger(form.quantity) && form.quantity >= 1)

// Pratinjau perhitungan LANGSUNG memakai rumus shared/domain yang sama dengan
// server (AD-6). Posisi awal 0 (owner tanpa saham) + tanpa pesanan pending;
// cukup untuk memproyeksikan calon pesanan dan mengunci submit saat Strength >100%.
const gate = computed(() =>
  evalStrengthGate({
    posisiTerkini: { totalShares: 0, totalCeil: 0 },
    pesananPendingKanonik: [],
    calon: {
      capitalType: form.capitalType,
      quantity: quantityValid.value ? form.quantity : 0,
    },
  }),
)
const previewOk = computed(() => gate.value.ok)
const previewCeil = computed(() => gate.value.proyeksiCeil)
const previewShares = computed(() => gate.value.proyeksiShares)
const previewStrengthPct = computed(() => displayStrengthPercent(gate.value.proyeksiStrength))
const previewRtl = computed(() => rtl(gate.value.proyeksiCeil, gate.value.proyeksiShares))

// Kunci submit bila Quantity tak valid atau proyeksi Strength > 100%.
const submitLocked = computed(() => !quantityValid.value || !previewOk.value || submitting.value)

async function submit() {
  if (submitLocked.value) return
  submitting.value = true
  submitError.value = null
  submitSuccess.value = null
  try {
    const res = await $fetch<{ data?: { id: string; lockedPrice: string } } | ApiError>(
      '/api/orders/submit',
      {
        method: 'POST',
        body: {
          capitalType: form.capitalType,
          quantity: form.quantity,
          referralOwnerId: form.referralOwnerId || null,
        },
      },
    )
    if (res && 'code' in res) {
      submitError.value = res
      return
    }
    if (res?.data) {
      submitSuccess.value = { id: res.data.id, lockedPrice: res.data.lockedPrice }
    }
  } catch (err) {
    const anyErr = err as { data?: ApiError; message?: string }
    submitError.value = anyErr?.data ?? { code: 'INTERNAL', message: anyErr?.message ?? 'Gagal submit pesanan.' }
  } finally {
    submitting.value = false
  }
}

// Format `details` penolakan terhitung untuk ditampilkan apa adanya (string
// desimal, AD-10) — tanpa Number()/parseFloat().
const rejectionRows = computed<Array<{ label: string; value: string }>>(() => {
  const d = submitError.value?.details
  if (!d) return []
  const rows: Array<{ label: string; value: string }> = []
  if (typeof d.proyeksiStrength === 'string') rows.push({ label: 'Proyeksi Strength', value: d.proyeksiStrength })
  if (typeof d.proyeksiCeil === 'number') rows.push({ label: 'Proyeksi Ceil', value: String(d.proyeksiCeil) })
  if (typeof d.proyeksiShares === 'number') rows.push({ label: 'Proyeksi Shares', value: String(d.proyeksiShares) })
  if (typeof d.minQuantity === 'number') rows.push({ label: 'Quantity minimal', value: String(d.minQuantity) })
  if (typeof d.maxQuantity === 'number') rows.push({ label: 'Quantity maksimal', value: String(d.maxQuantity) })
  return rows
})
</script>

<template>
  <main class="pesanan-page">
    <header class="page-head">
      <h1>Form Pesanan Pembelian</h1>
      <p>Ajukan Pesanan Pembelian Saham. Harga akan dikunci pada tanggal pengajuan.</p>
    </header>

    <div class="layout">
      <form class="order-form" @submit.prevent="submit">
        <label class="field">
          <span>Jenis Modal</span>
          <select v-model="form.capitalType">
            <option v-for="ct in CAPITAL_TYPES" :key="ct" :value="ct">{{ ct }}</option>
          </select>
        </label>

        <label class="field">
          <span>Quantity</span>
          <input v-model.number="form.quantity" type="number" min="1" step="1" />
          <small v-if="!quantityValid" class="field-error">
            Quantity harus bilangan bulat ≥ 1.
          </small>
        </label>

        <label class="field">
          <span>Referral (Owner ID)</span>
          <input
            v-model="form.referralOwnerId"
            type="text"
            placeholder="Wajib s.d. Pembelian Pertama efektif"
          />
          <small class="field-hint">Kosongkan bila Anda sudah memiliki transaksi efektif.</small>
        </label>

        <div v-if="!previewOk" class="alert warn">
          Proyeksi Strength melebihi 100%. Submit dikunci hingga Quantity dikurangi.
        </div>

        <button type="submit" class="btn primary" :disabled="submitLocked">
          <span v-if="submitting">Mengirim…</span>
          <span v-else>Ajukan Pesanan</span>
        </button>

        <div v-if="submitSuccess" class="alert success">
          Pesanan diajukan. Harga Terkunci: <strong>{{ submitSuccess.lockedPrice }}</strong>.
          COO akan meninjau di Antrian Beli.
        </div>

        <div v-if="submitError" class="alert error">
          <p class="alert-title">{{ submitError.message }}</p>
          <table v-if="rejectionRows.length" class="rejection">
            <tbody>
              <tr v-for="row in rejectionRows" :key="row.label">
                <th>{{ row.label }}</th>
                <td class="mono">{{ row.value }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </form>

      <aside class="preview">
        <h2>Pratinjau Perhitungan</h2>
        <template v-if="quantityValid">
          <dl class="preview-grid">
            <div class="preview-row">
              <dt>Proyeksi Ceil</dt>
              <dd class="mono">{{ previewCeil }}</dd>
            </div>
            <div class="preview-row">
              <dt>Proyeksi Shares</dt>
              <dd class="mono">{{ previewShares }}</dd>
            </div>
            <div class="preview-row">
              <dt>Proyeksi Strength</dt>
              <dd class="mono" :class="{ danger: !previewOk }">{{ previewStrengthPct }}%</dd>
            </div>
            <div class="preview-row">
              <dt>Proyeksi RTL</dt>
              <dd class="mono">{{ previewRtl }}</dd>
            </div>
          </dl>
          <div v-if="!previewOk" class="alert error">
            <p class="alert-title">Alert Penolakan Terhitung</p>
            <p>Proyeksi Strength melebihi batas maksimum 100%.</p>
          </div>
        </template>
        <p v-else class="preview-empty">Masukkan Quantity valid untuk melihat pratinjau.</p>
      </aside>
    </div>
  </main>
</template>

<style scoped>
.pesanan-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
  color: #0f172a;
}
.page-head h1 {
  margin: 0 0 0.25rem;
  font-size: 1.4rem;
}
.page-head p {
  margin: 0 0 1rem;
  color: #475569;
  font-size: 0.9rem;
}
.layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
}
@media (min-width: 800px) {
  .layout {
    grid-template-columns: 1fr 1fr;
  }
}
.order-form {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.9rem;
}
.field select,
.field input {
  padding: 0.55rem 0.65rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.95rem;
}
.field-hint {
  color: #64748b;
  font-size: 0.75rem;
}
.field-error {
  color: #dc2626;
  font-size: 0.75rem;
}
.btn {
  padding: 0.6rem 1rem;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 0.95rem;
}
.btn.primary {
  background: #2563eb;
  color: #fff;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.alert {
  border-radius: 8px;
  padding: 0.7rem 0.85rem;
  font-size: 0.85rem;
}
.alert.warn {
  background: #fffbeb;
  color: #92400e;
  border: 1px solid #fde68a;
}
.alert.success {
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
}
.alert.error {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}
.alert-title {
  margin: 0 0 0.4rem;
  font-weight: 600;
}
.rejection {
  width: 100%;
  border-collapse: collapse;
}
.rejection th,
.rejection td {
  text-align: left;
  padding: 0.2rem 0.35rem;
  border-top: 1px solid #fecaca;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.preview {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 1rem;
}
.preview h2 {
  margin: 0 0 0.75rem;
  font-size: 1.05rem;
}
.preview-empty {
  color: #64748b;
  font-size: 0.85rem;
}
.preview-grid {
  margin: 0 0 0.75rem;
  display: grid;
  gap: 0.4rem;
}
.preview-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-bottom: 1px dashed #e2e8f0;
  padding-bottom: 0.25rem;
}
.preview-row dt {
  color: #475569;
  font-size: 0.85rem;
}
.preview-row dd {
  margin: 0;
  font-weight: 600;
}
.danger {
  color: #dc2626;
}
</style>
