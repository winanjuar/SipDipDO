<script lang="ts">
/**
 * BrandLogo (DESIGN.md `brand-logo`): emblem asli `logo.png` — TIDAK
 * di-recolor, tidak distretch, tanpa bayangan; hanya di atas latar putih/
 * near-white (light-only). Ukuran terpin kontrak: 32px di header/sidebar app,
 * 80px terpusat di halaman publik (Login & Pendaftaran Owner).
 */
export const BRAND_LOGO_PX = { header: 32, login: 80 } as const
export type BrandLogoSize = keyof typeof BRAND_LOGO_PX
</script>

<script setup lang="ts">
const props = withDefaults(defineProps<{ size?: BrandLogoSize }>(), { size: 'header' })

/**
 * Logo asli berbanding aspek non-persegi (1946x2200) — tinggi dipin, lebar
 * `auto` agar rasio asli terjaga (tanpa distretch).
 */
const tinggiPx = `${BRAND_LOGO_PX[props.size]}px`
</script>

<template>
  <img
    src="/logo.png"
    alt="Logo Sip & Dip"
    :style="{ height: tinggiPx, width: 'auto' }"
  >
</template>
