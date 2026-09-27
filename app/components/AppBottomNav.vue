<script setup lang="ts">
/**
 * AppBottomNav — navigasi bawah mobile <lg (Story 1.7, UX-DR14): maks
 * `MAKS_ITEM_NAV_MOBILE` (4) item dari registry `itemNavigasi`; item
 * ke-5 dst. masuk Sheet "Lainnya" (shadcn) — pemicunya hanya tampil bila
 * item > 4 (Epic 1 maks 3 item, jadi tak pernah tampil; guard unit menjaga).
 * Item terkunci tidak pernah dirender; item aktif `aria-current="page"`;
 * target sentuh ≥44px (min-h-11). Modal bertumpuk maks 1 tingkat — Sheet
 * ditutup saat item dipilih.
 */
import { MAKS_ITEM_NAV_MOBILE, type ItemNavigasi } from '#shared/domain/identity'

const props = defineProps<{
  items: readonly ItemNavigasi[]
}>()

const route = useRoute()

/** Item halaman aktif — path persis sama (registry path = rute halaman). */
const aktif = (path: string): boolean => route.path === path

/** Item tetap di batang bawah — maksimal MAKS_ITEM_NAV_MOBILE (tanpa magic number). */
const itemTetap = computed(() => props.items.slice(0, MAKS_ITEM_NAV_MOBILE))

/** Item overflow — dirender di dalam Sheet "Lainnya" (UX-DR14). */
const itemLainnya = computed(() => props.items.slice(MAKS_ITEM_NAV_MOBILE))

const lainnyaTerbuka = ref(false)
</script>

<template>
  <nav
    data-testid="nav-batang-bawah"
    aria-label="Navigasi utama"
    class="fixed inset-x-0 bottom-0 z-40 border-t bg-background lg:hidden"
  >
    <ul class="mx-auto flex max-w-lg items-stretch justify-around">
      <li v-for="item in itemTetap" :key="item.path" class="flex-1">
        <NuxtLink
          :to="item.path"
          class="flex min-h-14 flex-col items-center justify-center px-2 py-2 text-xs"
          :aria-current="aktif(item.path) ? 'page' : undefined"
          :class="aktif(item.path) ? 'font-medium text-primary' : 'text-muted-foreground'"
        >
          {{ item.label }}
        </NuxtLink>
      </li>

      <li v-if="itemLainnya.length > 0" class="flex-1">
        <Sheet v-model:open="lainnyaTerbuka">
          <SheetTrigger as-child>
            <button
              type="button"
              class="flex min-h-14 w-full flex-col items-center justify-center px-2 py-2 text-xs text-muted-foreground"
            >
              Lainnya
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" class="gap-4">
            <SheetHeader>
              <SheetTitle>Lainnya</SheetTitle>
              <SheetDescription>Menu lain yang terbuka untuk Anda.</SheetDescription>
            </SheetHeader>
            <ul class="flex flex-col gap-1 pb-6">
              <li v-for="item in itemLainnya" :key="item.path">
                <!-- Ditutup saat dipilih — modal bertumpuk maks 1 tingkat;
                     navigasi tetap jalan lewat href NuxtLink. -->
                <NuxtLink
                  :to="item.path"
                  class="flex min-h-11 items-center rounded-md px-3 py-2 text-sm hover:bg-accent"
                  :aria-current="aktif(item.path) ? 'page' : undefined"
                  @click="lainnyaTerbuka = false"
                >
                  {{ item.label }}
                </NuxtLink>
              </li>
            </ul>
          </SheetContent>
        </Sheet>
      </li>
    </ul>
  </nav>
</template>
