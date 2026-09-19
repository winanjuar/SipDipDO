<script setup lang="ts">
import { LANDING_PATH } from '#shared/domain/identity'
import {
  BANK_LAINNYA,
  DAFTAR_BANK,
  DAFTAR_HUBUNGAN,
  FIELD_PROFIL_SIMPAN,
  LABEL_FIELD_PROFIL,
  PANJANG_MAKS_ALIAS,
  PANJANG_MAKS_NAMA,
  PANJANG_MAKS_REKENING,
  sanitasiNomor,
  sisaFieldKosong,
  type KodeKesalahanProfil,
  type KunciFieldProfil,
} from '#shared/domain/profil'
import type { LandingRespons } from '~/lib/landing'

/**
 * Kelengkapan Profile — khusus calon owner `diajukan` (Story 1.5, CAP-1/2/3/6;
 * FR-22 Lampiran A #1–10; UX-DR14/DR16/DR19). Form dikelompokkan per fieldset
 * ber-legend: Profil Pemilik (Nama Lengkap, Nama Panggilan atau Alias,
 * Email, No HP) / Info
 * Kontak Darurat (Nama, No HP, Hubungan) / Info Rekening (Bank, Nama,
 * No. Rekening) /
 * Referal (kode milik owner + referal dari — display-only, DORMANT Epic 3).
 *
 * Validasi & sanitasi (re-negotiasi owner 2026-09-18): batas panjang
 * client-side (`maxlength`), Bank & Hubungan = dropdown (enum shared),
 * field Nama ter-prefill dari profil Google (`namaDariGoogle`) HANYA bila
 * kolom masih kosong — tetap editable; error FORMAT tampil inline per-field
 * dari 400 PROFILE_INVALID (`details.invalidFields`), dan kegagalan
 * non-validasi → Alert verbatim UX-DR19 dengan isian dipertahankan.
 *
 * Feedback aksi simpan (permintaan owner 2026-09-18): setiap Simpan selalu
 * menjawab — tombol "Menyimpan…" saat in-flight; sukses → alert "Profil
 * tersimpan." DI ATAS halaman auto-hilang 3 detik (pola status-pendaftaran —
 * toast bawah tak terlihat). SIMPAN PARSIAL (owner 2026-09-19): field kosong
 * tidak lagi menolak simpan — form = state penuh, field terisi wajib lolos
 * validasi format (kode `digit-hp` = pesan digit/prefix HP relevan).
 *
 * Zona kelengkapan TERPISAH (owner 2026-09-19), bertinta token semantik
 * (UX-DR2, pola tint Alert sukses): "Kelengkapan Data di Sistem" (tinta
 * primary) mengklaim HANYA dari data TERSIMPAN (`statusServer`: GET awal +
 * respons PUT sukses); "Kelengkapan Isian di Form" (tinta warn) muncul
 * hanya saat sudah edit DAN form masih menyisakan field kosong — isian
 * lengkap yang belum disimpan tidak pernah diklaim lengkap oleh sistem,
 * dan DB lengkap tidak pernah dibalik jadi belum lengkap oleh edit form.
 *
 * Saklar "Sama dengan pemilik" (permintaan owner 2026-09-19): Pemilik
 * Rekening default terkunci mengikuti Nama Lengkap (state awal derived
 * dari data tersimpan) — dimatikan untuk mengisi manual.
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
  fullName: string
  alias: string
  gmail: string
  phoneNumber: string
  emergencyContactName: string
  emergencyContactPhoneNumber: string
  emergencyContactRelationship: string
  bankName: string
  otherBankName: string
  accountHolderName: string
  accountNumber: string
  profileComplete: boolean
  remainingFields: string[]
  referralCode: string
  usedReferralCode: string | null
  namaDariGoogle: string
}

/**
 * GET profil dibungkus useAsyncData (pola register.vue): hasil SSR dikirim via
 * payload dan TIDAK di-fetch ulang browser saat hidrasi.
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

/** Opsi dropdown terurut alfabetis (re-negotiasi owner 2026-09-18 #5) —
 *  "Lainnya" tetap di posisi terakhir sebagai opsi khusus (di template). */
