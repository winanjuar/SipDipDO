<script setup lang="ts">
import { toast } from 'vue-sonner'

/**
 * Halaman smoke substrat (R-005) — KERANGKA DEV-ONLY, bukan fitur domain:
 * - Smoke NuxtAuth: login Google membentuk session (kredensial via env).
 * - Smoke paritas enam komponen kontrak shadcn DESIGN.md di Nuxt 4:
 *   Dialog, Sheet, Tooltip, Drawer, Input-OTP, Toast.
 * Halaman ini dihapus saat Epic 1 selesai (login nyata = Story 1.2).
 */
const { status, data: session, signIn, signOut } = useAuth()
const otp = ref('')

async function loginGoogle() {
  await signIn('google', { callbackUrl: '/' })
}

function munculkanToast() {
  toast('Tersimpan.', { description: 'Kontrak Toast (vue-sonner) berfungsi.' })
}
</script>

<template>
  <main class="mx-auto flex max-w-3xl flex-col gap-10 p-6">
    <header class="flex flex-col gap-1">
      <h1 class="text-2xl font-semibold">Smoke substrat — Story 1.1</h1>
      <p class="text-sm text-muted-foreground">
        Gerbang R-005: NuxtAuth OAuth Google, paritas komponen kontrak, PWA (lihat README runbook).
      </p>
    </header>

    <!-- 1. NuxtAuth smoke ------------------------------------------------>
    <section data-testid="smoke-auth" class="flex flex-col gap-3 rounded-lg border p-4">
      <h2 class="font-medium">NuxtAuth — OAuth Google</h2>
      <p class="text-sm text-muted-foreground">
        Status sesi: <code data-testid="smoke-auth-status">{{ status }}</code>
        <template v-if="session?.user?.email">
          — <code>{{ session.user.email }}</code>
        </template>
      </p>
      <div class="flex flex-wrap gap-3">
        <button
          type="button"
          data-testid="smoke-auth-signin"
          class="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          @click="loginGoogle"
        >
          Masuk dengan Google
        </button>
        <button
          type="button"
          class="inline-flex h-11 items-center justify-center rounded-md border px-4 text-sm font-medium"
          :disabled="status !== 'authenticated'"
          @click="signOut({ callbackUrl: '/' })"
        >
          Keluar
        </button>
      </div>
    </section>

    <!-- 2. Dialog --------------------------------------------------------->
    <section data-testid="smoke-dialog" class="flex flex-col gap-3 rounded-lg border p-4">
      <h2 class="font-medium">Dialog</h2>
      <Dialog>
        <DialogTrigger as-child>
          <Button variant="outline">Buka Dialog</Button>
        </DialogTrigger>
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dialog kontrak</DialogTitle>
            <DialogDescription>
              Dialog berfungsi interaktif di Nuxt 4 (primitif reka-ui).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose as-child>
              <Button variant="outline">Tutup</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>

    <!-- 3. Sheet ----------------------------------------------------------->
    <section data-testid="smoke-sheet" class="flex flex-col gap-3 rounded-lg border p-4">
      <h2 class="font-medium">Sheet</h2>
      <Sheet>
        <SheetTrigger as-child>
          <Button variant="outline">Buka Sheet</Button>
        </SheetTrigger>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Sheet kontrak</SheetTitle>
            <SheetDescription>Panel samping (nav "Lainnya" mobile memakai ini).</SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <SheetClose as-child>
              <Button variant="outline">Tutup</Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>

    <!-- 4. Tooltip ----------------------------------------------------------->
    <section data-testid="smoke-tooltip" class="flex flex-col gap-3 rounded-lg border p-4">
      <h2 class="font-medium">Tooltip</h2>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="outline">Arahkan ke sini</Button>
          </TooltipTrigger>
          <TooltipContent>Tooltip kontrak berfungsi.</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </section>

    <!-- 5. Drawer ----------------------------------------------------------->
    <section data-testid="smoke-drawer" class="flex flex-col gap-3 rounded-lg border p-4">
      <h2 class="font-medium">Drawer</h2>
      <Drawer>
        <DrawerTrigger as-child>
          <Button variant="outline">Buka Drawer</Button>
        </DrawerTrigger>
        <DrawerContent>
          <div class="mx-auto w-full max-w-sm">
            <DrawerHeader>
              <DrawerTitle>Drawer kontrak</DrawerTitle>
              <DrawerDescription>Panel bawah (Dialog mobile jadi Sheet/Drawer penuh).</DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <DrawerClose as-child>
                <Button>Tutup</Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </section>

    <!-- 6. Input-OTP ----------------------------------------------------------->
    <section data-testid="smoke-input-otp" class="flex flex-col gap-3 rounded-lg border p-4">
      <h2 class="font-medium">Input OTP</h2>
      <InputOTP v-model="otp" :maxlength="6" data-testid="otp-input">
        <InputOTPGroup>
          <InputOTPSlot :index="0" />
          <InputOTPSlot :index="1" />
          <InputOTPSlot :index="2" />
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          <InputOTPSlot :index="3" />
          <InputOTPSlot :index="4" />
          <InputOTPSlot :index="5" />
        </InputOTPGroup>
      </InputOTP>
      <p class="text-sm text-muted-foreground">
        Nilai: <code data-testid="otp-value">{{ otp || '—' }}</code>
      </p>
    </section>

    <!-- 7. Toast ----------------------------------------------------------->
    <section data-testid="smoke-toast" class="flex flex-col gap-3 rounded-lg border p-4">
      <h2 class="font-medium">Toast</h2>
      <Button variant="outline" @click="munculkanToast">
        Tampilkan Toast
      </Button>
    </section>
  </main>
</template>
