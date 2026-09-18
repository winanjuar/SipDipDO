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
  sisaFieldKosong,
  type KodeKesalahanProfil,
  type KunciFieldProfil,
} from '#shared/domain/profil'
import type { LandingRespons } from '~/lib/landing'

/**
 * Kelengkapan Profile — khusus calon owner `diajukan` (Story 1.5, CAP-1/2/3/6;
 * FR-22 Lampiran A #1–10; UX-DR14/DR16/DR19). Form dikelompokkan per fieldset
 * ber-legend: Pribadi (Nama, Alias, Email, No HP) / Info Kontak Darurat
 * (Nama, No HP, Hubungan) / Info Rekening (Bank, Pemilik, No. Rekening) /
 * Referal (kode milik owner + referal dari — display-only, DORMANT Epic 3).
 *
 * Validasi & sanitasi (re-negotiasi owner 2026-09-18): batas panjang
 * client-side (`maxlength`), Bank & Hubungan = dropdown (enum shared),
 * field Nama ter-prefill dari profil Google (`namaDariGoogle`) HANYA bila
 * kolom masih kosong — tetap editable; error FORMAT tampil inline per-field
 * dari 400 PROFILE_INVALID (`details.invalidFields`), kelengkapan tetap via
 * indikator (400 PROFILE_INCOMPLETE), dan kegagalan non-validasi → Alert
 * verbatim UX-DR19 dengan isian dipertahankan.
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

/** Sisa field wajib kosong — murni via kontrak shared (otherBankName bersyarat). */
const sisa = computed(() => sisaFieldKosong(isian))

/** Pesan gagal non-validasi (UX-DR19) — verbatim; isian dipertahankan. */
const PESAN_GAGAL_SIMPAN = 'Tidak dapat menyimpan — coba lagi.'
const gagalSimpan = ref(false)
const sedangSimpan = ref(false)

/** Pesan inline per kode kesalahan format (400 PROFILE_INVALID). */
const PESAN_KESALAHAN: Record<KodeKesalahanProfil, string> = {
  'terlalu-panjang': 'Melebihi panjang maksimum.',
  'format-salah': 'Hanya angka dan tanda "-".',
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
  salah.value = {}
  try {
    const hasil = await $fetch<ResponsProfil>('/api/profile', { method: 'PUT', body: { ...isian } })
    // Nilai kanonik = versi server (hasil sanitasi) — isian diselaraskan.
    for (const kunci of FIELD_PROFIL_SIMPAN) {
      isian[kunci] = hasil[kunci] ?? ''
    }
  } catch (error) {
    // 400 PROFILE_INCOMPLETE = kelengkapan → indikator; 400 PROFILE_INVALID =
    // format/enum → inline per-field; kegagalan lain (5xx/jaringan) → Alert
    // verbatim. Segala cabang: isian dipertahankan.
    const data = (error as { data?: { code?: unknown, details?: { invalidFields?: { field: string, kode: KodeKesalahanProfil }[] } } } | null)?.data
    if (data?.code === 'PROFILE_INVALID') {
      salah.value = Object.fromEntries((data.details?.invalidFields ?? []).map(({ field, kode }) => [field, PESAN_KESALAHAN[kode]]))
    } else if (data?.code !== 'PROFILE_INCOMPLETE') {
      gagalSimpan.value = true
    }
  } finally {
    sedangSimpan.value = false
  }
}

useHead({ title: 'Kelengkapan Profil — Sip & Dip' })
</script>

<template>
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
      <!-- Grup 1 — Pribadi (Lampiran A #1-4); Email = email sesi, readonly;
           Nama ter-prefill dari profil Google bila kolom masih kosong. -->
      <fieldset class="flex flex-col gap-4 rounded-lg border p-4 lg:grid lg:grid-cols-2 lg:gap-4">
        <legend class="px-1 text-sm font-semibold">Pribadi</legend>

        <div class="flex flex-col gap-1 lg:col-span-2">
          <label for="profil-fullName" class="text-sm font-medium">Nama</label>
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
          <label for="profil-alias" class="text-sm font-medium">Alias</label>
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
          >
          <p v-if="salah.accountNumber" class="text-xs text-destructive">{{ salah.accountNumber }}</p>
        </div>

        <div class="flex flex-col gap-1">
          <label for="profil-accountHolderName" class="text-sm font-medium">Pemilik</label>
          <input
            id="profil-accountHolderName"
            v-model="isian.accountHolderName"
            type="text"
            :maxlength="PANJANG_MAKS_NAMA"
            autocomplete="off"
            class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
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
        Simpan
      </Button>
      </form>
    </div>
  </main>
</template>
