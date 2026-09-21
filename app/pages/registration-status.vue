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
 * Tautan "Lengkapi Profile" (Story 1.5, UX-DR14) — satu-satunya pintu nav
 * yang sah bagi calon `diajukan` dengan Profil belum lengkap; calon lengkap
 * maupun status lain tidak melihatnya. Kelengkapan dibaca dari GET
 * /api/profile (kanonik kontrak wire); gagal baca = tautan disembunyikan.
 */
const hasilProfil = statusData?.status === 'diajukan'
  ? await api<{ profileComplete: boolean }>('/api/profile').catch(() => null)
  : null
const perluLengkapiProfil = hasilProfil !== null && hasilProfil.profileComplete === false

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

      <NuxtLink
        v-if="perluLengkapiProfil"
        to="/profile-completeness"
        class="flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Lengkapi Profile
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
