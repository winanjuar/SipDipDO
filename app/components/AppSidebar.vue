<script setup lang="ts">
/**
 * AppSidebar — navigasi kiri desktop ≥lg (Story 1.7, UX-DR14): item dari
 * registry `itemNavigasi(role, aksesPenuh)` — item terkunci tidak pernah
 * dirender; item aktif `aria-current="page"`; logo 32px TANPA tagline,
 * ketuk → landing role. Logo = tautan ASLI (semantik link utuh — review
 * Story 1.7: tanpa `role="button"`) diletakkan DI LUAR `<nav>` item, sementara
 * testid `nav-sidebar` menempel pembungkusnya agar kontrak ATDD "TEPAT 3
 * item registry" terukur pada `<nav>` item (scoping `getByRole('navigation')`).
 */
import type { ItemNavigasi } from '#shared/domain/identity'

defineProps<{
  items: readonly ItemNavigasi[]
  landingPath: string
}>()

const route = useRoute()

/** Item halaman aktif — path persis sama (registry path = rute halaman). */
const aktif = (path: string): boolean => route.path === path
</script>

<template>
  <div data-testid="nav-sidebar" class="hidden w-56 shrink-0 flex-col border-r bg-background lg:flex">
    <NuxtLink
      :to="landingPath"
      data-testid="login-brand-logo"
      class="flex min-h-11 items-center gap-2 rounded-md p-4"
      aria-label="Ke halaman utama"
    >
      <BrandLogo size="header" />
    </NuxtLink>

    <nav aria-label="Navigasi utama" class="flex flex-col px-2">
      <ul class="flex flex-col gap-1">
        <li v-for="item in items" :key="item.path">
          <NuxtLink
            :to="item.path"
            class="flex min-h-11 items-center rounded-md px-3 py-2 text-sm hover:bg-accent"
            :aria-current="aktif(item.path) ? 'page' : undefined"
            :class="aktif(item.path) ? 'bg-accent font-medium' : 'text-muted-foreground'"
          >
            {{ item.label }}
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </div>
</template>
