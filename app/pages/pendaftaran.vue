<script setup lang="ts">
import { LANDING_PATH } from '#shared/domain/identity'
import type { LandingRespons } from '~/lib/landing'

/**
 * Pendaftaran Owner — halaman PUBLIK (Story 1.4, Flow 6 EXPERIENCE.md).
 * Copy hasil re-negotiasi manual owner 2026-09-18 (menggantikan mockup
 * key-pendaftaran-profile): judul "Jadilah Pemilik" di atas lockup logo
 * 80px + tagline + sub-copy + SATU CTA "Daftar"; footer copy disembunyikan.
 * Tanpa input referral (referral hanya di Pembelian Pertama, Epic 3).
 *
 * Mesin status halaman (SSR, seperti status-pendaftaran.vue): resolver
 * /api/landing menentukan mode — tanpa sesi = anonim (CTA "Daftar" → OAuth
 * Google); sesi unlinked = CTA "Selesaikan Pendaftaran" + status "Akun
 * Google terhubung" (pasca-OAuth halaman TIDAK lagi tampak identik —
 * laporan owner 2026-09-18: klik pertama anonim = OAuth, klik kedua =
 * tulis data) → klik memicu POST /api/pendaftaran lalu redirect
 * /status-pendaftaran; calon/non-calon = redirect landing role-nya. KLIK
 * CTA adalah SATU-SATUNYA pemicu tulis data (keputusan owner 2026-09-18:
 * data masuk DB dari aksi pendaftaran eksplisit, bukan sekadar kunjungan);
 * kegagalan menampilkan pesan envelope di region aria-live="polite" dekat
 * CTA dengan state dipertahankan.
 */
definePageMeta({ auth: false })

const { signIn } = useAuth()
const api = useRequestFetch()

/**
 * Resolver /api/landing dibungkus useAsyncData: hasil SSR dikirim via payload
 * dan TIDAK di-fetch ulang oleh browser saat hidrasi — permintaan anonim tidak
 * pernah menghasilkan 401 di jaringan browser, dan CTA ter-hidrasi tanpa
 * menunggu round-trip (klik dini tetap berfungsi).
 */
const { data: landing } = await useAsyncData('pendaftaran-landing', () =>
  api<LandingRespons>('/api/landing').catch(() => null))

if (landing.value && !('unlinked' in landing.value)) {
  // Calon → halaman status; non-calon → landing role-nya (UX-DR14).
  await navigateTo(LANDING_PATH[landing.value.role])
}

/** Sesi ada (respons { unlinked: true }) → CTA mengajukan pendaftaran; tanpa sesi → OAuth. */
const denganSesi = computed(() => landing.value !== null)

/** Pesan error envelope terakhir — region aria-live dekat CTA; state dipertahankan. */
const pesanError = ref('')
const sedangDaftar = ref(false)
/** true setelah POST sukses — menampilkan konfirmasi lokal sambil hard-navigasi. */
const terdaftar = ref(false)

/** Pesan bawaan bila envelope tidak membawa message yang terbaca. */
const PESAN_GAGAL_DEFAULT = 'Pendaftaran belum terkirim — silakan coba lagi.'

/** Ambil message envelope error seragam `{ code, message, details }`. */
function ambilPesanError(error: unknown): string {
  const data = (error as { data?: { message?: unknown } } | null)?.data
  const pesan = data?.message
  return typeof pesan === 'string' && pesan.length > 0 ? pesan : PESAN_GAGAL_DEFAULT
}

async function daftarGoogle() {
  if (sedangDaftar.value) return
  sedangDaftar.value = true
  pesanError.value = ''
  let sukses = false
  try {
    if (denganSesi.value) {
      await $fetch('/api/pendaftaran', { method: 'POST', body: {} })
      sukses = true
    } else {
      await signIn('google', { callbackUrl: '/pendaftaran' })
    }
  } catch (error) {
    pesanError.value = ambilPesanError(error)
  } finally {
    sedangDaftar.value = false
  }
  if (sukses) {
    // HARD navigation (bukan navigateTo SPA): penuh page-load — kebal race
    // hidrasi/router klien yang pernah membuat pengguna tertinggal di
    // halaman ini pasca-POST sukses (laporan owner 2026-09-18). Flag query
    // memicu toast konfirmasi di halaman status lalu dibersihkan.
    terdaftar.value = true
    window.location.assign('/status-pendaftaran?daftar=berhasil')
  }
}

useHead({ title: 'Pendaftaran — Sip & Dip' })
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-10 text-center">
    <section class="flex flex-col items-center gap-3">
      <h1 class="text-lg font-semibold">Jadilah Pemilik</h1>
      <BrandLogo size="login" />
      <p class="text-sm italic text-muted-foreground">sip the taste, dip the soul</p>
      <p class="text-sm text-muted-foreground">
        dengan <b>akun Google</b> Anda.
      </p>
    </section>

    <div class="mt-6 flex w-full max-w-xs flex-col gap-3">
      <p
        v-if="denganSesi && !terdaftar"
        class="rounded-md border p-3 text-sm leading-relaxed text-foreground"
        aria-live="polite"
      >
        Akun Google Anda sudah terhubung — tinggal satu langkah lagi.
      </p>

      <Button
        size="lg"
        class="h-12 w-full"
        :disabled="sedangDaftar"
        @click="daftarGoogle"
      >
        {{ denganSesi ? 'Selesaikan Pendaftaran' : 'Daftar' }}
      </Button>

      <p
        v-if="pesanError"
        class="rounded-md border border-destructive/30 p-3 text-sm leading-relaxed text-foreground"
        aria-live="polite"
      >
        {{ pesanError }}
      </p>

      <p
        v-if="terdaftar"
        class="rounded-md border border-success/40 bg-success/10 p-3 text-sm leading-relaxed text-foreground"
        aria-live="polite"
      >
        Pendaftaran berhasil diajukan — menuju halaman status…
      </p>

      <!-- <p class="text-xs leading-relaxed text-muted-foreground">
        Pendaftaran terbuka melalui alamat ini — tanpa perlu link referral.<br>
        Status pendaftaran: Diajukan → Terverifikasi / Ditolak (dengan alasan).
      </p> -->
    </div>
  </main>
</template>
