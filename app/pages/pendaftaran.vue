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
 * /api/landing menentukan mode — tanpa sesi = anonim (CTA "Daftar" → modal
 * T&C → OAuth Google); sesi unlinked = CTA "Selesaikan Pendaftaran" +
 * status "Akun Google terhubung" (pasca-OAuth halaman TIDAK lagi tampak
 * identik — laporan owner 2026-09-18: klik pertama anonim = OAuth, klik
 * kedua = tulis data) → modal T&C wajib dicentang → POST
 * /api/pendaftaran lalu hard-redirect /status-pendaftaran; calon/non-calon
 * = redirect landing role-nya. KLIK CTA + KONFIRMASI MODAL adalah
 * SATU-SATUNYA pemicu tulis data (keputusan owner 2026-09-18: data masuk
 * DB dari aksi pendaftaran eksplisit, bukan sekadar kunjungan); kegagalan
 * menampilkan pesan envelope di region aria-live="polite" dekat CTA
 * dengan state dipertahankan.
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

/** Label CTA — pasca-OAuth halaman tidak tampak identik (laporan owner
 *  2026-09-18): anonim = "Daftar" (→ OAuth), unlinked = "Selesaikan
 *  Pendaftaran" (→ POST). */
const labelCta = computed(() => (denganSesi.value ? 'Selesaikan Pendaftaran' : 'Daftar'))

/** Modal konfirmasi T&C (permintaan owner 2026-09-18): KLIK CTA TIDAK
 *  langsung bereaksi — modal wajib dicentang dulu; Batal/tutup = tidak ada
 *  OAuth, tidak ada tulisan DB. Tautan "Syarat & Ketentuan" membuka modal
 *  yang sama (satu sumber — halaman T&C penuh di luar scope 1.4). */
const modalSyaratTerbuka = ref(false)
const syaratDisetujui = ref(false)

function bukaModalSyarat(): void {
  syaratDisetujui.value = false
  modalSyaratTerbuka.value = true
}

function tutupModalSyarat(): void {
  modalSyaratTerbuka.value = false
}

/** Konfirmasi modal → lanjutkan aksi asal (OAuth anonim / POST unlinked). */
function konfirmasiSyarat(): void {
  if (!syaratDisetujui.value) return
  modalSyaratTerbuka.value = false
  void daftarGoogle()
}

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
        @click="bukaModalSyarat"
      >
        {{ labelCta }}
      </Button>

      <p class="text-xs text-muted-foreground">
        Dengan mendaftar Anda menyetujui
        <button
          type="button"
          data-testid="pendaftaran-tautan-syarat"
          class="font-medium text-primary underline underline-offset-4"
          @click="bukaModalSyarat"
        >
          Syarat &amp; Ketentuan
        </button>
        .
      </p>

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

    <Dialog :open="modalSyaratTerbuka" @update:open="modalSyaratTerbuka = $event">
      <DialogContent class="max-w-sm" data-testid="pendaftaran-modal-syarat">
        <DialogHeader>
          <DialogTitle>Konfirmasi Pendaftaran</DialogTitle>
          <DialogDescription>
            Sebelum melanjutkan, mohon setujui hal berikut:
          </DialogDescription>
        </DialogHeader>

        <label class="flex min-h-11 cursor-pointer items-start gap-3 text-left text-sm leading-relaxed">
          <input
            v-model="syaratDisetujui"
            type="checkbox"
            data-testid="pendaftaran-syarat-setuju"
            class="mt-0.5 size-4 shrink-0"
          >
          <span>Saya sudah memahami aturan main owner dan risiko yang mungkin harus ditanggung.</span>
        </label>

        <DialogFooter class="gap-2 sm:justify-center">
          <Button variant="outline" data-testid="pendaftaran-syarat-batal" @click="tutupModalSyarat">
            Batal
          </Button>
          <Button data-testid="pendaftaran-syarat-lanjut" :disabled="!syaratDisetujui" @click="konfirmasiSyarat">
            Lanjutkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </main>
</template>
