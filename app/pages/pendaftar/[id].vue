<script setup lang="ts">
import type { OwnerStatus } from '#shared/domain/identity'
import { LANDING_PATH } from '#shared/domain/identity'
import type { LandingRespons } from '~/lib/landing'

/**
 * Detail Pendaftar — halaman COO (penyempurnaan owner 2026-09-23): MENIRU
 * layout halaman kelengkapan (`/profile-completeness`) supaya COO memeriksa
 * isian persis seperti yang diisi calon — fieldset ber-legend sama
 * (Profil Pemilik / Info Kontak Darurat / Info Rekening), READ-ONLY (input
 * gaya muted-disabled). Aksi Verifikasi tersedia di sini (untuk calon
 * `profilLengkap`) lewat dialog konfirmasi dua-langkah yang sama dengan
 * halaman daftar (renegotiasi 2026-09-23); sukses/gagal-race → kembali ke
 * daftar. Penegakan kewenangan di server (GET /api/pendaftar/:id + POST
 * keputusan) — UI hanya lapisan pertama (AD-8). Data diambil on-demand;
 * 404 (bukan `diajukan`/tidak ada) → kembali ke daftar.
 */
definePageMeta({ auth: true, layout: 'app' })

interface DetailPendaftar {
  id: string
  email: string
  status: OwnerStatus
  fullName: string
  alias: string
  phoneNumber: string
  emergencyContactName: string
  emergencyContactPhoneNumber: string
  emergencyContactRelationship: string
  bankName: string
  otherBankName: string
  accountHolderName: string
  accountNumber: string
  profilLengkap: boolean
  sisaField: string[]
}

const api = useRequestFetch()
const route = useRoute()
const id = route.params.id as string

const landing = await api<LandingRespons>('/api/landing').catch(() => null)
if (!landing) {
  await navigateTo('/login')
} else if ('unlinked' in landing) {
  await navigateTo('/login?res=unlinked')
} else if (landing.role !== 'coo') {
  await navigateTo(LANDING_PATH[landing.role])
}

const adalahCoo = landing !== null && !('unlinked' in landing) && landing.role === 'coo'

const detail = adalahCoo
  ? await api<DetailPendaftar>(`/api/pendaftar/${id}`).catch(() => null)
  : null
if (!detail) {
  await navigateTo('/pendaftar')
}

const pesan = ref<string | null>(null)
const sedangKirim = ref(false)

const calonDiverifikasi = ref(false)

function bukaDialogVerifikasi(): void {
  calonDiverifikasi.value = true
}

function tutupDialogVerifikasi(): void {
  calonDiverifikasi.value = false
}

async function konfirmasiVerifikasi(): Promise<void> {
  if (sedangKirim.value) return
  calonDiverifikasi.value = false
  sedangKirim.value = true
  try {
    await api('/api/pendaftar/keputusan', {
      method: 'POST',
      body: { id, keputusan: 'terverifikasi' },
    })
    // Sukses maupun kalah race (409) — keduanya berarti pekerjaan di halaman
    // ini selesai: kembali ke daftar yang akan memuat ulang sendiri.
    await navigateTo('/pendaftar')
  } catch {
    pesan.value = 'Tidak dapat menyimpan — coba lagi.'
  } finally {
    sedangKirim.value = false
  }
}

useHead({ title: 'Detail Pendaftar — Sip & Dip' })

const terhidrasi = ref(false)
onMounted(() => {
  terhidrasi.value = true
})
</script>