const BANK_TERURUT: readonly string[] = [...DAFTAR_BANK].sort((a, b) => a.localeCompare(b, 'id'))
const HUBUNGAN_TERURUT: readonly string[] = [...DAFTAR_HUBUNGAN].sort((a, b) => a.localeCompare(b, 'id'))

const isian = reactive(
  Object.fromEntries(
    FIELD_PROFIL_SIMPAN.map((kunci) => [
      kunci,
      kunci === 'fullName'
        // Prefill Google (keputusan owner 2026-09-18): Nama diisi dari profil
        // Google HANYA bila kolom masih kosong — tetap editable, tidak pernah
        // menimpa data tersimpan.
        ? (profilTersimpan.value?.fullName || profilTersimpan.value?.namaDariGoogle || '')
        : (profilTersimpan.value?.[kunci] ?? ''),
    ]),
  ),
) as Record<KunciFieldProfil, string>

/**
 * Status kelengkapan menurut SERVER (data tersimpan) — sumber SATU-SATUNYA
 * klaim indikator rail: init dari GET, diputakhirkan HANYA oleh respons
 * sukses PUT. Respons 400 INCOMPLETE mendeskripsikan FORM yang dikirim (DB
 * tak tersentuh) — tidak pernah membalik klaim (keluhan owner 2026-09-18).
 */
const statusServer = reactive({
  profileComplete: profilTersimpan.value?.profileComplete ?? false,
  remainingFields: (profilTersimpan.value?.remainingFields ?? []) as KunciFieldProfil[],
})

/**
 * Saklar "Sama dengan pemilik" (permintaan owner 2026-09-19): default ON —
 * Pemilik Rekening terkunci mengikuti Nama Lengkap live (mirror ke
 * `isian.accountHolderName`, kontrak PUT tak berubah). State awal DERIVED
 * dari data tersimpan: kosong (belum pernah diisi) ATAU sama dengan Nama →
 * ON; tersimpan berbeda (pernah diisi manual) → OFF agar nilai itu tetap
 * terlihat & editable.
 */
const samaPemilik = ref(isian.accountHolderName === '' || isian.accountHolderName === isian.fullName)
watch([() => samaPemilik.value, () => isian.fullName], ([sama, nama]) => {
  if (sama) isian.accountHolderName = nama
}, { immediate: true })

/** Snapshot baseline isian (pasca prefill Google & mirror saklar) — acuan
 *  deteksi perubahan. REACTIVE: penulisan baseline pasca-simpan memicu
 *  evaluasi ulang `kotor` — objek polos membuat computed bertahan pada
 *  cache basi saat nilai isian tak berubah oleh sync (debug 2026-09-19). */
const snapshotAwal = reactive({ ...isian }) as Record<KunciFieldProfil, string>

/** Kunci field nomor yang disaring masukannya (hanya digit + "-"). */
type KunciFieldNomor = Extract<KunciFieldProfil, 'phoneNumber' | 'emergencyContactPhoneNumber' | 'accountNumber'>

/**
 * Penapis masukan textfield nomor (permintaan owner 2026-09-19): karakter di
 * luar digit/"-" DITOLAK saat diketik/di-paste — nilai disaring via
 * `sanitasiNomor` (satu sumber kebijakan karakter dengan validasi server),
 * kursor dipertahankan pada posisi sahnya (jumlah karakter sah sebelum
 * posisi kursor lama).
 */
function tapiskanNomor(event: Event, kunci: KunciFieldNomor): void {
  const input = event.target as HTMLInputElement
  const bersih = sanitasiNomor(input.value)
  if (bersih === input.value) return
  const posisiKursor = input.selectionStart ?? bersih.length
  const sahSebelumKursor = sanitasiNomor(input.value.slice(0, posisiKursor)).length
  isian[kunci] = bersih
  input.value = bersih
  input.setSelectionRange(sahSebelumKursor, sahSebelumKursor)
}

/** Ada isian yang menyimpang dari baseline terakhir yang diketahui server. */
const kotor = computed(() => FIELD_PROFIL_SIMPAN.some(kunci => isian[kunci] !== snapshotAwal[kunci]))

