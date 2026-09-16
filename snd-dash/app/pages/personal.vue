<script setup lang="ts">
// app/pages/personal.vue
//
definePageMeta({ layout: 'dashboard' })
//
// Halaman Personal (§22.7, §4.8) — permukaan yang SELALU terbuka bagi Owner,
// dan menjadi TUJUAN REDIRECT saat Owner tanpa saham / Keluar mencoba mengakses
// permukaan terkunci (§15.7/§22.10). Server memetakan REDIRECT_PERSONAL → /personal.
//
// Isi (design.md B.7):
//   - Profile ringkas Owner.
//   - Portofolio: daftar Pesanan Pembelian milik sendiri (GET /api/orders/mine,
//     §15.4/§19.7) dengan status + Harga Terkunci (string apa adanya, AD-10).
//     Pesanan pending kanonik dapat DITARIK (POST /api/orders/withdraw, §19.3).
//   - Buat pesanan: tautan ke Form Pesanan (/pesanan).
//
// Banner pembuka akses ditampilkan bila datang dari redirect permukaan terkunci
// (query ?redirect=1) — menegaskan transparansi penuh terbuka pasca Pembelian
// Pertama efektif.

import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

interface BuyOrder {
  id: string
  capitalType: string
  quantity: number
  lockedPrice: string
  status: 'menunggu_konfirmasi' | 'terkonfirmasi' | 'ditolak' | 'kedaluwarsa'
  withdrawnAt: string | null
  submittedAt: string
}

interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

const route = useRoute()
const showRedirectBanner = computed(() => route.query.redirect === '1')

const orders = ref<BuyOrder[]>([])
const loading = ref(false)
const loadError = ref<ApiError | null>(null)
const withdrawingId = ref<string | null>(null)
const actionMessage = ref<string | null>(null)

const STATUS_LABEL: Record<BuyOrder['status'], string> = {
  menunggu_konfirmasi: 'Menunggu Konfirmasi',
  terkonfirmasi: 'Terkonfirmasi',
  ditolak: 'Ditolak',
  kedaluwarsa: 'Kedaluwarsa',
}

// Pending kanonik (AD-2): menunggu_konfirmasi DAN belum ditarik → dapat ditarik.
function isCanonicalPending(o: BuyOrder): boolean {
  return o.status === 'menunggu_konfirmasi' && o.withdrawnAt === null
}

async function loadOrders() {
  loading.value = true
  loadError.value = null
  try {
    const res = await $fetch<{ data?: BuyOrder[] } | ApiError>('/api/orders/mine')
    if (res && 'code' in res) {
      loadError.value = res
      orders.value = []
      return
    }
    orders.value = res?.data ?? []
  } catch (err) {
    const anyErr = err as { data?: ApiError; message?: string }
    loadError.value = anyErr?.data ?? { code: 'INTERNAL', message: anyErr?.message ?? 'Gagal memuat pesanan.' }
    orders.value = []
  } finally {
    loading.value = false
  }
}

async function withdraw(order: BuyOrder) {
  withdrawingId.value = order.id
  actionMessage.value = null
  try {
    const res = await $fetch<{ data?: { ok: boolean } } | ApiError>('/api/orders/withdraw', {
      method: 'POST',
      body: { orderId: order.id },
    })
    if (res && 'code' in res) {
      actionMessage.value = res.message
      return
    }
    actionMessage.value = 'Pesanan berhasil ditarik.'
    await loadOrders()
  } catch (err) {
    const anyErr = err as { data?: ApiError; message?: string }
    actionMessage.value = anyErr?.data?.message ?? anyErr?.message ?? 'Gagal menarik pesanan.'
  } finally {
    withdrawingId.value = null
  }
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
}

onMounted(loadOrders)
</script>

<template>
  <main class="personal-page">
    <header class="page-head">
      <h1>Halaman Personal</h1>
      <p>Profil, portofolio pesanan, dan pengajuan Pesanan Pembelian Anda.</p>
    </header>

    <div v-if="showRedirectBanner" class="alert info">
      Transparansi penuh terbuka setelah Pembelian Pertama Anda efektif.
    </div>

    <section class="card profile">
      <h2>Profil</h2>
      <p class="muted">
        Ringkasan profil Anda ditampilkan di sini. Lengkapi profil pada halaman
        pendaftaran bila belum lengkap.
      </p>
    </section>

    <section class="card">
      <div class="card-head">
        <h2>Portofolio Pesanan</h2>
        <NuxtLink to="/pesanan" class="btn primary sm">Buat Pesanan</NuxtLink>
      </div>

      <div v-if="actionMessage" class="alert info">{{ actionMessage }}</div>

      <p v-if="loading" class="muted">Memuat pesanan…</p>
      <div v-else-if="loadError" class="alert error">{{ loadError.message }}</div>
      <p v-else-if="orders.length === 0" class="muted">
        Belum ada pesanan. Klik "Buat Pesanan" untuk mengajukan.
      </p>

      <table v-else class="orders-table">
        <thead>
          <tr>
            <th>Jenis Modal</th>
            <th class="num">Quantity</th>
            <th class="num">Harga Terkunci</th>
            <th>Status</th>
            <th>Diajukan</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in orders" :key="o.id">
            <td>{{ o.capitalType }}</td>
            <td class="num">{{ o.quantity }}</td>
            <td class="num mono">{{ o.lockedPrice }}</td>
            <td>
              <span class="status" :class="o.withdrawnAt ? 'withdrawn' : o.status">
                {{ o.withdrawnAt ? 'Ditarik' : STATUS_LABEL[o.status] }}
              </span>
            </td>
            <td>{{ formatWhen(o.submittedAt) }}</td>
            <td>
              <button
                v-if="isCanonicalPending(o)"
                type="button"
                class="btn ghost sm"
                :disabled="withdrawingId === o.id"
                @click="withdraw(o)"
              >
                <span v-if="withdrawingId === o.id">Menarik…</span>
                <span v-else>Tarik</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
</template>

<style scoped>
.personal-page {
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
.card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 1rem 1.1rem;
  margin-bottom: 1rem;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.card h2 {
  margin: 0 0 0.5rem;
  font-size: 1.05rem;
}
.card-head h2 {
  margin: 0;
}
.muted {
  color: #64748b;
  font-size: 0.85rem;
}
.orders-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}
.orders-table th,
.orders-table td {
  text-align: left;
  padding: 0.5rem;
  border-bottom: 1px solid #e2e8f0;
}
.orders-table th.num,
.orders-table td.num {
  text-align: right;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.status {
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: #f1f5f9;
  color: #334155;
}
.status.menunggu_konfirmasi {
  background: #fef9c3;
  color: #854d0e;
}
.status.terkonfirmasi {
  background: #dcfce7;
  color: #166534;
}
.status.ditolak {
  background: #fee2e2;
  color: #991b1b;
}
.status.kedaluwarsa {
  background: #e2e8f0;
  color: #475569;
}
.status.withdrawn {
  background: #e2e8f0;
  color: #64748b;
}
.btn {
  padding: 0.5rem 0.9rem;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  text-decoration: none;
  display: inline-block;
}
.btn.sm {
  padding: 0.35rem 0.7rem;
}
.btn.primary {
  background: #2563eb;
  color: #fff;
}
.btn.ghost {
  background: #fff;
  border: 1px solid #cbd5e1;
  color: #334155;
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
.alert.info {
  background: #eff6ff;
  color: #1e40af;
  border: 1px solid #bfdbfe;
}
.alert.error {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}
</style>
