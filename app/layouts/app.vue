<script setup lang="ts">
/**
 * Layout "app" — shell permukaan BER-NAV (Story 1.7, UX-DR14): sidebar kiri
 * desktop (≥lg) + header ringkas & bottom nav mobile (<lg). HANYA dipakai
 * halaman dashboard/personal/order-queue/audit-trail — halaman publik &
 * calon (login, register, registration-status, profile-completeness, index,
 * offline, smoke) TIDAK memakai layout ini.
 *
 * Item navigasi REGISTRY-DRIVEN (satu sumber kebenaran dengan gerbang server):
 * role dari endpoint landing eksisting (`/api/landing` — pola resolver
 * halaman); untuk role `tanpa_saham`, akses penuh dinilai predikat kanonik
 * `aksesPenuh()` atas snapshot `GET /api/personal` (AD-8/AD-11 — tidak
 * pernah dari `positions.shares` live). Bila resolver gagal (401/gangguan),
 * nav DISEMBUNYIKAN — item terkunci tidak pernah tampil (UX-DR14).
 * Keputusan halaman/redirect tetap urusan middleware + resolver halaman.
 *
 * Header mobile memuat icon "Keluar" (keputusan owner 2026-09-21) dengan
 * Dialog konfirmasi — logout = aksi sesi, bukan permukaan registry.
 */
import { LogOut } from '@lucide/vue'
import { aksesPenuh, itemNavigasi, type ItemNavigasi } from '#shared/domain/identity'
import type { LandingRespons } from '~/lib/landing'
import type { PersonalRespons } from '~/lib/personal'

const api = useRequestFetch()

/** Email sesi aktif — chip identitas sidebar (dari session authjs). */
const { data: sesiAuth, signOut } = useAuth()
const emailSesi = computed(() => sesiAuth.value?.user?.email ?? null)

/** Dialog konfirmasi keluar (mobile — icon gampang salah sentuh). */
const keluarTerbuka = ref(false)

/** Akhiri sesi — authjs menghapus cookie sesi lalu redirect ke /login. */
async function keluarAplikasi(): Promise<void> {
  keluarTerbuka.value = false
  await signOut({ callbackUrl: '/login' })
}

/** Hasil resolver nav — null = tanpa nav (gagal/unlinked; UX-DR14 aman). */
interface HasilNav {
  items: readonly ItemNavigasi[]
  /** Landing role — tujuan ketukan logo (sidebar & header ringkas). */
  landingPath: string
}

const { data: navigasi } = await useAsyncData('nav-app', async (): Promise<HasilNav | null> => {
  const landing = await api<LandingRespons>('/api/landing').catch(() => null)
  if (!landing || 'unlinked' in landing) return null

  let sudahAksesPenuh = false
  if (landing.role === 'tanpa_saham') {
    const personal = await api<PersonalRespons>('/api/personal').catch(() => null)
    sudahAksesPenuh = personal !== null
      && aksesPenuh({ status: personal.status, firstEffectiveAt: personal.firstEffectiveAt })
  }
  return { items: itemNavigasi(landing.role, sudahAksesPenuh), landingPath: landing.path }
})
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <!-- Header ringkas mobile (<lg): BrandLogo 32px tanpa tagline, ketuk →
         landing role (DESIGN brand; logo 32px di header app) + icon Keluar. -->
    <header
      v-if="navigasi"
      class="flex items-center justify-between border-b px-4 py-2 lg:hidden"
    >
      <NuxtLink
        :to="navigasi.landingPath"
        class="flex min-h-11 items-center rounded-md p-1"
        aria-label="Ke halaman utama"
      >
        <BrandLogo size="header" variant="app" />
      </NuxtLink>

      <Dialog v-model:open="keluarTerbuka">
        <DialogTrigger as-child>
          <button
            type="button"
            data-testid="nav-tombol-keluar-mobile"
            aria-label="Keluar"
            class="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <LogOut class="size-5" />
          </button>
        </DialogTrigger>
        <DialogContent data-testid="nav-dialog-keluar" class="max-w-sm">
          <DialogHeader>
            <DialogTitle>Keluar dari aplikasi?</DialogTitle>
            <DialogDescription>
              Sesi Anda akan diakhiri dan kembali ke halaman masuk.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter class="gap-2">
            <DialogClose as-child>
              <Button variant="outline">
                Batal
              </Button>
            </DialogClose>
            <Button @click="keluarAplikasi">
              Keluar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>

    <div class="flex w-full flex-1">
      <AppSidebar
        v-if="navigasi"
        :items="navigasi.items"
        :landing-path="navigasi.landingPath"
        :email="emailSesi"
      />

      <!-- Padding bawah mobile agar konten tidak tertutup bottom nav tetap. -->
      <div class="min-w-0 flex-1 pb-20 lg:pb-0">
        <slot />
      </div>
    </div>

    <AppBottomNav v-if="navigasi" :items="navigasi.items" />
  </div>
</template>
