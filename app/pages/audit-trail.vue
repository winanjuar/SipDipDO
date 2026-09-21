<script setup lang="ts">
import { AUDIT_LIMIT_DEFAULT, AUDIT_LIMIT_OPSI, type AuditLimit } from '#shared/domain/audit'
import { LANDING_PATH } from '#shared/domain/identity'
import type { LandingRespons } from '~/lib/landing'
import { formatWaktuAudit, labelAktor, ringkasDetailJson, TARGET_KOSONG } from '~/lib/audit'
import type { AuditRespons } from '~/lib/audit'

/**
 * Audit Trail — khusus COO (FR-12, AD-8). Tampilan MINIMAL (keputusan spec
 * 1.3 + renegosiasi user 2026-09-17): tabel entry terbaru (aktor, waktu,
 * aksi, target, detail) + paginasi tautan dengan pilihan ukuran halaman
 * (20/40/80, default 20) — TANPA filter aktor/aksi/rentang waktu dan TANPA
 * infinite scroll. Non-COO membuka URL langsung → kembali ke landing
 * role-nya (penegakan server di /api/audit; sisi halaman memakai pola
 * status-pendaftaran.vue).
 *
 * `key: route.fullPath` WAJIB — tanpa itu, klik Berikutnya/Sebelumnya hanya
 * mengubah query sehingga Nuxt MEMAKAI ULANG komponen: setup (fetch SSR dan
 * `halamanAktif`) tidak pernah jalan lagi dan tabel diam di halaman 1.
 */
definePageMeta({ layout: 'app', auth: true, key: route => route.fullPath })

const api = useRequestFetch()

const landing = await api<LandingRespons>('/api/landing').catch(() => null)
if (!landing) {
  await navigateTo('/login')
} else if ('unlinked' in landing) {
  await navigateTo('/login?res=unlinked')
} else if (landing.role !== 'coo') {
  // Non-COO membuka URL langsung → landing role-nya (UX-DR14).
  await navigateTo(LANDING_PATH[landing.role])
}

const POLA_ANGKA = /^\d+$/
const MAKS_ANGKA_AMAN = Number.MAX_SAFE_INTEGER

/**
 * Parse angka query ketat: `/^\d+$/` + batas MAX_SAFE_INTEGER — '2abc'
 * maupun '1e21' jatuh ke fallback (divergensi lapis: API menjawab 400,
 * halaman fallback).
 */
function parseAngka(nilai: unknown): number | null {
  if (typeof nilai !== 'string' || !POLA_ANGKA.test(nilai)) return null
  const hasil = Number.parseInt(nilai, 10)
  return hasil >= 1 && hasil <= MAKS_ANGKA_AMAN ? hasil : null
}

const route = useRoute()
const HALAMAN_AWAL = 1
const halamanAktif = parseAngka(route.query.page) ?? HALAMAN_AWAL
/** Ukuran halaman aktif — bila `?limit` tidak valid, fallback ke default. */
const limitAktif = parseAngka(route.query.limit)
const ukuranAktif = limitAktif !== null && AUDIT_LIMIT_OPSI.includes(limitAktif as AuditLimit)
  ? (limitAktif as AuditLimit)
  : AUDIT_LIMIT_DEFAULT

/**
 * Tautan paginasi/ukuran — kanonik: `page` dihilangkan bila 1, `limit`
 * dihilangkan bila default. Ganti ukuran KEMBALI ke halaman 1 (offset halaman
 * lama nyaris pasti di luar jangkauan ukuran baru).
 */
function tautanAudit(halaman: number, ukuran: AuditLimit): string {
  const params: string[] = []
  if (halaman > 1) params.push(`page=${halaman}`)
  if (ukuran !== AUDIT_LIMIT_DEFAULT) params.push(`limit=${ukuran}`)
  return params.length === 0 ? '/audit-trail' : `/audit-trail?${params.join('&')}`
}

const hasilAudit = landing && !('unlinked' in landing) && landing.role === 'coo'
  ? await api<AuditRespons>(`/api/audit?page=${halamanAktif}&limit=${ukuranAktif}`).catch(() => null)
  : null

