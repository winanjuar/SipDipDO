<script setup lang="ts">
/**
 * Halaman Login publik (UX-DR3/DR15): lockup logo 80px terpusat + tagline +
 * SATU CTA Google + tautan pendaftaran (Story 1.4, copy re-negotiasi owner
 * 2026-09-18): "Belum jadi pemilik? Yuk Gabung!" untuk pengunjung anonim;
 * pesan unlinked "Akun tidak ditemukan." + tautan "Lakukan pendaftaran"
 * menaut ke /register?src=fresh — halaman pendaftaran menyajikan
 * presentasi FRESH (sesi sisa login gagal dianggap belum pernah OAuth,
 * keputusan owner 2026-09-18). Halaman TIDAK terproteksi (auth: false) —
 * tanpa navigasi app (Story 1.7). Kegagalan/batal OAuth (callback Google
 * menempel `?error=…`) kembali ke halaman ini tanpa crash, dengan
 * pemberitahuan netral (tanpa pesan menyesatkan).
 *
 * Query param DIPATENKAN hanya `res` (keputusan owner 2026-09-18):
 * `res=unlinked` (akun tidak ditemukan) / `res=error` (OAuth gagal/batal).
 * Penanda `?error=` otomatis dari authjs DITRANSLASI sekali saat hidrasi
 * menjadi `res=error`; key lain dibuang.
 */
definePageMeta({ auth: false })

const { signIn } = useAuth()
const route = useRoute()
const router = useRouter()

const unlinked = computed(() => route.query.res === 'unlinked')
/** `res=error` ATAU penanda `?error=` authjs yang belum sempat ditranslasi
 *  (SSR render dengan URL mentah) — pemberitahuan netral. */
const errorOAuth = computed(() => route.query.res === 'error' || route.query.error !== undefined)

/** Whitelist query param /login — hanya `res` yang sah. */
const QUERY_PARAM_SAH: ReadonlySet<string> = new Set(['res'])

onMounted(() => {
  const resBaru = route.query.res ?? (route.query.error !== undefined ? 'error' : undefined)
  const bersih = Object.fromEntries(
    Object.entries(route.query).filter(([kunci]) => QUERY_PARAM_SAH.has(kunci)),
  )
  if (resBaru !== undefined) bersih.res = resBaru
  const sama = Object.keys(route.query).length === Object.keys(bersih).length && route.query.res === bersih.res
  if (sama) return
  void router.replace({ query: bersih })
})

async function masukGoogle() {
  // Flag alert "Masuk berhasil." — dikonsumsi halaman landing pertama
  // (useSekaliAlertMasuk) agar konfirmasi terbaca di halaman berikutnya.
  tandaiMasukBerhasil()
  await signIn('google', { callbackUrl: '/' })
}

useHead({ title: 'Masuk — Sip & Dip' })
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4 py-10 text-center">
    <section class="flex flex-col items-center gap-3">
      <h1 class="text-lg font-semibold">Selamat Datang, Pemilik</h1>
      <div data-testid="login-brand-logo" class="flex flex-col items-center gap-2">
        <BrandLogo size="login" />
      </div>
      <p class="text-sm italic text-muted-foreground">sip the taste, dip the soul</p>
      <p class="text-sm text-muted-foreground">
        gunakan <b>akun Google</b> Anda
      </p>
    </section>

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
        <NuxtLink to="/register?src=fresh" class="font-medium text-primary underline underline-offset-4">Lakukan pendaftaran</NuxtLink>
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
        <NuxtLink data-testid="login-tautan-daftar" to="/register" class="font-medium text-primary underline underline-offset-4">Yuk Gabung!</NuxtLink>
      </p>
    </div>
  </main>
</template>
