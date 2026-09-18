<script setup lang="ts">
/**
 * Halaman Login publik (UX-DR3/DR15): lockup logo 80px terpusat + tagline +
 * SATU CTA Google + tautan pendaftaran (Story 1.4, copy re-negotiasi owner
 * 2026-09-18): "Belum jadi pemilik? Yuk Gabung!" untuk pengunjung anonim;
 * pesan unlinked "Akun tidak ditemukan." + tautan "Lakukan pendaftaran"
 * menaut ke /pendaftaran?dari=login — halaman pendaftaran menyajikan
 * presentasi FRESH (sesi sisa login gagal dianggap belum pernah OAuth,
 * keputusan owner 2026-09-18). Halaman TIDAK terproteksi (auth: false) — tanpa navigasi app (Story 1.7).
 * Kegagalan/batal OAuth (`?error=…` callback Google) kembali ke halaman ini
 * tanpa crash, dengan pemberitahuan netral (tanpa pesan menyesatkan).
 */
definePageMeta({ auth: false })

const { signIn } = useAuth()
const route = useRoute()

const unlinked = computed(() => route.query.state === 'unlinked')
/** Callback Google membawa error (batal/ditolak) — pemberitahuan netral.
 *  query.error bisa berupa array (param berulang) — ambil elemen pertama. */
const errorOAuth = computed(() => {
  const query = route.query.error
  const pertama = Array.isArray(query) ? query[0] : query
  return typeof pertama === 'string' && pertama.length > 0
})

async function masukGoogle() {
  // Flag toast "Masuk berhasil." — dikonsumsi halaman landing pertama
  // (useSekaliToastMasuk) agar konfirmasi terbaca di halaman berikutnya.
  tandaiMasukBerhasil()
  await signIn('google', { callbackUrl: '/' })
}

useHead({ title: 'Masuk — Sip & Dip' })
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4 py-10 text-center">
    <section class="flex flex-col items-center gap-3">
      <div data-testid="login-brand-logo" class="flex flex-col items-center gap-2">
        <BrandLogo size="login" />
      </div>
      <p class="text-sm italic text-muted-foreground">sip the taste, dip the soul</p>
    </section>

    <p class="max-w-sm text-sm text-muted-foreground">
      Selamat datang, gunakan <b>akun Google</b> Anda.
    </p>

    <div class="flex w-full max-w-xs flex-col gap-3">
      <Button
        data-testid="login-cta-google"
        size="lg"
        class="h-11 w-full"
        @click="masukGoogle"
      >
        Masuk
      </Button>

      <p
        v-if="unlinked"
        data-testid="login-pesan-unlinked"
        class="rounded-md border p-3 text-sm leading-relaxed text-foreground"
        aria-live="polite"
      >
        Akun tidak ditemukan. <br>
        <NuxtLink to="/pendaftaran?dari=login" class="font-medium text-primary underline underline-offset-4">Lakukan pendaftaran</NuxtLink>
      </p>

      <p
        v-else-if="errorOAuth"
        class="rounded-md border p-3 text-sm text-muted-foreground"
        aria-live="polite"
      >
        Percobaan masuk belum selesai — silakan coba lagi.
      </p>

      <p v-else class="text-sm text-muted-foreground">
        Belum jadi pemilik?
        <NuxtLink data-testid="login-tautan-daftar" to="/pendaftaran" class="font-medium text-primary underline underline-offset-4">Yuk Gabung!</NuxtLink>
      </p>
    </div>
  </main>
</template>