/**
 * Zona "Kelengkapan Isian di Form" (owner 2026-09-19): cermin KONDISI FORM
 * (bukan klaim DB) — tampil HANYA saat sudah ada perubahan (kotor) DAN form
 * masih menyisakan field kosong; `otherBankName` hanya dihitung bila Bank =
 * "Lainnya" di isian. Kata "Perubahan belum disimpan" dihapus atas permintaan
 * owner — isinya murni daftar field isian yang belum lengkap.
 */
const sisaFormIsian = computed(() => sisaFieldKosong(isian))
const tampilCatatanForm = computed(() => kotor.value && sisaFormIsian.value.length > 0)

/** Pesan gagal non-validasi (UX-DR19) — verbatim; isian dipertahankan. */
const PESAN_GAGAL_SIMPAN = 'Tidak dapat menyimpan — coba lagi.'
const gagalSimpan = ref(false)
const sedangSimpan = ref(false)

/** Alert sukses simpan — DI ATAS halaman, auto-hilang 3 detik (pola
 *  status-pendaftaran; toast bawah tak terlihat — keputusan owner 2026-09-18). */
const PESAN_TERSIMPAN = 'Profil tersimpan.'
const pesanTersimpan = ref('')
let timerPesanTersimpan: ReturnType<typeof setTimeout> | undefined

/** Pesan inline per kode kesalahan format (400 PROFILE_INVALID). `digit-hp`
 *  (owner 2026-09-19): karakter HP sah namun jumlah digit/prefix salah —
 *  pesan spesifik, bukan "hanya angka dan dash" yang menyesatkan. */
const PESAN_KESALAHAN: Record<KodeKesalahanProfil, string> = {
  'terlalu-panjang': 'Melebihi panjang maksimum.',
  'format-salah': 'Hanya angka dan tanda "-".',
  'digit-hp': 'Nomor HP harus 9-15 digit dan dimulai angka 0.',
  'di-luar-daftar': 'Pilih dari daftar yang tersedia.',
}
const salah = ref<Record<string, string>>({})

/** Penanda hidrasi Vue (mount selesai) — interaksi test (khususnya select
 *  v-model yang di-reset saat hidrasi dari state SSR) menunggu atribut ini
 *  sebelum mengisi form; pola anti-race pasca-hidrasi (debug 2026-09-18). */
const terhidrasi = ref(false)
onMounted(() => {
  terhidrasi.value = true
})

async function simpan() {
  if (sedangSimpan.value) return
  sedangSimpan.value = true
  gagalSimpan.value = false
  // `salah` TIDAK dihapus di awal klik — error inline format bertahan stabil
  // lintas percobaan dan dihapus HANYA oleh respons sukses (menghapus di sini
  // membuat error berkedip tiap klik: muncul ~10ms lalu tersapu attempt baru).
  try {
    // Simpan parsial (owner 2026-09-19): field kosong tidak menolak simpan —
    // respons sukses membawa kelengkapan data TERSIMPAN apa adanya.
    const hasil = await $fetch<ResponsProfil>('/api/profile', { method: 'PUT', body: { ...isian } })
    salah.value = {}
    // Nilai kanonik = versi server (hasil sanitasi) — isian & baseline
    // diselaraskan sehingga zona Isian form tidak lagi diperlukan.
    for (const kunci of FIELD_PROFIL_SIMPAN) {
      isian[kunci] = hasil[kunci] ?? ''
      snapshotAwal[kunci] = hasil[kunci] ?? ''
    }
    // Klaim zona Sistem kini dari data TERSIMPAN (respons sukses).
    statusServer.profileComplete = hasil.profileComplete
    statusServer.remainingFields = [...hasil.remainingFields] as KunciFieldProfil[]
    pesanTersimpan.value = PESAN_TERSIMPAN
    if (timerPesanTersimpan !== undefined) clearTimeout(timerPesanTersimpan)
    timerPesanTersimpan = setTimeout(() => {
      pesanTersimpan.value = ''
    }, DURASI_ALERT_SUKSES_MS)
  } catch (error) {
    // 400 PROFILE_INVALID = format/enum → inline per-field; kegagalan lain
    // (5xx/jaringan) → Alert verbatim. Segala cabang: isian dipertahankan.
    const data = (error as { data?: { code?: unknown, details?: { invalidFields?: { field: string, kode: KodeKesalahanProfil }[] } } } | null)?.data
    if (data?.code === 'PROFILE_INVALID') {
      salah.value = Object.fromEntries((data.details?.invalidFields ?? []).map(({ field, kode }) => [field, PESAN_KESALAHAN[kode]]))
    } else {
      gagalSimpan.value = true
    }
  } finally {
    sedangSimpan.value = false
  }
}

