<script setup lang="ts">
import { MOM_LIMIT_DEFAULT, MOM_LIMIT_OPSI, type MomLimit } from '#shared/domain/mom'
import { LANDING_PATH } from '#shared/domain/identity'
import type { LandingRespons } from '~/lib/landing'
import { formatTanggalMom, HTTP_FORBIDDEN, PETA_BADGE_MOM, ringkasKonten, type MomRespons } from '~/lib/mom'

/**
 * Daftar MoM — untuk pemegang saham, COO, dan keluar-PERNAH-beli (FR-7,
 * AD-8, matriks §4.8 — keputusan owner 2026-09-22). COO dapat membuat MoM
 * baru; lainnya hanya bisa membaca. Owner tanpa saham belum-pernah-beli
 * dialihkan middleware ke Halaman Personal dengan pesan transparensi
 * (flash-cookie — Story 2.1b). Layout `app` (Story 2.1b — nav registry).
 */
definePageMeta({ layout: 'app', auth: true, key: route => route.fullPath })

const api = useRequestFetch()

const landing = await api<LandingRespons>('/api/landing').catch(() => null)
if (!landing) {
  await navigateTo('/login')
} else if ('unlinked' in landing) {
  await navigateTo('/login?res=unlinked')
} else if (landing.role === 'calon_owner') {
  // Resolver defensif (pola 1.7 — middleware yang otoritatif): calon →
  // landing calon. Tanpa_saham DIBIARKAN — aksesPenuh (keluar-pernah-beli)
  // berhak baca; !aksesPenuh sudah ditolak middleware sebelum render.
  await navigateTo(LANDING_PATH.calon_owner)
}

const POLA_ANGKA = /^\d+$/
const MAKS_ANGKA_AMAN = Number.MAX_SAFE_INTEGER

function parseAngka(nilai: unknown): number | null {
  if (typeof nilai !== 'string' || !POLA_ANGKA.test(nilai)) return null
  const hasil = Number.parseInt(nilai, 10)
  return hasil >= 1 && hasil <= MAKS_ANGKA_AMAN ? hasil : null
}

const route = useRoute()
const HALAMAN_AWAL = 1
const halamanAktif = parseAngka(route.query.page) ?? HALAMAN_AWAL
const limitAktif = parseAngka(route.query.limit)
const ukuranAktif = limitAktif !== null && MOM_LIMIT_OPSI.includes(limitAktif as MomLimit)
  ? (limitAktif as MomLimit)
  : MOM_LIMIT_DEFAULT

function tautanMom(halaman: number, ukuran: MomLimit): string {
  const params: string[] = []
  if (halaman > 1) params.push(`page=${halaman}`)
  if (ukuran !== MOM_LIMIT_DEFAULT) params.push(`limit=${ukuran}`)
  return params.length === 0 ? '/mom' : `/mom?${params.join('&')}`
}

/** Muat daftar MoM — 403 defensif → /personal polos (pola 1.7; pesan via
 *  flash-cookie middleware, bukan query param). */
async function muatDaftarMom(): Promise<MomRespons | null> {
  try {
    return await api<MomRespons>(`/api/mom?page=${halamanAktif}&limit=${ukuranAktif}`)
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode === HTTP_FORBIDDEN) {
      await navigateTo('/personal')
    }
    return null
  }
}

const hasilMom = landing && !('unlinked' in landing) && landing.role !== 'calon_owner'
  ? await muatDaftarMom()
  : null

const gagalMuat = hasilMom === null
const kosong = hasilMom !== null && hasilMom.data.length === 0
const nextPage = hasilMom?.nextPage ?? null
const isCoo = landing && !('unlinked' in landing) && landing.role === 'coo'

useHead({ title: 'MoM MRO/RUPS — Sip & Dip' })
</script>

<template>
  <main data-testid="mom-halaman" class="mx-auto flex min-h-dvh max-w-7xl flex-col gap-6 px-4 py-8">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">MoM MRO/RUPS</h1>
        <p class="text-sm text-muted-foreground">Notulen keputusan MRO dan RUPS.</p>
      </div>
      <NuxtLink
        v-if="isCoo"
        to="/mom/baru"
        class="flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <span class="text-lg">+</span>
        <span>Buat MoM</span>
      </NuxtLink>
    </header>

    <section
      v-if="gagalMuat"
      class="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center"
    >
      <p class="text-sm text-muted-foreground">MoM gagal dimuat.</p>
      <a href="/mom" class="text-sm font-medium underline underline-offset-4">
        Coba lagi
      </a>
    </section>

    <section
      v-else-if="kosong"
      data-testid="mom-kosong"
      class="flex flex-1 items-center justify-center rounded-lg border border-dashed p-10 text-center"
    >
      <p class="text-sm text-muted-foreground">Belum ada MoM tersimpan.</p>
    </section>

    <template v-else>
      <div class="flex items-center justify-end gap-2" data-testid="mom-ukuran">
        <span class="text-sm text-muted-foreground">Per halaman:</span>
        <NuxtLink
          v-for="opsi in MOM_LIMIT_OPSI"
          :key="opsi"
          :to="tautanMom(1, opsi)"
          class="rounded-md px-2 py-1 text-sm tabular-nums"
          :class="opsi === ukuranAktif
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent'"
          :aria-current="opsi === ukuranAktif ? 'true' : undefined"
        >
          {{ opsi }}
        </NuxtLink>
      </div>

      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="mom in hasilMom?.data"
          :key="mom.id"
          :to="`/mom/${mom.id}`"
          class="flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-accent/50"
          data-testid="mom-card"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex min-w-0 flex-1 items-center gap-2">
              <h2 class="min-w-0 flex-1 font-medium line-clamp-2">{{ mom.title }}</h2>
              <!-- PDF indicator (Req-1, Req-2 — Task 9.3) -->
              <span
                v-if="mom.pdfPath"
                class="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                title="PDF tersedia"
                data-testid="mom-pdf-indicator"
              >
                <svg
                  class="h-3 w-3"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                PDF
              </span>
            </div>
            <Badge :variant="PETA_BADGE_MOM[mom.status].variant" class="shrink-0 rounded-full">
              {{ PETA_BADGE_MOM[mom.status].label }}
            </Badge>
          </div>
          <p class="text-sm text-muted-foreground">{{ formatTanggalMom(mom.heldAt) }}</p>
          <p class="text-sm text-muted-foreground line-clamp-2">{{ ringkasKonten(mom.contentText) }}</p>
        </NuxtLink>
      </div>

      <nav
        v-if="halamanAktif > 1 || nextPage !== null"
        data-testid="mom-paginasi"
        class="flex items-center justify-between"
        aria-label="Paginasi MoM"
      >
        <NuxtLink
          v-if="halamanAktif > 1"
          :to="tautanMom(halamanAktif - 1, ukuranAktif)"
          class="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          ← Sebelumnya
        </NuxtLink>
        <span v-else />
        <span class="text-sm text-muted-foreground tabular-nums">Halaman {{ halamanAktif }}</span>
        <NuxtLink
          v-if="nextPage !== null"
          :to="tautanMom(nextPage, ukuranAktif)"
          class="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Berikutnya →
        </NuxtLink>
        <span v-else />
      </nav>
    </template>
  </main>
</template>
