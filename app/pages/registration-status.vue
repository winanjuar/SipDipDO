<script setup lang="ts">
import type { OwnerStatus } from '#shared/domain/identity'
import { LANDING_PATH } from '#shared/domain/identity'
import type { LandingRespons, StatusPendaftaranRespons } from '~/lib/landing'

/**
 * Status Pendaftaran — khusus calon owner `diajukan`/`ditolak`/`kedaluwarsa`
 * (UX-DR14, keputusan pengguna spec #2). KERANGKA minimal: Status Badge
 * berteks per status (warna bukan satu-satunya pembawa makna — UX-DR4) +
 * alasan penolakan tampil apa adanya. Tampilan status PENUH adalah scope
 * nyata Story 1.4 — jangan diimplementasi di sini.
 */
definePageMeta({ auth: true })

/** Peta status → badge (teks + varian token semantik UX-DR2/DR4). */
const PETA_BADGE: Record<OwnerStatus, { label: string, variant: 'warn' | 'success' | 'destructive' | 'muted' }> = {
  diajukan: { label: 'Diajukan', variant: 'warn' },
  terverifikasi: { label: 'Terverifikasi', variant: 'success' },
  ditolak: { label: 'Ditolak', variant: 'destructive' },
  kedaluwarsa: { label: 'Kedaluwarsa', variant: 'muted' },
  keluar: { label: 'Keluar', variant: 'muted' },
}

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

const statusData = landing && !('unlinked' in landing) && landing.role === 'calon_owner'
  ? await api<StatusPendaftaranRespons>('/api/register/status').catch(() => null)
  : null

const badge = statusData ? PETA_BADGE[statusData.status] : null
const alasanPenolakan = statusData?.rejectionReason ?? ''

/**
 * Tautan "Lengkapi Profile" / "Perbarui Profile" (Story 1.5 + keputusan
 * owner 2026-09-21) — satu-satunya pintu nav yang sah bagi calon `diajukan`;
 * calon lengkap tetap dapat membuka form untuk melihat/memperbarui isian
 * pra-verifikasi (simpan-parsial 1.5 tetap jalan; gerbang kelengkapan COO
 * tetap melindungi). Kelengkapan dibaca dari GET /api/profile (kanonik
 * kontrak wire); gagal baca = tautan disembunyikan.
 */
const hasilProfil = statusData?.status === 'diajukan'
  ? await api<ProfilSaya>('/api/profile').catch(() => null)
  : null
const perluLengkapiProfil = hasilProfil !== null && hasilProfil.profileComplete === false
const profilLengkapDiajukan = hasilProfil !== null && hasilProfil.profileComplete === true

/** Bentuk wire GET /api/profile yang ditampilkan (Lampiran A #1-10). */
interface ProfilSaya {
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
}

/** Pasangan label-nilai Data Profile read-only (Lampiran A #1-10; nilai
 *  kosong tampil '—') — keputusan owner 2026-09-21: calon yang sudah
 *  melengkapi profil tetap dapat MELIHAT datanya selama menunggu
 *  verifikasi COO. */
const BARIS_DATA_PROFIL: readonly { label: string, kunci: keyof ProfilSaya }[] = [
  { label: 'Nama Lengkap', kunci: 'fullName' },
  { label: 'Nama Panggilan atau Alias', kunci: 'alias' },
  { label: 'Gmail', kunci: 'gmail' },
  { label: 'Nomor HP', kunci: 'phoneNumber' },
  { label: 'Kontak Darurat', kunci: 'emergencyContactName' },
  { label: 'Nomor HP Kontak Darurat', kunci: 'emergencyContactPhoneNumber' },
  { label: 'Hubungan dengan Owner', kunci: 'emergencyContactRelationship' },
  { label: 'Nama Bank', kunci: 'bankName' },
  { label: 'Pemilik Rekening', kunci: 'accountHolderName' },
  { label: 'Nomor Rekening', kunci: 'accountNumber' },
]

