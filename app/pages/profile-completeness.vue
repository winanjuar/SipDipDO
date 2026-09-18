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
 * FR-22 Lampiran A #1–10; UX-DR14/DR16/DR19). Form dikelompokkan per
 * fieldset ber-legend (re-negotiasi owner 2026-09-18: input dijabarkan
 * eksplisit — tanpa loop — label singkat per grup, Email setelah Alias):
 * Pribadi (Nama, Alias, Email, No HP) / Info Kontak Darurat (Nama, No HP,
 * Hubungan) / Info Rekening (Bank, Pemilik, No. Rekening) / Referal (kode
 * milik owner + referal dari — keduanya TIDAK dapat diedit; nilai "referal
 * dari" DORMANT sampai Epic 3, kotak disiapkan dulu).
 * Email (#3) = email sesi Google, readonly. Indikator langkah (UX-DR16)
 * menyebut PERSIS field belum diisi memakai NAMA FIELD LAMPIRAN PENUH
 * (satu sumber `LABEL_FIELD_PROFIL` — label input singkat, indikator
 * presisi). Submit gagal non-validasi → Alert verbatim "Tidak dapat
 * menyimpan — coba lagi." dengan seluruh isian dipertahankan; gagal
 * validasi (400 PROFILE_INCOMPLETE) cukup ditunjukkan indikator. Tanpa
 * navigasi lain (UX-DR14) — satu-satunya pintu nav calon adalah tautan
 * dari /status-pendaftaran.
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

/** Bentuk wire GET/PUT /api/profile (server/api/profile) — duplikasi bentuk
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
  referralCode: string
  usedReferralCode: string | null
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

/** Referensi referral — tampilan ONLY, tidak pernah ikut body PUT. */
const kodeReferalSaya = computed(() => profilTersimpan.value?.referralCode ?? '')
const referalDari = computed(() => profilTersimpan.value?.usedReferralCode ?? '')

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

useHead({ title: 'Kelengkapan Profil — Sip & Dip' })
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-10">
    <header>
      <h1 class="text-2xl font-semibold">Kelengkapan Profil</h1>
      <p class="text-sm text-muted-foreground">
        Data ini menjadi prasyarat verifikasi pemilik sebelum pembelian saham.
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
      <!-- Grup 1 — Pribadi (Lampiran A #1-4); Email = email sesi, readonly. -->
      <fieldset class="flex flex-col gap-4 rounded-lg border p-4">
        <legend class="px-1 text-sm font-semibold">Pribadi</legend>

        <div class="flex flex-col gap-1">
          <label for="profil-namaLengkap" class="text-sm font-medium">Nama</label>
          <input
            id="profil-namaLengkap"
            v-model="isian.namaLengkap"
            type="text"
            autocomplete="off"
            class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
          >
        </div>

        <div class="flex flex-col gap-1">
          <label for="profil-alias" class="text-sm font-medium">Alias</label>
          <input
            id="profil-alias"
            v-model="isian.alias"
            type="text"
            autocomplete="off"
            class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
          >
        </div>

        <div class="flex flex-col gap-1">
          <label for="profil-gmail" class="text-sm font-medium">Email</label>
          <input
            id="profil-gmail"
            :value="gmail"
            type="text"
            disabled
            class="flex h-11 w-full rounded-md border bg-muted px-3 py-1 text-sm text-muted-foreground opacity-80"
          >
        </div>

        <div class="flex flex-col gap-1">
          <label for="profil-nomorHp" class="text-sm font-medium">No HP</label>
          <input
            id="profil-nomorHp"
            v-model="isian.nomorHp"
            type="text"
            autocomplete="off"
            class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
          >
        </div>
      </fieldset>

      <!-- Grup 2 — Info Kontak Darurat (Lampiran A #5-7). -->
      <fieldset class="flex flex-col gap-4 rounded-lg border p-4">
        <legend class="px-1 text-sm font-semibold">Info Kontak Darurat</legend>

        <div class="flex flex-col gap-1">
          <label for="profil-kontakDarurat" class="text-sm font-medium">Nama</label>
          <input
            id="profil-kontakDarurat"
            v-model="isian.kontakDarurat"
            type="text"
            autocomplete="off"
            class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
          >
        </div>

        <div class="flex flex-col gap-1">
          <label for="profil-nomorHpKontakDarurat" class="text-sm font-medium">No HP</label>
          <input
            id="profil-nomorHpKontakDarurat"
            v-model="isian.nomorHpKontakDarurat"
            type="text"
            autocomplete="off"
            class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
          >
        </div>

        <div class="flex flex-col gap-1">
          <label for="profil-hubunganDenganOwner" class="text-sm font-medium">Hubungan</label>
          <input
            id="profil-hubunganDenganOwner"
            v-model="isian.hubunganDenganOwner"
            type="text"
            autocomplete="off"
            class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
          >
        </div>
      </fieldset>

      <!-- Grup 3 — Info Rekening (Lampiran A #8-10). -->
      <fieldset class="flex flex-col gap-4 rounded-lg border p-4">
        <legend class="px-1 text-sm font-semibold">Info Rekening</legend>

        <div class="flex flex-col gap-1">
          <label for="profil-namaBank" class="text-sm font-medium">Bank</label>
          <input
            id="profil-namaBank"
            v-model="isian.namaBank"
            type="text"
            autocomplete="off"
            class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
          >
        </div>

        <div class="flex flex-col gap-1">
          <label for="profil-pemilikRekening" class="text-sm font-medium">Pemilik</label>
          <input
            id="profil-pemilikRekening"
            v-model="isian.pemilikRekening"
            type="text"
            autocomplete="off"
            class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
          >
        </div>

        <div class="flex flex-col gap-1">
          <label for="profil-nomorRekening" class="text-sm font-medium">No. Rekening</label>
          <input
            id="profil-nomorRekening"
            v-model="isian.nomorRekening"
            type="text"
            autocomplete="off"
            class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
          >
        </div>
      </fieldset>

      <!-- Grup 4 — Referal: tampilan ONLY (diluar body PUT); "Referal Dari"
           DORMANT sampai Epic 3 mengaktifkan param link ?ref=. -->
      <fieldset class="flex flex-col gap-4 rounded-lg border p-4">
        <legend class="px-1 text-sm font-semibold">Referal</legend>

        <div class="flex flex-col gap-1">
          <label for="profil-referral-code" class="text-sm font-medium">Kode Referal Saya</label>
          <input
            id="profil-referral-code"
            :value="kodeReferalSaya"
            type="text"
            disabled
            class="flex h-11 w-full rounded-md border bg-muted px-3 py-1 font-mono text-sm text-muted-foreground opacity-80"
          >
          <p class="text-xs text-muted-foreground">Kode referal milik Anda — bagikan saat teman mendaftar.</p>
        </div>

        <div class="flex flex-col gap-1">
          <label for="profil-referal-dari" class="text-sm font-medium">Referal Dari</label>
          <input
            id="profil-referal-dari"
            :value="referalDari"
            type="text"
            disabled
            placeholder="Belum ada"
            class="flex h-11 w-full rounded-md border bg-muted px-3 py-1 text-sm text-muted-foreground opacity-80"
          >
          <p class="text-xs text-muted-foreground">Diisi saat Pembelian Pertama (menyusul).</p>
        </div>
      </fieldset>

      <!-- type="button": klik pra-hidrasi harus INERT — tombol submit native
           memicu navigasi GET form yang me-reset isian sebelum handler Vue
           aktif (submit tetap ditangani @submit.prevent untuk tombol Enter). -->
      <Button type="button" size="lg" class="h-12 w-full" :disabled="sedangSimpan" @click="simpan">
        Simpan
      </Button>
    </form>
  </main>
</template>