const gagalMuat = hasilAudit === null
const kosong = hasilAudit !== null && hasilAudit.data.length === 0
const nextPage = hasilAudit?.nextPage ?? null

useHead({ title: 'Audit Trail — Sip & Dip' })
</script>

<template>
  <main data-testid="audit-trail-halaman" class="mx-auto flex min-h-dvh max-w-7xl flex-col gap-6 px-4 py-8">
    <header>
      <h1 class="text-2xl font-semibold">Audit Trail</h1>
      <p class="text-sm text-muted-foreground">Catatan aksi pada sistem — hanya untuk COO.</p>
    </header>

    <section
      v-if="gagalMuat"
      class="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center"
    >
      <p class="text-sm text-muted-foreground">Audit Trail gagal dimuat.</p>
      <!-- Anchor biasa (bukan NuxtLink): muat ulang dokumen penuh agar SSR
           fetch berjalan lagi — NuxtLink ke rute sama adalah retry no-op. -->
      <a href="/audit-trail" class="text-sm font-medium underline underline-offset-4">
        Coba lagi
      </a>
    </section>

    <section
      v-else-if="kosong"
      data-testid="audit-trail-kosong"
      class="flex flex-1 items-center justify-center rounded-lg border border-dashed p-10 text-center"
    >
      <p class="text-sm text-muted-foreground">Belum ada aksi yang tercatat.</p>
    </section>

    <template v-else>
      <div class="flex items-center justify-end" data-testid="audit-trail-ukuran">
        <span class="text-sm text-muted-foreground">Per halaman:</span>
        <NuxtLink
          v-for="opsi in AUDIT_LIMIT_OPSI"
          :key="opsi"
          :to="tautanAudit(1, opsi)"
          class="rounded-md px-2 py-1 text-sm tabular-nums"
          :class="opsi === ukuranAktif
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent'"
          :aria-current="opsi === ukuranAktif ? 'true' : undefined"
        >
          {{ opsi }}
        </NuxtLink>
      </div>

      <Table data-testid="audit-trail-tabel">
        <TableHeader>
          <TableRow>
            <TableHead class="max-lg:sticky max-lg:left-0 max-lg:z-10 max-lg:bg-background">Waktu</TableHead>
            <TableHead>Aktor</TableHead>
            <TableHead>Aksi</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="entry in hasilAudit?.data"
            :key="entry.id"
            data-testid="audit-trail-baris"
          >
            <TableCell class="max-lg:sticky max-lg:left-0 max-lg:z-10 max-lg:bg-background whitespace-nowrap tabular-nums">
              {{ formatWaktuAudit(entry.createdAt) }}
            </TableCell>
            <TableCell class="whitespace-nowrap">
              <!-- Padding spasi: teks baris terbaca sebagai kata terpisah (kontrak asersi by-text UX-DR4). -->
              {{ ` ${labelAktor(entry.actor)} ` }}
            </TableCell>
            <TableCell class="whitespace-nowrap font-mono text-xs">
              {{ entry.action }}
            </TableCell>
            <TableCell class="max-w-48 truncate" :title="entry.target ?? undefined">
              {{ entry.target ?? TARGET_KOSONG }}
            </TableCell>
            <TableCell class="max-w-md truncate font-mono text-xs" :title="JSON.stringify(entry.details)">
              {{ ringkasDetailJson(entry.details) }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <nav
        v-if="halamanAktif > 1 || nextPage !== null"
        data-testid="audit-trail-paginasi"
        class="flex items-center justify-between"
        aria-label="Paginasi Audit Trail"
      >
        <NuxtLink
          v-if="halamanAktif > 1"
          :to="tautanAudit(halamanAktif - 1, ukuranAktif)"
          class="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          &larr; Sebelumnya
        </NuxtLink>
        <span v-else />
        <span class="text-sm text-muted-foreground tabular-nums">Halaman {{ halamanAktif }}</span>
        <NuxtLink
          v-if="nextPage !== null"
          :to="tautanAudit(nextPage, ukuranAktif)"
          class="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Berikutnya &rarr;
        </NuxtLink>
        <span v-else />
      </nav>
    </template>
  </main>
</template>