const dataProfil = hasilProfil === null
  ? []
  : BARIS_DATA_PROFIL.map(baris => ({
      label: baris.label,
      nilai: String(hasilProfil[baris.kunci] ?? ''),
    }))

/** Alert konfirmasi pasca-daftar (permintaan owner 2026-09-18, direvisi:
 *  alert di ATAS halaman menggantikan toast bawah — auto-hilang 3 detik):
 *  flag sessionStorage dari register.vue (keputusan owner 2026-09-21 — URL
 *  polos tanpa query) → alert SEKALI. Klien-saja (onMounted).
 *  Alert "Masuk berhasil." dilewati bila alert daftar tampil. */
const pesanMasuk = useSekaliAlertMasuk()
const pesanDaftar = useSekaliAlertPendaftaran()

useHead({ title: 'Status Pendaftaran — Sip & Dip' })
</script>

<template>
  <div>
  <Alert v-if="pesanDaftar" variant="success" class="mx-auto max-w-md px-4 pt-4 sm:rounded-lg" aria-live="polite">
    {{ pesanDaftar }}
  </Alert>
  <Alert v-else-if="pesanMasuk" variant="success" class="mx-auto max-w-md px-4 pt-4 sm:rounded-lg" aria-live="polite">
    {{ pesanMasuk }}
  </Alert>
  <main class="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-10">
    <!-- Wayfinding calon (keputusan owner 2026-09-21): logo + pintu logout
         (komponen bersama) — halaman calon tidak memakai layout ber-nav. -->
    <div class="flex items-center justify-between">
      <BrandLogo size="header" />
      <AppTombolKeluar />
    </div>

    <header>
      <h1 class="text-2xl font-semibold">Status Pendaftaran</h1>
      <p class="text-sm text-muted-foreground">Status pendaftaran kepemilikan saham Anda.</p>
    </header>

    <section v-if="badge" class="flex flex-col gap-4 rounded-lg border p-4">
      <div class="flex items-center gap-3">
        <span class="text-sm text-muted-foreground">Status</span>
        <Badge data-testid="status-badge" aria-live="polite" :variant="badge.variant" class="rounded-full">
          {{ badge.label }}
        </Badge>
      </div>

      <!-- Data Profile read-only (keputusan owner 2026-09-21): calon diajukan
           tetap dapat melihat isian Lampiran A-nya selama menunggu verifikasi. -->
      <section
        v-if="dataProfil.length > 0"
        data-testid="status-data-profil"
        class="flex flex-col gap-2 rounded-lg border p-4"
      >
        <h2 class="text-lg font-semibold">Data Profile</h2>
        <dl class="flex flex-col divide-y">
          <div
            v-for="baris in dataProfil"
            :key="baris.label"
            class="flex items-baseline justify-between gap-4 py-2"
          >
            <dt class="text-sm text-muted-foreground">{{ baris.label }}</dt>
            <dd class="text-sm font-medium">{{ baris.nilai.length > 0 ? baris.nilai : '—' }}</dd>
          </div>
        </dl>
      </section>

      <NuxtLink
        v-if="perluLengkapiProfil"
        to="/profile-completeness"
        class="flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Lengkapi Profile
      </NuxtLink>

      <!-- Calon lengkap: pintu yang sama, label perbarui — form tetap bisa
           dibuka (lihat/memperbaiki isian pra-verifikasi). -->
      <NuxtLink
        v-else-if="profilLengkapDiajukan"
        to="/profile-completeness"
        class="flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Perbarui Profile
      </NuxtLink>

      <div v-if="alasanPenolakan" class="flex flex-col gap-1">
        <p class="text-sm font-medium">Alasan penolakan</p>
        <p
          data-testid="status-alasan-penolakan"
          class="rounded-md border border-destructive/30 p-3 text-sm leading-relaxed"
        >
          {{ alasanPenolakan }}
        </p>
      </div>
    </section>

    <section v-else class="flex flex-1 items-center justify-center rounded-lg border border-dashed p-10 text-center">
      <p class="text-sm text-muted-foreground">Status pendaftaran belum tersedia.</p>
    </section>
  </main>
  </div>
</template>
