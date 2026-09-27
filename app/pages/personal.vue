<script setup lang="ts">
/**
 * Halaman Personal (Story 1.7, UX-DR19/FR-15) — 4 section matriks keterbukaan:
 * 1. Profile — data read-only milik-sendiri dari GET /api/personal.
 * 2. Portofolio & status Pesanan Pembelian — state kosong (Epic 3).
 * 3. Tautan Harga berjalan & RKAP — non-aktif aria-disabled (Epic 2).
 * 4. Pintu pembuatan Pesanan Pembelian — non-aktif + keterangan (Open
 *    Questions #1 — default tampil non-aktif).
 *
 * Alert transparansi (AD-8/UX-DR14): redirect server gerbang role membawa
 * FLASH-COOKIE `KUNCI_COOKIE_INFO_TRANSPARANSI` (sendRedirect tidak dapat
 * menulis sessionStorage; query param dihapus — keputusan owner 2026-09-21)
 * → pesan VERBATIM `PESAN_TRANSPARANSI` tampil SEKALI (cookie dihapus saat
 * mount — refresh tidak mengulang) sebagai Alert aria-live="polite". Cookie
 * terbaca SSR → alert hadir di paint pertama, TANPA pembersihan URL.
 *
 * Baca profil via `useAsyncData` sisi-KLIEN (`server: false` — kontrak ATDD
 * personal.spec.ts: stub gangguan jaringan di browser). Gagal → state kosong
 * Profile + pesan coba lagi (pola gagal-muat 1.5).
 */
import { aksesPenuh, KUNCI_COOKIE_INFO_TRANSPARANSI, PESAN_TRANSPARANSI } from '#shared/domain/identity'
import { BANK_LAINNYA } from '#shared/domain/profil'
import type { PersonalRespons } from '~/lib/personal'

definePageMeta({ layout: 'app', auth: true })

const pesanMasuk = useSekaliAlertMasuk()

useHead({ title: 'Halaman Personal — Sip & Dip' })

/* ------------------------------------------------------------------ *
 * Alert transparansi — flash-cookie dari gerbang role, tampil sekali.
 * ------------------------------------------------------------------ */
const infoTransparansi = useCookie(KUNCI_COOKIE_INFO_TRANSPARANSI)

/** Sekali per kedatangan: snapshot saat setup — hapus cookie di mount agar
 *  refresh TIDAK mengulang; alert tetap tampil selama user di halaman.
 *  CATATAN: useCookie JSON-decode otomatis — nilai `'1'` terbaca sebagai
 *  angka `1`, sehingga pembanding memakai normalisasi String(). */
const transparansiAktif = computed(() => String(infoTransparansi.value) === '1')

useHead({ title: 'Halaman Personal — Sip & Dip' })

onMounted(() => {
  if (transparansiAktif.value) infoTransparansi.value = null
})

/* ------------------------------------------------------------------ *
 * Section Profile — GET /api/personal (klien; tri-state via muatan).
 * ------------------------------------------------------------------ */
const api = useRequestFetch()

/** Muatan baca profil — `sukses` membedakan gagal-muat dari state kosong. */
type MuatanProfil = { sukses: true, profil: PersonalRespons } | { sukses: false }

const { data: muatanProfil } = useAsyncData<MuatanProfil | null>(
  'halaman-personal-profil',
  async () => {
    try {
      return { sukses: true, profil: await api<PersonalRespons>('/api/personal') }
    } catch {
      return { sukses: false }
    }
  },
  { server: false, default: () => null },
)

const profil = computed(() => (muatanProfil.value?.sukses ? muatanProfil.value.profil : null))
const gagalProfil = computed(() => muatanProfil.value?.sukses === false)

/** Pembelian Pertama PERNAH efektif → section pintu Pesanan tidak relevan
 *  (keterangan non-aktifnya menyasar yang belum pernah membeli — pemegang
 *  saham/COO mendapat pintu pesanan lewat nav Epic 3). */
const sudahPernahBeli = computed(() =>
  profil.value !== null && aksesPenuh({ status: profil.value.status, firstEffectiveAt: profil.value.firstEffectiveAt }))

/** Pasangan label-nilai Profile read-only (Lampiran A #1–10; gmail = email sesi).
 *  Bank "Lainnya" tampil sebagai nama bank isian (`otherBankName`) — bukan
 *  literal enum (review Story 1.7; paritas wire `namaBankKeWire` 1.5). */
const barisProfil = computed(() => {
  const p = profil.value
  if (!p) return []
  const namaBankTampil = p.bankName === BANK_LAINNYA && p.otherBankName.length > 0
    ? p.otherBankName
    : p.bankName
  return [
    { label: 'Nama Lengkap', nilai: p.fullName },
    { label: 'Nama Panggilan atau Alias', nilai: p.alias },
    { label: 'Gmail', nilai: p.gmail },
    { label: 'Nomor HP', nilai: p.phoneNumber },
    { label: 'Kontak Darurat', nilai: p.emergencyContactName },
    { label: 'Nomor HP Kontak Darurat', nilai: p.emergencyContactPhoneNumber },
    { label: 'Hubungan dengan Owner', nilai: p.emergencyContactRelationship },
    { label: 'Nama Bank', nilai: namaBankTampil },
    { label: 'Pemilik Rekening', nilai: p.accountHolderName },
    { label: 'Nomor Rekening', nilai: p.accountNumber },
  ]
})
</script>

