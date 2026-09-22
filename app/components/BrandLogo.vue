<script lang="ts">
/**
 * BrandLogo (DESIGN.md `brand-logo`): dua varian aset (keputusan owner
 * 2026-09-21) — `publik` = emblem asli `logo.png` (halaman Login &
 * Pendaftaran, pin UX-DR3 lockup 80px); `app` = `logo-app.png` (landscape,
 * background transparan — sidebar & header setelah login). TIDAK di-recolor,
 * tidak distretch, tanpa bayangan; hanya di atas latar putih/near-white
 * (light-only). Ukuran terpin kontrak: 32px di header/sidebar app, 80px
 * terpusat di halaman publik.
 */
export const BRAND_LOGO_PX = { header: 32, login: 80 } as const
export type BrandLogoSize = keyof typeof BRAND_LOGO_PX

/** Aset statis `public/` — dirujuk sebagai URL (bukan Vite import). */
export const BRAND_LOGO_SRC = {
  publik: '/logo.png',
  app: '/logo-app.png',
} as const
export type BrandLogoVariant = keyof typeof BRAND_LOGO_SRC
</script>

<script setup lang="ts">
const props = withDefaults(defineProps<{ size?: BrandLogoSize, variant?: BrandLogoVariant }>(), {
  size: 'header',
  variant: 'publik',
})

/**
 * Logo asli berbanding aspek non-persegi — tinggi dipin, lebar `auto` agar
 * rasio asli terjaga (tanpa distretch).
 */
const tinggiPx = `${BRAND_LOGO_PX[props.size]}px`
</script>

<template>
  <img
    :src="BRAND_LOGO_SRC[variant]"
    alt="Logo Sip & Dip"
    :style="{ height: tinggiPx, width: 'auto' }"
  >
</template>
