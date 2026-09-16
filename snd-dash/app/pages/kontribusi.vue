<script setup lang="ts">
// app/pages/kontribusi.vue
//
definePageMeta({ layout: 'dashboard' })
//
// FR-8/FR-9 (§8.1/§9.2) — Contribution: definisi item, pencatatan realisasi,
// poin berjalan (running points) + carry-over.
//
// Keterbukaan §4.8: permukaan 'contribution' TERKUNCI untuk Owner tanpa saham /
// Keluar (§15.7). Definisi item & pencatatan realisasi adalah wewenang COO
// (requireCoo di route). Poin berjalan dapat dilihat Owner untuk dirinya; COO
// bertugas dapat melihat poin Owner lain (§15.2). Server tetap otoritas.

import { apiGet, apiPost, formatDate } from '../composables/useApi'

interface ContributionItem {
  id: string
  name: string
  description: string | null
  points: number
  periodId: string | null
  momRef: string | null
  createdAt: string
}
interface ContributionEntry {
  id: string
  ownerId: string
  itemId: string
  periodId: string
  points: number
  recordedBy: string
  recordedDate: string
  redeemed: boolean
  createdAt: string
}
interface PointsView {
  ownerId: string
  currentPeriodPoints: number
  carryOverPoints: number
  totalRunning: number
}

// --- Poin berjalan ---------------------------------------------------------
const pointsOwnerId = ref('')
const points = ref<PointsView | null>(null)
const pointsError = ref<string | null>(null)

async function loadPoints() {
  pointsError.value = null
  const query: Record<string, string> = {}
  if (pointsOwnerId.value.trim()) query.ownerId = pointsOwnerId.value.trim()
  const res = await apiGet<PointsView>('/api/contribution/points', query)
  if (res.error) { pointsError.value = res.error.message; points.value = null }
  else points.value = res.data
}

// --- Definisi item (COO) ---------------------------------------------------
const itemForm = reactive({ name: '', description: '', points: '', periodId: '', momRef: '' })
const itemResult = ref<ContributionItem | null>(null)
const itemError = ref<string | null>(null)
const itemSaving = ref(false)

async function defineItem() {
  itemSaving.value = true
  itemError.value = null
  const body: Record<string, unknown> = {
    name: itemForm.name.trim(),
    points: Number.parseInt(itemForm.points, 10),
    momRef: itemForm.momRef.trim(),
  }
  if (itemForm.description.trim()) body.description = itemForm.description.trim()
  if (itemForm.periodId.trim()) body.periodId = itemForm.periodId.trim()
  const res = await apiPost<ContributionItem>('/api/contribution/define-item', body)
  if (res.error) itemError.value = res.error.message
  else itemResult.value = res.data
  itemSaving.value = false
}

// --- Pencatatan realisasi (COO) --------------------------------------------
const recForm = reactive({ ownerId: '', itemId: '', recordedDate: '', periodId: '', points: '' })
const recResult = ref<ContributionEntry | null>(null)
const recError = ref<string | null>(null)
const recSaving = ref(false)

async function recordRealization() {
  recSaving.value = true
  recError.value = null
  const body: Record<string, unknown> = {
    ownerId: recForm.ownerId.trim(),
    itemId: recForm.itemId.trim(),
    recordedDate: recForm.recordedDate.trim(),
  }
  if (recForm.periodId.trim()) body.periodId = recForm.periodId.trim()
  if (recForm.points.trim()) body.points = Number.parseInt(recForm.points, 10)
  const res = await apiPost<ContributionEntry>('/api/contribution/record', body)
  if (res.error) recError.value = res.error.message
  else recResult.value = res.data
  recSaving.value = false
}

onMounted(loadPoints)
</script>