<template>
  <div>
    <Alert v-if="pesanMasuk" variant="success" class="mx-auto max-w-3xl px-4 pt-4 sm:rounded-lg" aria-live="polite">
      {{ pesanMasuk }}
    </Alert>

    <!-- Pesan transparensi VERBATIM — tampil SEKALI (URL dibersihkan pasca-mount). -->
    <Alert
      v-if="transparansiAktif"
      data-testid="personal-alert-transparansi"
      variant="default"
      class="mx-auto max-w-3xl px-4 pt-4 sm:rounded-lg"
      aria-live="polite"
    >
      {{ PESAN_TRANSPARANSI }}
    </Alert>

    <main class="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-8">
      <header>
        <h1 class="text-2xl font-semibold">Halaman Personal</h1>
        <p class="text-sm text-muted-foreground">Profile dan pesanan Anda.</p>
      </header>

      <!-- Section 1: Profile (read-only milik-sendiri). -->
      <section data-testid="personal-section-profil" class="flex flex-col gap-3 rounded-lg border p-4">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold">Profile</h2>
          <!-- Anchor biasa (bukan NuxtLink): muat ulang dokumen penuh (pola
               audit-trail 1.3 — retry no-op bila NuxtLink rute sama). -->
          <a
            v-if="gagalProfil"
            href="/personal"
            class="text-sm font-medium underline underline-offset-4"
          >
            Coba lagi
          </a>
        </div>

        <p
          v-if="gagalProfil"
          data-testid="personal-pesan-gagal-profil"
          class="text-sm text-destructive"
          aria-live="polite"
        >
          Profile gagal dimuat — periksa koneksi lalu coba lagi.
        </p>

        <dl v-else-if="profil" class="flex flex-col divide-y">
          <div
            v-for="baris in barisProfil"
            :key="baris.label"
            class="flex items-baseline justify-between gap-4 py-2"
          >
            <dt class="text-sm text-muted-foreground">
              {{ baris.label }}
            </dt>
            <dd class="text-sm font-medium">
              {{ baris.nilai.length > 0 ? baris.nilai : '—' }}
            </dd>
          </div>
        </dl>

        <!-- State kosong Profile — juga tampil saat gagal muat (kontrak ATDD). -->
        <div
          v-if="!profil"
          data-testid="personal-status-kosong"
          class="flex items-center justify-center rounded-lg border border-dashed p-6 text-center"
        >
          <p class="text-sm text-muted-foreground">
            Belum ada data profile untuk ditampilkan.
          </p>
        </div>
      </section>

      <!-- Section 2: Portofolio & status Pesanan Pembelian — state kosong (Epic 3). -->
      <section data-testid="personal-section-portofolio" class="flex flex-col gap-3 rounded-lg border p-4">
        <h2 class="text-lg font-semibold">Portofolio &amp; Pesanan Pembelian</h2>
        <div
          data-testid="personal-status-kosong"
          class="flex flex-1 items-center justify-center rounded-lg border border-dashed p-6 text-center"
        >
          <p class="text-sm text-muted-foreground">
            Belum ada portofolio — status Pesanan Pembelian Anda tampil di sini.
          </p>
        </div>
      </section>

      <!-- Section 3: Harga berjalan & RKAP — tautan state kosong non-aktif (Epic 2). -->
      <section data-testid="personal-section-harga-rkap" class="flex flex-col gap-3 rounded-lg border p-4">
        <h2 class="text-lg font-semibold">Harga Berjalan &amp; RKAP</h2>
        <ul class="flex flex-col gap-2">
          <li>
            <a role="link" aria-disabled="true" class="text-sm text-muted-foreground">
              Harga Berjalan
            </a>
          </li>
          <li>
            <a role="link" aria-disabled="true" class="text-sm text-muted-foreground">
              RKAP
            </a>
          </li>
        </ul>
        <p class="text-xs text-muted-foreground">
          Harga berjalan dan tabel RKAP terbuka mengikuti matriks keterbukaan — datanya menyusul.
        </p>
      </section>

      <!-- Section 4: pintu Pesanan Pembelian — non-aktif + keterangan (Epic 3).
           HANYA untuk yang belum pernah membeli — keterangan non-aktifnya
           menyasar Pembelian Pertama (keputusan owner 2026-09-21: pemegang
           saham/COO tidak melihat section ini). -->
      <section
        v-if="profil !== null && !sudahPernahBeli"
        class="flex flex-col gap-3 rounded-lg border p-4"
      >
        <h2 class="text-lg font-semibold">Pesanan Pembelian</h2>
        <div>
          <button
            type="button"
            data-testid="personal-pintu-pesanan"
            disabled
            class="flex min-h-11 flex-col items-start gap-1 rounded-md border px-4 py-2 text-left opacity-60"
          >
            <span class="text-sm font-medium">Ajukan Pesanan Pembelian</span>
            <span class="text-xs font-normal text-muted-foreground">
              Terbuka saat pembelian pertama dibuka
            </span>
          </button>
        </div>
      </section>
    </main>
  </div>
</template>
