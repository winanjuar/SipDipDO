<script setup lang="ts">
import { LANDING_PATH } from '#shared/domain/identity'
import {
  FIELD_PROFIL_SIMPAN,
  LABEL_FIELD_PROFIL,
  sisaFieldKosong,
  type KunciFieldProfil,
} from '#shared/domain/profil'
import type { LandingRespons } from '~/lib/landing'

/**
 * Kelengkapan Profile — khusus calon owner `diajukan` (Story 1.5, CAP-1/2/3/6;
 * FR-22 Lampiran A #1–10; UX-DR14/DR16/DR19). Form 10 field by-label:
 * Gmail (#3) = email sesi Google, readonly, TIDAK dapat diedit (tanpa field
 * Referal #11 — diajukan saat Pembelian Pertama, Epic 3). Indikator langkah
 * menyebut PERSIS field belum diisi per nama field. Submit gagal non-validasi
 * → Alert verbatim "Tidak dapat menyimpan — coba lagi." dengan seluruh isian
 * dipertahankan; gagal validasi (400 PROFILE_INCOMPLETE) cukup ditunjukkan
 * indikator. Tanpa navigasi lain (UX-DR14) — satu-satunya pintu nav calon
 * adalah tautan dari /status-pendaftaran.
 */
definePageMeta({ auth: true })

const api = useRequestFetch()

const landing = await api<LandingRespons>('/api/landing').catch(() => null)
if (!landing) {
  await navigateTo('/login')
} else if ('unlinked' in landing) {
  await navigateTo('/login?res=unlinked')
} else if (landing.role !== 'calon_owner') {
  // Non-calon membuka URL langsung → kembali ke landing role-nya (UX-DR14).
  await navigateTo(LANDING_PATH[landing.role])
}

/** Bentuk wire GET/PUT /api/profile (server/api/profil) — duplikasi bentuk
 *  terkontrol ala lib/landing.ts; kanoniknya handler + shared/domain/profil. */
interface ResponsProfil {
  namaLengkap: string
  alias: string
  gmail: string
  nomorHp: string
  kontakDarurat: string
  nomorHpKontakDarurat: string
  hubunganDenganOwner: string
  namaBank: string
  pemilikRekening: string
  nomorRekening: string
  profileComplete: boolean
  remainingFields: string[]
}

/**
 * GET profil dibungkus useAsyncData (pola register.vue): hasil SSR dikirim via
 * payload dan TIDAK di-fetch ulang browser saat hidrasi — round-trip klien
 * ekstra (yang bisa di-stub/diganggu test maupun offline) tidak pernah
 * memicu redirect tak sengaja.
 */
const { data: profilTersimpan } = await useAsyncData('profil-kelengkapan', () =>
  api<ResponsProfil>('/api/profile').catch(() => null))

if (!profilTersimpan.value) {
  // Sesi berubah status di antara dua panggilan (mis. kedaluwarsa cron) →
  // kembali ke pintu sah calon.
  await navigateTo('/status-pendaftaran')
}

const gmail = computed(() => profilTersimpan.value?.gmail ?? '')

const isian = reactive(
  Object.fromEntries(
    FIELD_PROFIL_SIMPAN.map((kunci) => [kunci, profilTersimpan.value?.[kunci] ?? '']),
  ),
) as Record<KunciFieldProfil, string>

/** Sisa field kosong — dihitung murni dari isian (trim) via kontrak shared. */
const sisa = computed(() => sisaFieldKosong(isian))

/** Pesan gagal non-validasi (UX-DR19) — verbatim; isian dipertahankan. */
const PESAN_GAGAL_SIMPAN = 'Tidak dapat menyimpan — coba lagi.'
const gagalSimpan = ref(false)
const sedangSimpan = ref(false)

async function simpan() {
  if (sedangSimpan.value) return
  sedangSimpan.value = true
  gagalSimpan.value = false
  try {
    const hasil = await $fetch<ResponsProfil>('/api/profile', { method: 'PUT', body: { ...isian } })
    // Nilai kanonik = versi server (trim) — isian tetap terisi apa adanya.
    for (const kunci of FIELD_PROFIL_SIMPAN) {
      isian[kunci] = hasil[kunci] ?? ''
    }
  } catch (error) {
    // 400 PROFILE_INCOMPLETE = validasi kelengkapan — cukup indikator;
    // kegagalan lain (5xx/jaringan) → Alert verbatim, isian dipertahankan.
    const data = (error as { data?: { code?: unknown } } | null)?.data
    if (data?.code !== 'PROFILE_INCOMPLETE') {
      gagalSimpan.value = true
    }
  } finally {
    sedangSimpan.value = false
  }
}

useHead({ title: 'Kelengkapan Profile — Sip & Dip' })
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-10">
    <header>
      <h1 class="text-2xl font-semibold">Kelengkapan Profile</h1>
      <p class="text-sm text-muted-foreground">
        Data ini menjadi prasyarat verifikasi kepemilikan saham Anda.
      </p>
    </header>

    <Alert v-if="gagalSimpan" variant="destructive" aria-live="polite">
      {{ PESAN_GAGAL_SIMPAN }}
    </Alert>

    <p
      data-testid="kelengkapan-indikator"
      class="rounded-md border p-3 text-sm leading-relaxed"
      aria-live="polite"
    >
      <template v-if="sisa.length > 0">
        Profil belum lengkap — field belum diisi: {{ sisa.map(kunci => LABEL_FIELD_PROFIL[kunci]).join(', ') }}
      </template>
      <template v-else>
        Profil lengkap — seluruh field terisi. Menunggu verifikasi.
      </template>
    </p>

    <form class="flex flex-col gap-4" @submit.prevent="simpan">
      <div
        v-for="kunci in FIELD_PROFIL_SIMPAN"
        :key="kunci"
        class="flex flex-col gap-1"
      >
        <label :for="`profil-${kunci}`" class="text-sm font-medium">
          {{ LABEL_FIELD_PROFIL[kunci] }}
        </label>
        <input
          :id="`profil-${kunci}`"
          v-model="isian[kunci]"
          type="text"
          autocomplete="off"
          class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
        >
      </div>

      <div class="flex flex-col gap-1">
        <label for="profil-gmail" class="text-sm font-medium">Gmail</label>
        <input
          id="profil-gmail"
          :value="gmail"
          type="text"
          disabled
          class="flex h-11 w-full rounded-md border bg-muted px-3 py-1 text-sm text-muted-foreground opacity-80"
        >
        <p class="text-xs text-muted-foreground">Gmail adalah email sesi Google Anda dan tidak dapat diubah di sini.</p>
      </div>

      <!-- type="button": klik pra-hidrasi harus INERT — tombol submit native
           memicu navigasi GET form yang me-reset isian sebelum handler Vue
           aktif (submit tetap ditangani @submit.prevent untuk tombol Enter). -->
      <Button type="button" size="lg" class="h-12 w-full" :disabled="sedangSimpan" @click="simpan">
        Simpan
      </Button>
    </form>
  </main>
</template>
