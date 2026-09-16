<script setup lang="ts">
// app/pages/pendaftaran.vue
//
definePageMeta({ layout: 'dashboard' })
//
// FR-22 (§22.1) — Pendaftaran: pendaftaran mandiri (self-service) + verifikasi/
// penolakan oleh COO + pergantian mandat COO (FR-17).
//
// - Pendaftaran mandiri: POST /api/identity/register (identitas = email Google
//   sesi; membuat Owner 'diajukan'). Terbuka bagi principal terautentikasi.
// - Verifikasi/penolakan: POST /api/identity/verify | /reject (COO-only,
//   permukaan 'queue_coo'). Server (requireCoo) tetap otoritas.
// - Transfer COO: POST /api/identity/transfer-coo (COO-only).

import { apiPost } from '../composables/useApi'

interface OwnerView {
  id: string
  email: string
  status: string
  firstEffectiveAt: string | null
}

// --- Pendaftaran mandiri ---------------------------------------------------
const registered = ref<OwnerView | null>(null)
const registerError = ref<string | null>(null)
const registering = ref(false)

async function register() {
  registering.value = true; registerError.value = null
  const res = await apiPost<OwnerView>('/api/identity/register', {})
  if (res.error) registerError.value = res.error.message
  else registered.value = res.data
  registering.value = false
}

// --- Verifikasi / penolakan (COO) ------------------------------------------
const verifyOwnerId = ref('')
const verifyMsg = ref<string | null>(null)
const verifyError = ref<string | null>(null)
const verifying = ref(false)

async function verify() {
  verifying.value = true; verifyMsg.value = null; verifyError.value = null
  const res = await apiPost<{ ok: boolean }>('/api/identity/verify', { ownerId: verifyOwnerId.value.trim() })
  if (res.error) verifyError.value = res.error.message
  else verifyMsg.value = 'Pendaftaran diverifikasi.'
  verifying.value = false
}

const rejectOwnerId = ref('')
const rejectReason = ref('')
const rejectMsg = ref<string | null>(null)
const rejectError = ref<string | null>(null)
const rejecting = ref(false)

async function reject() {
  rejecting.value = true; rejectMsg.value = null; rejectError.value = null
  const res = await apiPost<{ ok: boolean }>('/api/identity/reject', {
    ownerId: rejectOwnerId.value.trim(),
    reason: rejectReason.value.trim(),
  })
  if (res.error) rejectError.value = res.error.message
  else rejectMsg.value = 'Pendaftaran ditolak.'
  rejecting.value = false
}

// --- Transfer COO (FR-17) --------------------------------------------------
const toOwner = ref('')
const momRef = ref('')
const transferMsg = ref<string | null>(null)
const transferError = ref<string | null>(null)
const transferring = ref(false)

async function transferCoo() {
  transferring.value = true; transferMsg.value = null; transferError.value = null
  const res = await apiPost<{ ok: boolean }>('/api/identity/transfer-coo', {
    toOwner: toOwner.value.trim(),
    momRef: momRef.value.trim(),
  })
  if (res.error) transferError.value = res.error.message
  else transferMsg.value = 'Mandat COO dialihkan.'
  transferring.value = false
}
</script>

<template>
  <main class="page">
    <header class="page-head">
      <h1>Pendaftaran &amp; Verifikasi</h1>
      <p class="sub">Pendaftaran mandiri owner, verifikasi/penolakan oleh COO, dan pergantian mandat COO.</p>
    </header>

    <section class="card">
      <h2>Pendaftaran Mandiri</h2>
      <p class="muted">Mendaftarkan akun Google Anda sebagai calon Owner (status "diajukan").</p>
      <button type="button" @click="register" :disabled="registering">{{ registering ? 'Mendaftar…' : 'Daftar sekarang' }}</button>
      <p v-if="registerError" class="error" role="alert">{{ registerError }}</p>
      <p v-if="registered" class="ok">Terdaftar sebagai <strong>{{ registered.email }}</strong> — status <code>{{ registered.status }}</code></p>
    </section>

    <section class="card">
      <h2>Verifikasi Pendaftaran <span class="coo-tag">COO</span></h2>
      <form class="inline" @submit.prevent="verify">
        <label>Owner ID<input v-model="verifyOwnerId" required /></label>
        <button type="submit" :disabled="verifying">Verifikasi</button>
      </form>
      <p v-if="verifyError" class="error" role="alert">{{ verifyError }}</p>
      <p v-if="verifyMsg" class="ok">{{ verifyMsg }}</p>
    </section>

    <section class="card">
      <h2>Tolak Pendaftaran <span class="coo-tag">COO</span></h2>
      <form class="form" @submit.prevent="reject">
        <label>Owner ID<input v-model="rejectOwnerId" required /></label>
        <label>Alasan<input v-model="rejectReason" required /></label>
        <div class="actions"><button type="submit" :disabled="rejecting">Tolak</button></div>
      </form>
      <p v-if="rejectError" class="error" role="alert">{{ rejectError }}</p>
      <p v-if="rejectMsg" class="ok">{{ rejectMsg }}</p>
    </section>

    <section class="card">
      <h2>Pergantian Mandat COO <span class="coo-tag">COO</span></h2>
      <form class="form" @submit.prevent="transferCoo">
        <label>Owner tujuan (ID)<input v-model="toOwner" required /></label>
        <label>MoM Ref<input v-model="momRef" required /></label>
        <div class="actions"><button type="submit" :disabled="transferring">Alihkan mandat</button></div>
      </form>
      <p v-if="transferError" class="error" role="alert">{{ transferError }}</p>
      <p v-if="transferMsg" class="ok">{{ transferMsg }}</p>
    </section>

    <nav class="links"><NuxtLink to="/profil">Profil saya →</NuxtLink></nav>
  </main>
</template>

<style scoped>
.page { max-width: 800px; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
.page-head h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
.sub { color: #555; margin: 0 0 1rem; }
.card { border: 1px solid #e5e5e5; border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 1.25rem; background: #fff; }
.card h2 { font-size: 1.05rem; margin: 0 0 .75rem; }
.coo-tag { font-size: .65rem; background: #eef; color: #339; padding: .1rem .45rem; border-radius: 999px; vertical-align: middle; }
.inline { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; }
.inline label { flex: 1; min-width: 220px; }
.form { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
.form .actions { grid-column: 1 / -1; }
label { display: flex; flex-direction: column; gap: .25rem; font-size: .85rem; }
input, button { padding: .5rem .6rem; border: 1px solid #ccc; border-radius: 6px; background: #fff; font: inherit; }
button { cursor: pointer; background: #0a58ca; color: #fff; border-color: #0a58ca; }
button:disabled { opacity: .6; cursor: default; }
code { background: #f3f3f3; padding: .1rem .35rem; border-radius: 4px; }
.muted { color: #888; }
.error { color: #b00020; background: #fdecef; padding: .6rem .8rem; border-radius: 6px; }
.ok { color: #1e7e34; }
.links { margin-top: 1rem; }
.links a { color: #0a58ca; text-decoration: none; }
</style>
