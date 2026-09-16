<script setup lang="ts">
// app/pages/mom.vue
//
definePageMeta({ layout: 'dashboard' })
//
// FR-7 — Minutes of Meeting (MoM) MRO/RUPS: draft → final. Permukaan 'mom'
// TERKUNCI untuk Owner tanpa saham (§4.8 / §15.7); penulisan MoM adalah wewenang
// COO. Server (assertSurfaceAccess 'mom' + requireCoo) tetap otoritas; halaman
// ini hanya menyediakan form dan menampilkan hasil.
//
// Route: POST /api/pricing/mom  body: { id?, title?, momDate?, body?, finalize? }

import { apiPost, formatDate, formatDateTime } from '../composables/useApi'

interface MomView {
  id: string
  title: string
  momDate: string
  status: 'draft' | 'final'
  body: string | null
  createdAt: string
  updatedAt: string
}

const form = reactive<{ id: string; title: string; momDate: string; body: string; finalize: boolean }>({
  id: '',
  title: '',
  momDate: '',
  body: '',
  finalize: false,
})

const saved = ref<MomView | null>(null)
const errorMsg = ref<string | null>(null)
const saving = ref(false)

async function save() {
  saving.value = true
  errorMsg.value = null
  const body: Record<string, unknown> = { finalize: form.finalize }
  if (form.id.trim()) body.id = form.id.trim()
  if (form.title.trim()) body.title = form.title.trim()
  if (form.momDate.trim()) body.momDate = form.momDate.trim()
  if (form.body.trim()) body.body = form.body
  const res = await apiPost<MomView>('/api/pricing/mom', body)
  if (res.error) errorMsg.value = res.error.message
  else {
    saved.value = res.data
    if (res.data) form.id = res.data.id
  }
  saving.value = false
}
</script>

<template>
  <main class="page">
    <header class="page-head">
      <h1>Minutes of Meeting (MoM)</h1>
      <p class="sub">Catatan rapat MRO/RUPS. Draft dapat diedit hingga difinalkan. Aksi ini hanya untuk COO bertugas.</p>
    </header>

    <section class="card">
      <h2>Simpan / Edit MoM</h2>
      <form @submit.prevent="save" class="form">
        <label>
          ID (kosongkan untuk MoM baru)
          <input v-model="form.id" placeholder="uuid MoM eksisting (opsional)" />
        </label>
        <label>
          Judul
          <input v-model="form.title" placeholder="mis. MRO 2026-Q1" />
        </label>
        <label>
          Tanggal MoM (YYYY-MM-DD)
          <input v-model="form.momDate" placeholder="2026-01-15" />
        </label>
        <label class="full">
          Isi
          <textarea v-model="form.body" rows="6" placeholder="Ringkasan keputusan rapat…" />
        </label>
        <label class="check">
          <input type="checkbox" v-model="form.finalize" />
          Finalkan (tidak dapat diedit setelah final)
        </label>
        <div class="actions">
          <button type="submit" :disabled="saving">{{ saving ? 'Menyimpan…' : 'Simpan MoM' }}</button>
        </div>
      </form>
      <p v-if="errorMsg" class="error" role="alert">{{ errorMsg }}</p>
    </section>

    <section v-if="saved" class="card">
      <h2>MoM Tersimpan <span :class="['badge', saved.status]">{{ saved.status }}</span></h2>
      <dl class="kv">
        <dt>ID</dt><dd class="mono small">{{ saved.id }}</dd>
        <dt>Judul</dt><dd>{{ saved.title }}</dd>
        <dt>Tanggal</dt><dd>{{ formatDate(saved.momDate) }}</dd>
        <dt>Diperbarui</dt><dd>{{ formatDateTime(saved.updatedAt) }}</dd>
      </dl>
      <p v-if="saved.body" class="body-text">{{ saved.body }}</p>
    </section>

    <nav class="links"><NuxtLink to="/harga">← Harga Saham</NuxtLink></nav>
  </main>
</template>

<style scoped>
.page { max-width: 800px; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
.page-head h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
.sub { color: #555; margin: 0 0 1rem; }
.card { border: 1px solid #e5e5e5; border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 1.25rem; background: #fff; }
.card h2 { font-size: 1.05rem; margin: 0 0 .75rem; }
.form { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
.form label { display: flex; flex-direction: column; gap: .25rem; font-size: .85rem; }
.form label.full, .form label.check, .form .actions { grid-column: 1 / -1; }
.form label.check { flex-direction: row; align-items: center; gap: .5rem; }
input, textarea, button { padding: .5rem .6rem; border: 1px solid #ccc; border-radius: 6px; background: #fff; font: inherit; }
button { cursor: pointer; background: #0a58ca; color: #fff; border-color: #0a58ca; }
button:disabled { opacity: .6; cursor: default; }
.badge { font-size: .7rem; padding: .1rem .5rem; border-radius: 999px; vertical-align: middle; text-transform: uppercase; }
.badge.draft { background: #fff3cd; color: #8a6d3b; }
.badge.final { background: #e6f4ea; color: #1e7e34; }
.kv { display: grid; grid-template-columns: max-content 1fr; gap: .35rem 1rem; margin: 0; }
.kv dt { color: #777; font-size: .8rem; }
.kv dd { margin: 0; }
.body-text { white-space: pre-wrap; margin-top: .75rem; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.small { font-size: .8rem; color: #666; }
.error { color: #b00020; background: #fdecef; padding: .6rem .8rem; border-radius: 6px; }
.links { margin-top: 1rem; }
.links a { color: #0a58ca; text-decoration: none; }
</style>
