<script setup lang="ts">
import type { LandingRespons } from '~/lib/landing'
import { HTTP_SERVER_ERROR, HTTP_UNAUTHORIZED } from '~/lib/landing'

/**
 * Resolver landing SSR (UX-DR14) — redirect murni, tanpa konten:
 * tanpa sesi → `/login`; sesi unlinked → `/login?state=unlinked` (pesan
 * arahan + tautan pendaftaran — ke /pendaftaran HANYA via klik tautan);
 * selain itu `navigateTo(path)` dari `/api/landing` (keputusan dievaluasi
 * server-side, AD-8 — klien hanya meneruskan). Kerangka scaffold Story 1.1
 * digantikan.
 */
definePageMeta({ auth: false })

const api = useRequestFetch()

try {
  const landing = await api<LandingRespons>('/api/landing', {
    // Cegah payload/cache browser mengembalikan hasil lama (mis. unlinked
    // dari sesi sebelumnya) untuk kunjungan anonim — selalu segar.
    cache: 'no-store',
    headers: { 'cache-control': 'no-store' },
  } as never)
  if ('unlinked' in landing) {
    await navigateTo('/login?state=unlinked')
  } else {
    await navigateTo(landing.path)
  }
} catch (error) {
  // HANYA 401 yang berarti belum login — error lain (5xx/DB mati) diteruskan
  // ke error page, jangan tersamar menjadi redirect login.
  const statusCode = (error as { statusCode?: number } | null | undefined)?.statusCode
  if (statusCode !== HTTP_UNAUTHORIZED) {
    throw createError({ statusCode: statusCode ?? HTTP_SERVER_ERROR, statusMessage: 'Gagal menentukan halaman landing.', cause: error })
  }
  await navigateTo('/login')
}
</script>

<template>
  <div />
</template>
