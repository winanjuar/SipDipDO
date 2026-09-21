<script setup lang="ts">
/**
 * AppSidebar — navigasi kiri desktop ≥lg (Story 1.7, UX-DR14): item dari
 * registry `itemNavigasi(role, aksesPenuh)` — item terkunci tidak pernah
 * dirender; item aktif `aria-current="page"`; logo 32px TANPA tagline,
 * ketuk → landing role. Logo = tautan ASLI (semantik link utuh — review
 * Story 1.7: tanpa `role="button"`) diletakkan DI LUAR `<nav>` item, sementara
 * testid `nav-sidebar` menempel pembungkusnya agar kontrak ATDD "TEPAT N
 * item registry" terukur pada `<nav>` item (scoping `getByRole('navigation')`).
 *
 * Footer sidebar (keputusan owner 2026-09-21): chip email sesi + tombol
 * "Keluar" — logout = aksi sesi (bukan permukaan registry); label "Keluar"
 * dipilih owner (status kepemilikan "Keluar" terpisah — tak mungkin sekali
 * klik tanpa proses jual saham).
 */
import { LogOut } from '@lucide/vue'
import type { ItemNavigasi } from '#shared/domain/identity'

defineProps<{
  items: readonly ItemNavigasi[]
  landingPath: string
  email: string | null
}>()

const route = useRoute()
const { signOut } = useAuth()

/** Item halaman aktif — path persis sama (registry path = rute halaman). */
const aktif = (path: string): boolean => route.path === path

/** Akhiri sesi — authjs menghapus cookie sesi lalu redirect ke /login. */
async function keluarAplikasi(): Promise<void> {
  await signOut({ callbackUrl: '/login' })
}
</script>

<template>
  <div data-testid="nav-sidebar" class="hidden w-56 shrink-0 flex-col border-r bg-background lg:flex">
    <NuxtLink
      :to="landingPath"
      data-testid="login-brand-logo"
      class="flex min-h-11 items-center gap-2 rounded-md p-4"
      aria-label="Ke halaman utama"
    >
      <BrandLogo size="header" variant="app" />
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

    <div class="mt-auto flex flex-col gap-1 border-t p-2">
      <span
        v-if="email"
        class="truncate px-2 text-xs text-muted-foreground"
        :title="email"
      >{{ email }}</span>
      <button
        type="button"
        data-testid="nav-tombol-keluar"
        class="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
        @click="keluarAplikasi"
      >
        <LogOut class="size-4 shrink-0" />
        Keluar
      </button>
    </div>
  </div>
</template>
