<script setup lang="ts">
/**
 * AppTombolKeluar — icon-button "Keluar" + Dialog konfirmasi (keputusan
 * owner 2026-09-21): dipakai header mobile layout "app" DAN baris wayfinding
 * halaman calon (registration-status / profile-completeness — kedua halaman
 * itu tidak memakai layout ber-nav, sehingga butuh pintu logout sendiri).
 * Logout = aksi sesi (bukan permukaan registry): authjs menghapus cookie
 * sesi lalu redirect ke /login. Testid memakai kontrak ATDD yang sudah ada.
 */
import { LogOut } from '@lucide/vue'

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
      <button
        type="button"
        data-testid="nav-tombol-keluar-mobile"
        aria-label="Keluar"
        class="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <LogOut class="pointer-events-none size-5" />
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
</template>
