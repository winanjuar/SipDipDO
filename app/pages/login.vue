<script setup lang="ts">
/**
 * Halaman Login publik (UX-DR3/DR15): lockup logo 80px terpusat + tagline +
 * SATU CTA Google. Akun Google belum terhubung (`?state=unlinked`) → pesan
 * arahan verbatim. Halaman TIDAK terproteksi (auth: false) — tanpa navigasi
 * app (Story 1.7). Kegagalan/batal OAuth (`?error=…` callback Google) kembali
 * ke halaman ini tanpa crash, dengan pemberitahuan netral (tanpa pesan
 * menyesatkan).
 */
definePageMeta({ auth: false })

const { signIn } = useAuth()
const route = useRoute()

/** Pesan arahan verbatim UX-DR15 — teks kontrak, tidak boleh diubah. */
const PESAN_UNLINKED =
  'Akun Google ini belum terhubung. Pendaftar: lanjutkan pendaftaran. '
  + 'Owner eksisting: hubungi COO untuk pencocokan email migrasi.'

const unlinked = computed(() => route.query.state === 'unlinked')
/** Callback Google membawa error (batal/ditolak) — pemberitahuan netral.
 *  query.error bisa berupa array (param berulang) — ambil elemen pertama. */
const errorOAuth = computed(() => {
  const query = route.query.error
  const pertama = Array.isArray(query) ? query[0] : query
  return typeof pertama === 'string' && pertama.length > 0
})

async function masukGoogle() {
  await signIn('google', { callbackUrl: '/' })
}

useHead({ title: 'Masuk — Sip & Dip' })
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-4 py-10 text-center">
    <section class="flex flex-col items-center gap-3">
      <div data-testid="login-brand-logo" class="flex flex-col items-center gap-2">
        <BrandLogo size="login" />
        <p class="text-xl font-semibold text-primary">Sip &amp; Dip</p>
      </div>
      <p class="text-sm italic text-muted-foreground">Sip the taste, dip the soul</p>
    </section>

    <p class="max-w-sm text-sm text-muted-foreground">
      Masuk dengan akun Google Anda untuk membuka dashboard kepemilikan saham.
    </p>

    <div class="flex w-full max-w-xs flex-col gap-3">
      <Button
        data-testid="login-cta-google"
        size="lg"
        class="h-11 w-full"
        @click="masukGoogle"
      >
        Masuk dengan Google
      </Button>

      <p
        v-if="unlinked"
        data-testid="login-pesan-unlinked"
        class="rounded-md border p-3 text-sm leading-relaxed text-foreground"
        aria-live="polite"
      >
        {{ PESAN_UNLINKED }}
      </p>

      <p
        v-else-if="errorOAuth"
        class="rounded-md border p-3 text-sm text-muted-foreground"
        aria-live="polite"
      >
        Percobaan masuk belum selesai — silakan coba lagi.
      </p>
    </div>
  </main>
</template>
