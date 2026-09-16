<script setup lang="ts">
// app/pages/antrian.vue
//
definePageMeta({ layout: 'dashboard' })
//
// Halaman Antrian Beli — tampilan COO (FR-19 §19.6, §15.2/§15.3).
//
// - COO-only: memanggil GET /api/orders/queue (server menegakkan queue_coo;
//   Owner biasa → 403). Bila 403, halaman menampilkan pesan akses tanpa data.
// - Menampilkan seluruh Pesanan Pembelian pending kanonik (terlama dulu) dengan
//   nama/email pemilik, Jenis Modal, Quantity, Harga Terkunci (string apa adanya,
//   AD-10), dan waktu pengajuan.
// - Finalisasi konfirmasi (FR-20) memerlukan MFA: membuka <DialogMfa> untuk aksi
//   'konfirmasi' terikat orderId; setelah OTP dimasukkan, POST /api/ledger/confirm
//   dengan kode + detail pembayaran. Penolakan re-validasi menampilkan pesan
//   berkode dari server (Alert Penolakan Terhitung).

import { computed, onMounted, reactive, ref } from 'vue'

interface QueueRow {
  orderId: string
  ownerId: string
  ownerName: string | null
  ownerEmail: string
  capitalType: string
  quantity: number
  lockedPrice: string
  submittedAt: string
}

interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

const rows = ref<QueueRow[]>([])
const loading = ref(false)
const loadError = ref<ApiError | null>(null)

// State dialog konfirmasi.
const mfaOpen = ref(false)
const activeOrder = ref<QueueRow | null>(null)
const confirmBusy = ref(false)
const confirmError = ref<string | null>(null)
const confirmSuccess = ref<string | null>(null)

// Detail pembayaran yang dikumpulkan sebelum finalisasi.
const payment = reactive<{ paymentDate: string; paymentMethod: string }>({
  paymentDate: '',
  paymentMethod: 'transfer',
})

const canOpenConfirm = computed(() => payment.paymentDate.length > 0 && payment.paymentMethod.length > 0)

async function loadQueue() {
  loading.value = true
  loadError.value = null
  try {
    const res = await $fetch<{ data?: QueueRow[] } | ApiError>('/api/orders/queue')
    if (res && 'code' in res) {
      loadError.value = res
      rows.value = []
      return
    }
    rows.value = res?.data ?? []
  } catch (err) {
    const anyErr = err as { data?: ApiError; message?: string }
    loadError.value = anyErr?.data ?? { code: 'INTERNAL', message: anyErr?.message ?? 'Gagal memuat antrian.' }
    rows.value = []
  } finally {
    loading.value = false
  }
}

function openConfirm(row: QueueRow) {
  activeOrder.value = row
  confirmError.value = null
  confirmSuccess.value = null
  mfaOpen.value = true
}

async function onMfaSubmit(code: string) {
  if (!activeOrder.value) return
  confirmBusy.value = true
  confirmError.value = null
  try {
    const res = await $fetch<{ data?: unknown } | ApiError>('/api/ledger/confirm', {
      method: 'POST',
      body: {
        orderId: activeOrder.value.orderId,
        code,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
      },
    })
    if (res && 'code' in res) {
      // Penolakan re-validasi / OTP salah → tampilkan pesan berkode (tetap di dialog).
      confirmError.value = res.message
      return
    }
    confirmSuccess.value = `Pesanan ${activeOrder.value.orderId} terkonfirmasi.`
    mfaOpen.value = false
    activeOrder.value = null
    await loadQueue()
  } catch (err) {
    const anyErr = err as { data?: ApiError; message?: string }
    confirmError.value = anyErr?.data?.message ?? anyErr?.message ?? 'Gagal mengonfirmasi pesanan.'
  } finally {
    confirmBusy.value = false
  }
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
}

const isForbidden = computed(() => loadError.value?.code === 'FORBIDDEN' || loadError.value?.code === 'UNAUTHENTICATED')

onMounted(loadQueue)
</script>

<template>
  <main class="antrian-page">
    <header class="page-head">
      <h1>Antrian Beli</h1>
      <p>Pesanan Pembelian menunggu konfirmasi COO, terurut dari yang terlama.</p>
    </header>

    <div v-if="loading" class="notice">Memuat antrian…</div>

    <div v-else-if="isForbidden" class="alert error">
      Halaman ini hanya untuk COO yang bertugas.
    </div>

    <div v-else-if="loadError" class="alert error">{{ loadError.message }}</div>

    <div v-else>
      <div v-if="confirmSuccess" class="alert success">{{ confirmSuccess }}</div>

      <section class="payment-box">
        <h2>Detail Pembayaran</h2>
        <p class="hint">Isi sebelum mengonfirmasi. Berlaku untuk pesanan yang dikonfirmasi.</p>
        <div class="payment-fields">
          <label class="field">
            <span>Tanggal Pembayaran</span>
            <input v-model="payment.paymentDate" type="date" />
          </label>
          <label class="field">
            <span>Metode</span>
            <input v-model="payment.paymentMethod" type="text" placeholder="transfer / tunai" />
          </label>
        </div>
      </section>

      <p v-if="rows.length === 0" class="notice">Tidak ada pesanan menunggu konfirmasi.</p>

      <table v-else class="queue-table">
        <thead>
          <tr>
            <th>Owner</th>
            <th>Jenis Modal</th>
            <th class="num">Quantity</th>
            <th class="num">Harga Terkunci</th>
            <th>Diajukan</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.orderId">
            <td>
              <div class="owner-name">{{ row.ownerName ?? '—' }}</div>
              <div class="owner-email">{{ row.ownerEmail }}</div>
            </td>
            <td>{{ row.capitalType }}</td>
            <td class="num">{{ row.quantity }}</td>
            <td class="num mono">{{ row.lockedPrice }}</td>
            <td>{{ formatWhen(row.submittedAt) }}</td>
            <td>
              <button
                type="button"
                class="btn primary sm"
                :disabled="!canOpenConfirm"
                :title="canOpenConfirm ? '' : 'Isi detail pembayaran dahulu'"
                @click="openConfirm(row)"
              >
                Konfirmasi
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <DialogMfa
      v-model:open="mfaOpen"
      action-type="konfirmasi"
      :target-ref="activeOrder?.orderId ?? ''"
      :busy="confirmBusy"
      :error-message="confirmError"
      @submit="onMfaSubmit"
    />
  </main>
</template>

<style scoped>
.antrian-page {
  max-width: 1000px;
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
.notice {
  color: #475569;
  font-size: 0.9rem;
  padding: 0.75rem 0;
}
.payment-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.9rem 1rem;
  margin-bottom: 1rem;
}
.payment-box h2 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
}
.payment-box .hint {
  margin: 0 0 0.6rem;
  color: #64748b;
  font-size: 0.78rem;
}
.payment-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.85rem;
}
.field input {
  padding: 0.5rem 0.6rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
}
.queue-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}
.queue-table th,
.queue-table td {
  text-align: left;
  padding: 0.55rem 0.5rem;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: top;
}
.queue-table th.num,
.queue-table td.num {
  text-align: right;
}
.owner-name {
  font-weight: 600;
}
.owner-email {
  color: #64748b;
  font-size: 0.78rem;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.btn {
  padding: 0.5rem 0.9rem;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
}
.btn.sm {
  padding: 0.35rem 0.7rem;
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
  margin-bottom: 1rem;
}
.alert.error {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}
.alert.success {
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
}
</style>
