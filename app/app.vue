<script setup lang="ts">
// Cangkang aplikasi — kerangka scaffold (Story 1.1). Layout "app" (sidebar +
// bottom nav role-based) hadir sejak Story 1.7; halaman domain mulai Story 1.2.

// Kontrak UX/WCAG: dokumen berbahasa Indonesia; title dasar (halaman
// spesifik meng-override via useHead di halamannya masing-masing).
useHead({
  htmlAttrs: { lang: 'id' },
  title: 'Sip & Dip Owner Dashboard',
})
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <!-- Manifest PWA di-inject via komponen (SSR — tidak ada index.html statis). -->
    <NuxtPwaManifest />
    <!-- Prompt pembaruan PWA (AD-12: registerType 'prompt', tanpa auto-reload). -->
    <PwaUpdatePrompt />
    <!-- NuxtLayout sejak Story 1.7 — meta `layout: 'app'` halaman ber-nav
         (dashboard/personal/antrian-beli/audit-trail) kini benar-benar
         dirender; halaman tanpa meta layout memakai default (slot apa adanya —
         tidak ada app/layouts/default.vue). -->
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <!-- Toast (vue-sonner) dipasang sekali di cangkang — dipakai seluruh app. -->
    <Toaster />
  </div>
</template>