useHead({ title: 'Kelengkapan Profil — Sip & Dip' })
</script>

<template>
  <div>
    <!-- Feedback sukses simpan — alert atas halaman auto-hilang 3 detik
         (pola status-pendaftaran; toast bawah tak terlihat). -->
    <Alert
      v-if="pesanTersimpan"
      data-testid="kelengkapan-alert-tersimpan"
      variant="success"
      class="mx-auto max-w-md px-4 pt-4 sm:rounded-lg lg:max-w-5xl"
      aria-live="polite"
    >
      {{ pesanTersimpan }}
    </Alert>

    <main class="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 py-10 lg:max-w-5xl">
    <header>
      <h1 class="text-2xl font-semibold">Kelengkapan Profil</h1>
      <p class="text-sm text-muted-foreground">
        Data ini menjadi prasyarat verifikasi pemilik sebelum pembelian saham.
      </p>
    </header>

    <div class="flex flex-col gap-6 lg:grid lg:grid-cols-[340px_1fr] lg:items-start lg:gap-8">
      <aside class="flex flex-col gap-4 self-start lg:sticky lg:top-10">
        <Alert v-if="gagalSimpan" variant="destructive" aria-live="polite">
          {{ PESAN_GAGAL_SIMPAN }}
        </Alert>

        <!-- Zona TERPISAH (permintaan owner 2026-09-19) — dua-duanya bertinta
             TOKEN SEMANTIK tema (UX-DR2, pola varian Alert sukses), bukan
             warna raw: Sistem = tinta primary (kelengkapan DATA TERSIMPAN),
             Isian = tinta warn (field form masih kosong, muncul hanya saat
             sudah edit). Legend di atas border — pola fieldset Profil
             Pemilik/Info Kontak Darurat/Info Rekening/Referal (owner
             2026-09-19: bukan paragraf informasi di dalam box). -->
        <fieldset
          data-testid="kelengkapan-indikator"
          class="rounded-md border border-primary/40 bg-primary/10 p-3 text-sm leading-relaxed"
          aria-live="polite"
        >
          <legend class="px-1 text-sm font-semibold text-primary">Kelengkapan Data di Sistem</legend>
          <p class="mt-1">
            <template v-if="!statusServer.profileComplete">
              Profil belum lengkap — field belum diisi: {{ statusServer.remainingFields.map(kunci => LABEL_FIELD_PROFIL[kunci]).join(', ') }}
            </template>
            <template v-else>
              Profil lengkap — seluruh field terisi. Menunggu verifikasi.
            </template>
          </p>
        </fieldset>

        <fieldset
          v-if="tampilCatatanForm"
          data-testid="kelengkapan-catatan-form"
          class="rounded-md border border-warn/40 bg-warn/10 p-3 text-sm leading-relaxed"
          aria-live="polite"
        >
          <legend class="px-1 text-sm font-semibold text-warn">Kelengkapan Isian di Form</legend>
          <p class="mt-1">
            Field isian belum lengkap: {{ sisaFormIsian.map(kunci => LABEL_FIELD_PROFIL[kunci]).join(', ') }}.
          </p>
        </fieldset>

        <!-- Referal: tampilan ONLY (DI LUAR body PUT dan DI LUAR kelengkapan —
             relokasi owner 2026-09-18 #6: menempel rail di bawah indikator);
             "Referal Dari" DORMANT sampai Epic 3 mengaktifkan param link ?ref=. -->
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
      </aside>

      <form class="flex flex-col gap-4" @submit.prevent="simpan">
      <!-- Grup 1 — Profil Pemilik (Lampiran A #1-4); Email = email sesi,
            readonly; Nama ter-prefill dari profil Google bila kolom kosong. -->
      <fieldset class="flex flex-col gap-4 rounded-lg border p-4 lg:grid lg:grid-cols-2 lg:gap-4">
        <legend class="px-1 text-sm font-semibold">Profil Pemilik</legend>

        <div class="flex flex-col gap-1 lg:col-span-2">
          <label for="profil-fullName" class="text-sm font-medium">Nama Lengkap</label>
          <input
            id="profil-fullName"
            v-model="isian.fullName"
            type="text"
            :maxlength="PANJANG_MAKS_NAMA"
            autocomplete="off"
            class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
          >
          <p v-if="salah.fullName" class="text-xs text-destructive">{{ salah.fullName }}</p>
        </div>

        <div class="flex flex-col gap-1">
          <label for="profil-alias" class="text-sm font-medium">Nama Panggilan atau Alias</label>
          <input
            id="profil-alias"
            v-model="isian.alias"
            type="text"
            :maxlength="PANJANG_MAKS_ALIAS"
            autocomplete="off"
            class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
          >
          <p v-if="salah.alias" class="text-xs text-destructive">{{ salah.alias }}</p>
        </div>

        <div class="flex flex-col gap-1">
          <label for="profil-phoneNumber" class="text-sm font-medium">No HP</label>
          <input
            id="profil-phoneNumber"
            v-model="isian.phoneNumber"
            type="text"
            inputmode="tel"
            autocomplete="off"
            class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
            @input="tapiskanNomor($event, 'phoneNumber')"
          >
          <p v-if="salah.phoneNumber" class="text-xs text-destructive">{{ salah.phoneNumber }}</p>
        </div>

        <div class="flex flex-col gap-1 lg:col-span-2">
          <label for="profil-gmail" class="text-sm font-medium">Email</label>
          <input
            id="profil-gmail"
            :value="gmail"
            type="text"
            disabled
            class="flex h-11 w-full rounded-md border bg-muted px-3 py-1 text-sm text-muted-foreground opacity-80"
          >
        </div>
      </fieldset>

      <!-- Grup 2 — Info Kontak Darurat (Lampiran A #5-7); Hubungan = dropdown. -->
      <fieldset class="flex flex-col gap-4 rounded-lg border p-4 lg:grid lg:grid-cols-2 lg:gap-4">
        <legend class="px-1 text-sm font-semibold">Info Kontak Darurat</legend>

        <div class="flex flex-col gap-1 lg:col-span-2">
          <label for="profil-emergencyContactName" class="text-sm font-medium">Nama</label>
          <input
            id="profil-emergencyContactName"
            v-model="isian.emergencyContactName"
            type="text"
            :maxlength="PANJANG_MAKS_NAMA"
            autocomplete="off"
            class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
          >
          <p v-if="salah.emergencyContactName" class="text-xs text-destructive">{{ salah.emergencyContactName }}</p>
        </div>

        <div class="flex flex-col gap-1">
          <label for="profil-emergencyContactPhoneNumber" class="text-sm font-medium">No HP</label>
          <input
            id="profil-emergencyContactPhoneNumber"
            v-model="isian.emergencyContactPhoneNumber"
            type="text"
            inputmode="tel"
            autocomplete="off"
            class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
            @input="tapiskanNomor($event, 'emergencyContactPhoneNumber')"
          >
          <p v-if="salah.emergencyContactPhoneNumber" class="text-xs text-destructive">{{ salah.emergencyContactPhoneNumber }}</p>
        </div>

        <div class="flex flex-col gap-1">
          <label for="profil-emergencyContactRelationship" class="text-sm font-medium">Hubungan</label>
          <Select v-model="isian.emergencyContactRelationship">
            <SelectTrigger id="profil-emergencyContactRelationship" class="h-11 w-full">
              <SelectValue placeholder="Pilih hubungan…" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem v-for="pilihan in HUBUNGAN_TERURUT" :key="pilihan" :value="pilihan">
                  {{ pilihan }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <p v-if="salah.emergencyContactRelationship" class="text-xs text-destructive">{{ salah.emergencyContactRelationship }}</p>
        </div>
      </fieldset>

      <!-- Grup 3 — Info Rekening (Lampiran A #8-10; urutan re-negotiasi owner
           2026-09-18 #5: No. Rekening → Pemilik → Bank); dropdown shadcn
           urut alfabetis, opsi "Lainnya" terakhir dan membuka input
           otherBankName DI SEBELAH combobox (maxlength + sanitasi server). -->
      <fieldset class="flex flex-col gap-4 rounded-lg border p-4 lg:grid lg:grid-cols-2 lg:gap-4">
        <legend class="px-1 text-sm font-semibold">Info Rekening</legend>

        <div class="flex flex-col gap-1">
          <label for="profil-accountNumber" class="text-sm font-medium">No. Rekening</label>
          <input
            id="profil-accountNumber"
            v-model="isian.accountNumber"
            type="text"
            inputmode="numeric"
            :maxlength="PANJANG_MAKS_REKENING"
            autocomplete="off"
            class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
            @input="tapiskanNomor($event, 'accountNumber')"
          >
          <p v-if="salah.accountNumber" class="text-xs text-destructive">{{ salah.accountNumber }}</p>
        </div>

        <div class="flex flex-col gap-1">
          <!-- Label field & saklar "sama dengan pemilik" sejajar SATU BARIS
               persis di atas textfield (permintaan owner 2026-09-19): label
               kiri, grup saklar kanan; ON = terkunci mengikuti Nama. -->
          <div class="flex items-center justify-between gap-2">
            <label for="profil-accountHolderName" class="text-sm font-medium">Nama</label>
            <div class="flex items-center gap-2">
              <label for="profil-saklar-pemilik" class="text-sm text-muted-foreground">sama dengan pemilik</label>
              <Switch id="profil-saklar-pemilik" v-model="samaPemilik" data-testid="kelengkapan-saklar-pemilik" />
            </div>
          </div>
          <input
            id="profil-accountHolderName"
            v-model="isian.accountHolderName"
            type="text"
            :maxlength="PANJANG_MAKS_NAMA"
            autocomplete="off"
            :disabled="samaPemilik"
            :class="['flex h-11 w-full rounded-md border px-3 py-1 text-sm', samaPemilik ? 'bg-muted text-muted-foreground opacity-80' : 'bg-transparent shadow-xs']"
          >
          <p v-if="salah.accountHolderName" class="text-xs text-destructive">{{ salah.accountHolderName }}</p>
        </div>

        <div class="flex flex-col gap-1">
          <label for="profil-bankName" class="text-sm font-medium">Bank</label>
          <Select v-model="isian.bankName">
            <SelectTrigger id="profil-bankName" class="h-11 w-full">
              <SelectValue placeholder="Pilih bank…" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem v-for="pilihan in BANK_TERURUT" :key="pilihan" :value="pilihan">
                  {{ pilihan }}
                </SelectItem>
                <SelectItem :value="BANK_LAINNYA">{{ BANK_LAINNYA }}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <p v-if="salah.bankName" class="text-xs text-destructive">{{ salah.bankName }}</p>
        </div>

        <div v-if="isian.bankName === BANK_LAINNYA" class="flex flex-col gap-1">
          <label for="profil-otherBankName" class="text-sm font-medium">Bank Lainnya</label>
            <input
              id="profil-otherBankName"
              v-model="isian.otherBankName"
              type="text"
              :maxlength="PANJANG_MAKS_NAMA"
              autocomplete="off"
              class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
            >
          <p v-if="salah.otherBankName" class="text-xs text-destructive">{{ salah.otherBankName }}</p>
        </div>
      </fieldset>


      <!-- type="button": klik pra-hidrasi harus INERT — tombol submit native
           memicu navigasi GET form yang me-reset isian sebelum handler Vue
           aktif (submit tetap ditangani @submit.prevent untuk tombol Enter). -->
      <Button
        type="button"
        size="lg"
        class="h-12 w-full"
        :disabled="sedangSimpan"
        :data-terhidrasi="terhidrasi ? 'true' : 'false'"
        @click="simpan"
      >
        {{ sedangSimpan ? 'Menyimpan…' : 'Simpan' }}
      </Button>
      </form>
    </div>
  </main>
  </div>
</template>