<template>
  <main class="page">
    <header class="page-head">
      <h1>Contribution</h1>
      <p class="sub">Item Contribution, pencatatan realisasi, dan poin berjalan (termasuk carry-over).</p>
    </header>

    <section class="card">
      <h2>Poin Berjalan</h2>
      <div class="inline">
        <label>
          Owner ID (kosongkan untuk poin Anda sendiri)
          <input v-model="pointsOwnerId" placeholder="uuid owner (opsional; COO saja)" />
        </label>
        <button type="button" @click="loadPoints">Lihat poin</button>
      </div>
      <p v-if="pointsError" class="error" role="alert">{{ pointsError }}</p>
      <div v-if="points" class="points-grid">
        <div><span class="label">Periode berjalan</span><span class="big mono">{{ points.currentPeriodPoints }}</span></div>
        <div><span class="label">Carry-over</span><span class="big mono">{{ points.carryOverPoints }}</span></div>
        <div><span class="label">Total berjalan</span><span class="big mono">{{ points.totalRunning }}</span></div>
      </div>
    </section>

    <section class="card">
      <h2>Definisi Item Contribution <span class="coo-tag">COO</span></h2>
      <form class="form" @submit.prevent="defineItem">
        <label>Nama<input v-model="itemForm.name" required /></label>
        <label>Poin<input v-model="itemForm.points" inputmode="numeric" required /></label>
        <label class="full">Deskripsi<input v-model="itemForm.description" /></label>
        <label>Period ID (opsional)<input v-model="itemForm.periodId" /></label>
        <label>MoM Ref<input v-model="itemForm.momRef" required /></label>
        <div class="actions"><button type="submit" :disabled="itemSaving">{{ itemSaving ? 'Menyimpan…' : 'Definisikan item' }}</button></div>
      </form>
      <p v-if="itemError" class="error" role="alert">{{ itemError }}</p>
      <p v-if="itemResult" class="ok">Item tersimpan: <strong>{{ itemResult.name }}</strong> ({{ itemResult.points }} poin) — <span class="mono small">{{ itemResult.id }}</span></p>
    </section>

    <section class="card">
      <h2>Catat Realisasi <span class="coo-tag">COO</span></h2>
      <form class="form" @submit.prevent="recordRealization">
        <label>Owner ID<input v-model="recForm.ownerId" required /></label>
        <label>Item ID<input v-model="recForm.itemId" required /></label>
        <label>Tanggal (YYYY-MM-DD)<input v-model="recForm.recordedDate" placeholder="2026-01-15" required /></label>
        <label>Period ID (opsional)<input v-model="recForm.periodId" /></label>
        <label>Poin (opsional; default poin item)<input v-model="recForm.points" inputmode="numeric" /></label>
        <div class="actions"><button type="submit" :disabled="recSaving">{{ recSaving ? 'Menyimpan…' : 'Catat realisasi' }}</button></div>
      </form>
      <p v-if="recError" class="error" role="alert">{{ recError }}</p>
      <p v-if="recResult" class="ok">Realisasi tercatat {{ recResult.points }} poin pada {{ formatDate(recResult.recordedDate) }} — <span class="mono small">{{ recResult.id }}</span></p>
    </section>
  </main>
</template>

<style scoped>
.page { max-width: 900px; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
.page-head h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
.sub { color: #555; margin: 0 0 1rem; }
.card { border: 1px solid #e5e5e5; border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 1.25rem; background: #fff; }
.card h2 { font-size: 1.05rem; margin: 0 0 .75rem; }
.coo-tag { font-size: .65rem; background: #eef; color: #339; padding: .1rem .45rem; border-radius: 999px; vertical-align: middle; }
.inline { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; }
.inline label { flex: 1; min-width: 220px; }
label { display: flex; flex-direction: column; gap: .25rem; font-size: .85rem; }
.form { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
.form label.full, .form .actions { grid-column: 1 / -1; }
input, button { padding: .5rem .6rem; border: 1px solid #ccc; border-radius: 6px; background: #fff; font: inherit; }
button { cursor: pointer; background: #0a58ca; color: #fff; border-color: #0a58ca; }
button:disabled { opacity: .6; cursor: default; }
.points-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: .75rem; margin-top: .75rem; }
.points-grid .label { display: block; font-size: .75rem; color: #777; }
.big { font-size: 1.6rem; font-weight: 700; }
.mono { font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.small { font-size: .8rem; color: #666; }
.error { color: #b00020; background: #fdecef; padding: .6rem .8rem; border-radius: 6px; }
.ok { color: #1e7e34; }
</style>