<template>
  <div data-testid="pendaftar-detail-halaman" :data-terhidrasi="terhidrasi ? 'true' : 'false'">
    <Alert
      v-if="pesan"
      variant="destructive"
      aria-live="polite"
      class="mx-auto max-w-md px-4 pt-4 sm:rounded-lg lg:max-w-5xl"
    >
      {{ pesan }}
    </Alert>
    <main class="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 py-10 lg:max-w-5xl">
      <!-- Wayfinding: kembali ke daftar (logo app tetap via layout). -->
      <NuxtLink
        to="/pendaftar"
        data-testid="pendaftar-detail-kembali"
        class="text-sm font-medium underline underline-offset-4"
      >
        ← Kembali ke daftar pendaftar
      </NuxtLink>

      <header class="flex flex-col gap-1">
        <h1 class="text-2xl font-semibold">Detail Pendaftar</h1>
      </header>

      <template v-if="detail">
        <!-- Grup 1 — Profil Pemilik: urutan & label PERSIS halaman
             kelengkapan; seluruh input READ-ONLY (gaya muted-disabled). -->
        <fieldset class="flex flex-col gap-4 rounded-lg border p-4 lg:grid lg:grid-cols-2 lg:gap-4">
          <legend class="px-1 text-sm font-semibold">Profil Pemilik</legend>

          <div class="flex flex-col gap-1 lg:col-span-2">
            <label for="detail-fullName" class="text-sm font-medium">Nama Lengkap</label>
            <input
              id="detail-fullName"
              :value="detail.fullName === '' ? '—' : detail.fullName"
              type="text"
              readonly
              class="flex h-11 w-full rounded-md border bg-muted px-3 py-1 text-sm text-muted-foreground opacity-80"
            >
          </div>

          <div class="flex flex-col gap-1">
            <label for="detail-alias" class="text-sm font-medium">Nama Panggilan atau Alias</label>
            <input
              id="detail-alias"
              :value="detail.alias === '' ? '—' : detail.alias"
              type="text"
              readonly
              class="flex h-11 w-full rounded-md border bg-muted px-3 py-1 text-sm text-muted-foreground opacity-80"
            >
          </div>

          <div class="flex flex-col gap-1">
            <label for="detail-phoneNumber" class="text-sm font-medium">No HP</label>
            <input
              id="detail-phoneNumber"
              :value="detail.phoneNumber === '' ? '—' : detail.phoneNumber"
              type="text"
              readonly
              class="flex h-11 w-full rounded-md border bg-muted px-3 py-1 text-sm text-muted-foreground opacity-80"
            >
          </div>

          <div class="flex flex-col gap-1 lg:col-span-2">
            <label for="detail-email" class="text-sm font-medium">Email</label>
            <input
              id="detail-email"
              :value="detail.email"
              type="text"
              readonly
              class="flex h-11 w-full rounded-md border bg-muted px-3 py-1 text-sm text-muted-foreground opacity-80"
            >
          </div>
        </fieldset>

        <!-- Grup 2 — Info Kontak Darurat (urutan & label PERSIS kelengkapan). -->
        <fieldset class="flex flex-col gap-4 rounded-lg border p-4 lg:grid lg:grid-cols-2 lg:gap-4">
          <legend class="px-1 text-sm font-semibold">Info Kontak Darurat</legend>

          <div class="flex flex-col gap-1 lg:col-span-2">
            <label for="detail-emergencyContactName" class="text-sm font-medium">Nama</label>
            <input
              id="detail-emergencyContactName"
              :value="detail.emergencyContactName === '' ? '—' : detail.emergencyContactName"
              type="text"
              readonly
              class="flex h-11 w-full rounded-md border bg-muted px-3 py-1 text-sm text-muted-foreground opacity-80"
            >
          </div>

          <div class="flex flex-col gap-1">
            <label for="detail-emergencyContactPhoneNumber" class="text-sm font-medium">No HP</label>
            <input
              id="detail-emergencyContactPhoneNumber"
              :value="detail.emergencyContactPhoneNumber === '' ? '—' : detail.emergencyContactPhoneNumber"
              type="text"
              readonly
              class="flex h-11 w-full rounded-md border bg-muted px-3 py-1 text-sm text-muted-foreground opacity-80"
            >
          </div>

          <div class="flex flex-col gap-1">
            <label for="detail-emergencyContactRelationship" class="text-sm font-medium">Hubungan</label>
            <input
              id="detail-emergencyContactRelationship"
              :value="detail.emergencyContactRelationship === '' ? '—' : detail.emergencyContactRelationship"
              type="text"
              readonly
              class="flex h-11 w-full rounded-md border bg-muted px-3 py-1 text-sm text-muted-foreground opacity-80"
            >
          </div>
        </fieldset>

        <!-- Grup 3 — Info Rekening (urutan re-negotiasi 1.5 #5: No. Rekening
             → Pemilik → Bank; Bank Lainnya tampil bila enum Lainnya). -->
        <fieldset class="flex flex-col gap-4 rounded-lg border p-4 lg:grid lg:grid-cols-2 lg:gap-4">
          <legend class="px-1 text-sm font-semibold">Info Rekening</legend>

          <div class="flex flex-col gap-1">
            <label for="detail-accountNumber" class="text-sm font-medium">No. Rekening</label>
            <input
              id="detail-accountNumber"
              :value="detail.accountNumber === '' ? '—' : detail.accountNumber"
              type="text"
              readonly
              class="flex h-11 w-full rounded-md border bg-muted px-3 py-1 text-sm text-muted-foreground opacity-80"
            >
          </div>

          <div class="flex flex-col gap-1">
            <label for="detail-accountHolderName" class="text-sm font-medium">Nama</label>
            <input
              id="detail-accountHolderName"
              :value="detail.accountHolderName === '' ? '—' : detail.accountHolderName"
              type="text"
              readonly
              class="flex h-11 w-full rounded-md border bg-muted px-3 py-1 text-sm text-muted-foreground opacity-80"
            >
          </div>

          <div class="flex flex-col gap-1">
            <label for="detail-bankName" class="text-sm font-medium">Bank</label>
            <input
              id="detail-bankName"
              :value="detail.bankName === '' ? '—' : detail.bankName"
              type="text"
              readonly
              class="flex h-11 w-full rounded-md border bg-muted px-3 py-1 text-sm text-muted-foreground opacity-80"
            >
          </div>

          <div v-if="detail.bankName === 'Lainnya' && detail.otherBankName !== ''" class="flex flex-col gap-1">
            <label for="detail-otherBankName" class="text-sm font-medium">Bank Lainnya</label>
            <input
              id="detail-otherBankName"
              :value="detail.otherBankName"
              type="text"
              readonly
              class="flex h-11 w-full rounded-md border bg-muted px-3 py-1 text-sm text-muted-foreground opacity-80"
            >
          </div>
        </fieldset>

        <!-- Aksi verifikasi di halaman detail (renegotiasi 2026-09-23):
             COO memeriksa + memverifikasi di satu tempat — tanpa
             bolak-balik ke daftar. -->
        <div class="flex flex-col items-stretch gap-2 lg:items-start">
          <Button
            data-testid="pendaftar-detail-aksi-verifikasi"
            size="lg"
            class="h-12 w-full lg:w-auto"
            :disabled="!detail.profilLengkap || sedangKirim"
            @click="bukaDialogVerifikasi"
          >
            Verifikasi
          </Button>
          <p v-if="!detail.profilLengkap" class="text-xs text-muted-foreground">
            Profil calon belum lengkap — verifikasi tidak tersedia.
            Field kurang: {{ detail.sisaField.join(', ') }}
          </p>
        </div>
      </template>
    </main>

    <!-- Dialog konfirmasi — PERSIS pola halaman daftar (dua-langkah). -->
    <Dialog :open="calonDiverifikasi" @update:open="nilai => nilai || tutupDialogVerifikasi()">
      <DialogContent class="max-w-md" data-testid="pendaftar-dialog-verifikasi">
        <DialogHeader>
          <DialogTitle>Verifikasi Pendaftar</DialogTitle>
        </DialogHeader>
        <p class="text-sm text-muted-foreground">
          Saya sudah memeriksa data pendaftar ini dengan seksama dan ingin melakukan verifikasi.
          Status pendaftar akan berubah menjadi <span class="font-medium text-foreground">Terverifikasi</span>.
        </p>
        <DialogFooter class="gap-2 sm:justify-end">
          <Button variant="outline" data-testid="pendaftar-batal-verifikasi" @click="tutupDialogVerifikasi">
            Batal
          </Button>
          <Button
            data-testid="pendaftar-kirim-verifikasi"
            :disabled="sedangKirim"
            @click="konfirmasiVerifikasi"
          >
            Ya, Verifikasi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
