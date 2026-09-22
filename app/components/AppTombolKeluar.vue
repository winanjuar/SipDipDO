<script setup lang="ts">
/**
 * AppTombolKeluar — tombol "Keluar" + Dialog konfirmasi (keputusan owner
 * 2026-09-21): dipakai header mobile layout "app", baris wayfinding halaman
 * calon (registration-status / profile-completeness — kedua halaman itu
 * tidak memakai layout ber-nav, sehingga butuh pintu logout sendiri), DAN
 * footer sidebar desktop (Story 2.1b, varian 'teks' — konsistensi konfirmasi
 * sebelum logout di semua permukaan, keputusan owner 2026-09-22).
 * Logout = aksi sesi (bukan permukaan registry): authjs menghapus cookie
 * sesi lalu redirect ke /login. Testid memakai kontrak ATDD yang sudah ada.
 */
import { LogOut } from '@lucide/vue'

const props = withDefaults(defineProps<{
  /** 'ikon' = icon-button header mobile/wayfinding; 'teks' = tombol lebar
   *  footer sidebar (LogOut + label — tampilan eksisting sidebar). */
  varian?: 'ikon' | 'teks'
}>(), {
  varian: 'ikon',
})

const { signOut } = useAuth()

const keluarTerbuka = ref(false)

/** Akhiri sesi — authjs menghapus cookie sesi lalu redirect ke /login. */
async function keluarAplikasi(): Promise<void> {
  keluarTerbuka.value = false
  await signOut({ callbackUrl: '/login' })
}
</script>

<template>
  <Dialog v-model:open="keluarTerbuka">
    <DialogTrigger as-child>
      <!-- Varian 'teks' — footer sidebar desktop; testid kontrak ATDD
           `nav-tombol-keluar` (eksisting sidebar, terpin e2e desktop). -->
      <button
        v-if="props.varian === 'teks'"
        type="button"
        data-testid="nav-tombol-keluar"
        class="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <LogOut class="size-4 shrink-0" />
        Keluar
      </button>
      <!-- Varian 'ikon' (default) — header ringkas mobile & wayfinding calon;
           testid kontrak ATDD `nav-tombol-keluar-mobile`. -->
      <button
        v-else
        type="button"
        data-testid="nav-tombol-keluar-mobile"
        aria-label="Keluar"
        class="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <LogOut class="pointer-events-none size-5" />
      </button>
    </DialogTrigger>
    <!-- Tanpa tombol X bawaan (keputusan owner 2026-09-21, selaras modal
         Pendaftaran): penutupan hanya via Batal/Keluar; ESC & klik overlay
         tetap menutup. -->
    <DialogContent data-testid="nav-dialog-keluar" class="max-w-sm" :show-close-button="false">
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
</template>
