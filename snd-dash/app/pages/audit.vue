<script setup lang="ts">
// app/pages/audit.vue
//
definePageMeta({ layout: 'dashboard' })
//
// FR-12 (§12.4) — Audit trail (COO-only). Permukaan 'audit_trail' bersifat
// COO-only DAN terkunci bagi Owner tanpa saham (matriks keterbukaan §4.8).
// Server (assertSurfaceAccess 'audit_trail') tetap otoritas; non-COO menerima
// 403 dan halaman menampilkan pesannya. Audit bersifat append-only (AD-3) —
// halaman hanya membaca.
//
// Route: GET /api/audit/list?actor&action&from&to&limit

import { apiGet, formatDateTime } from '../composables/useApi'

interface AuditLog {
  id: string
  actor: string | null
  action: string
  target: string | null
  details: Record<string, unknown>
  createdAt: string
}

const filter = reactive({ actor: '', action: '', from: '', to: '', limit: '100' })
const logs = ref<AuditLog[]>([])
const errorMsg = ref<string | null>(null)
const loading = ref(false)

async function load() {
  loading.value = true
  errorMsg.value = null
  const query: Record<string, string> = {}
  if (filter.actor.trim()) query.actor = filter.actor.trim()
  if (filter.action.trim()) query.action = filter.action.trim()
  if (filter.from.trim()) query.from = filter.from.trim()
  if (filter.to.trim()) query.to = filter.to.trim()
  if (filter.limit.trim()) query.limit = filter.limit.trim()
  const res = await apiGet<AuditLog[]>('/api/audit/list', query)
  if (res.error) { errorMsg.value = res.error.message; logs.value = [] }
  else logs.value = res.data ?? []
  loading.value = false
}

function detailsPreview(details: Record<string, unknown>): string {
  try {
    const s = JSON.stringify(details)
    return s.length > 120 ? `${s.slice(0, 120)}…` : s
  } catch {
    return ''
  }
}

onMounted(load)
</script>

<template>
  <main class="page">
    <header class="page-head">
      <h1>Audit Trail</h1>
      <p class="sub">Catatan aksi append-only (COO-only). Terbaru lebih dulu.</p>
    </header>

    <section class="card">
      <h2>Filter</h2>
      <form class="form" @submit.prevent="load">
        <label>Actor (uuid)<input v-model="filter.actor" /></label>
        <label>Action<input v-model="filter.action" placeholder="mis. order_confirmed" /></label>
        <label>Dari (ISO)<input v-model="filter.from" placeholder="2026-01-01" /></label>
        <label>Sampai (ISO)<input v-model="filter.to" placeholder="2026-12-31" /></label>
        <label>Limit<input v-model="filter.limit" inputmode="numeric" /></label>
        <div class="actions"><button type="submit" :disabled="loading">{{ loading ? 'Memuat…' : 'Terapkan filter' }}</button></div>
      </form>
    </section>

    <p v-if="errorMsg" class="error" role="alert">Tidak dapat memuat audit: {{ errorMsg }}</p>

    <section class="card wide">
      <h2>Entri ({{ logs.length }})</h2>
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Waktu</th><th>Actor</th><th>Action</th><th>Target</th><th>Detail</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in logs" :key="row.id">
              <td>{{ formatDateTime(row.createdAt) }}</td>
              <td class="mono small">{{ row.actor ?? 'system' }}</td>
              <td><code>{{ row.action }}</code></td>
              <td class="mono small">{{ row.target ?? '—' }}</td>
              <td class="mono small detail">{{ detailsPreview(row.details) }}</td>
            </tr>
            <tr v-if="!logs.length && !loading"><td colspan="5" class="muted">Tidak ada entri audit.</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>

<style scoped>
.page { max-width: 1200px; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
.page-head h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
.sub { color: #555; margin: 0 0 1rem; }
.card { border: 1px solid #e5e5e5; border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 1.25rem; background: #fff; }
.card h2 { font-size: 1.05rem; margin: 0 0 .75rem; }
.form { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: .75rem; align-items: end; }
.form label { display: flex; flex-direction: column; gap: .25rem; font-size: .85rem; }
.form .actions { grid-column: 1 / -1; }
input, button { padding: .5rem .6rem; border: 1px solid #ccc; border-radius: 6px; background: #fff; font: inherit; }
button { cursor: pointer; background: #0a58ca; color: #fff; border-color: #0a58ca; }
button:disabled { opacity: .6; cursor: default; }
.table-scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: .88rem; }
th, td { text-align: left; padding: .45rem .55rem; border-bottom: 1px solid #eee; vertical-align: top; }
code { background: #f3f3f3; padding: .1rem .35rem; border-radius: 4px; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.small { font-size: .8rem; color: #666; }
.detail { max-width: 360px; white-space: normal; word-break: break-word; }
.muted { color: #888; }
.error { color: #b00020; background: #fdecef; padding: .6rem .8rem; border-radius: 6px; }
</style>
