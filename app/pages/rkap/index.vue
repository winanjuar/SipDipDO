<script setup lang="ts">
import { LANDING_PATH } from '#shared/domain/identity'
import type { RkapPhaseStatus, RkapPhaseWire } from '#shared/domain/rkap'
import type { LandingRespons } from '~/lib/landing'

/**
 * Halaman RKAP — menampilkan tabel RKAP dan manajemen fase (Req-5, Req-6).
 *
 * Fitur utama:
 * - Phase selector dropdown: default ke 'berjalan', opsi 'arsip' (AC6)
 * - Empty state "Belum ada fase RKAP." ketika tidak ada fase (UX-DR19)
 * - Read-only untuk non-COO (Req-6 AC1, AC2)
 * - COO dapat edit: tambah fase, tambah item, ubah Final Requirement (Req-6 AC3)
 * - Mobile viewport (<lg): sticky column kiri dengan horizontal scroll
 * - PhaseCreateDialog untuk membuat fase baru dengan initial items (Task 15.1)
 *
 * Role-based visibility (Req-6):
 * - COO: sees "Tambah Fase" button, opens PhaseCreateDialog
 * - Non-COO: read-only view with indicator badge
 *
 * **Validates: Requirements 5, 6, 14**
 */
definePageMeta({ layout: 'app', auth: true, key: route => route.fullPath })

const api = useRequestFetch()

// ---------------------------------------------------------------------------
// Auth & Role Check
// ---------------------------------------------------------------------------

const landing = await api<LandingRespons>('/api/landing').catch(() => null)
if (!landing) {
  await navigateTo('/login')
} else if ('unlinked' in landing) {
  await navigateTo('/login?res=unlinked')
} else if (landing.role === 'calon_owner') {
  // Calon owner tidak boleh akses RKAP — redirect ke landing calon
  await navigateTo(LANDING_PATH.calon_owner)
}

/** Apakah user adalah COO — menentukan visibilitas aksi edit (Req-6) */
const isCoo = landing && !('unlinked' in landing) && landing.role === 'coo'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RkapPhaseRow {
  id: string
  name: string
  status: RkapPhaseStatus
  momId: string
  momTitle: string
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Phase Selector State (Req-5 AC6)
// ---------------------------------------------------------------------------

/** Status filter yang tersedia */
type FilterStatus = 'berjalan' | 'arsip'

const STATUS_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'berjalan', label: 'Fase Berjalan' },
  { value: 'arsip', label: 'Arsip' },
]

/** Status filter aktif — default ke 'berjalan' */
const statusFilter = ref<FilterStatus>('berjalan')

// ---------------------------------------------------------------------------
// Data Loading
// ---------------------------------------------------------------------------

const HTTP_FORBIDDEN = 403

/** Muat daftar fase RKAP dengan filter status. */
async function muatFases(status: FilterStatus): Promise<RkapPhaseRow[]> {
  try {
    return await api<RkapPhaseRow[]>(`/api/rkap/fase?status=${status}`)
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode === HTTP_FORBIDDEN) {
      await navigateTo('/personal')
    }
    return []
  }
}

// Reactive data
const fasesRef = ref<RkapPhaseRow[]>([])
const loading = ref(true)
const error = ref(false)

// Initial load
if (landing && !('unlinked' in landing) && landing.role !== 'calon_owner') {
  try {
    fasesRef.value = await muatFases(statusFilter.value)
    error.value = false
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

// Watch for filter changes
watch(statusFilter, async (newStatus) => {
  loading.value = true
  error.value = false
  try {
    fasesRef.value = await muatFases(newStatus)
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
})

// Computed states
const isEmpty = computed(() => !loading.value && !error.value && fasesRef.value.length === 0)

// ---------------------------------------------------------------------------
// Phase Create Dialog State (Task 15.1)
// ---------------------------------------------------------------------------

/** Apakah PhaseCreateDialog terbuka */
const isCreateDialogOpen = ref(false)

/**
 * Handler setelah fase berhasil dibuat.
 * Memuat ulang daftar fase untuk menampilkan fase baru.
 */
async function onPhaseCreated(phase: RkapPhaseWire) {
  // Muat ulang daftar fase
  loading.value = true
  error.value = false
  try {
    fasesRef.value = await muatFases(statusFilter.value)
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

useHead({ title: 'RKAP — Sip & Dip' })
</script>

<template>
  <main data-testid="rkap-halaman" class="mx-auto flex min-h-dvh max-w-7xl flex-col gap-6 px-4 py-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-semibold">RKAP</h1>
          <!-- Read-only indicator for non-COO users (Req-6 AC1, AC2) -->
          <span
            v-if="!isCoo"
            class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            data-testid="rkap-readonly-badge"
          >
            Lihat saja
          </span>
        </div>
        <p class="text-sm text-muted-foreground">Rencana Kebutuhan Awal Pemodalan.</p>
      </div>

      <div class="flex items-center gap-3">
        <!-- Phase Selector (Req-5 AC6) -->
        <ClientOnly>
          <Select v-model="statusFilter">
            <SelectTrigger
              data-testid="rkap-status-filter"
              class="w-[180px]"
            >
              <SelectValue placeholder="Pilih status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in STATUS_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <!-- SSR Fallback: simple text showing current filter -->
          <template #fallback>
            <div class="flex h-10 w-[180px] items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
              <span>{{ statusFilter === 'berjalan' ? 'Fase Berjalan' : 'Arsip' }}</span>
              <svg class="size-4 opacity-50" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          </template>
        </ClientOnly>

        <!-- Add Phase Button (COO only) (Req-6 AC3) — Opens PhaseCreateDialog -->
        <button
          v-if="isCoo"
          type="button"
          class="flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          data-testid="tambah-fase-btn"
          @click="isCreateDialogOpen = true"
        >
          <span class="text-lg">+</span>
          <span>Tambah Fase</span>
        </button>
      </div>
    </header>

    <!-- Loading State -->
    <div
      v-if="loading"
      class="flex flex-1 items-center justify-center rounded-lg border border-dashed p-10"
    >
      <p class="text-sm text-muted-foreground">Memuat data RKAP...</p>
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center"
    >
      <p class="text-sm text-muted-foreground">Gagal memuat data RKAP.</p>
      <button
        type="button"
        class="text-sm font-medium text-primary underline underline-offset-4"
        @click="() => { loading = true; muatFases(statusFilter).then(d => { fasesRef = d; error = false }).catch(() => { error = true }).finally(() => { loading = false }) }"
      >
        Coba lagi
      </button>
    </div>

    <!-- Empty State (UX-DR19) -->
    <section
      v-else-if="isEmpty"
      data-testid="rkap-kosong"
      class="flex flex-1 items-center justify-center rounded-lg border border-dashed p-10 text-center"
    >
      <p class="text-sm text-muted-foreground">
        {{ statusFilter === 'berjalan' ? 'Belum ada fase RKAP.' : 'Tidak ada fase arsip.' }}
      </p>
    </section>

    <!-- Phase List -->
    <template v-else>
      <!-- Adjustment Summary Card will be added in task 14.3 -->
      <!-- <AdjustmentSummaryCard :summary="..." :is-coo="isCoo" /> -->

      <!-- Phase Cards / Table Container -->
      <section class="flex flex-col gap-4">
        <!-- Phase cards - each will link to detail view -->
        <div
          v-for="fase in fasesRef"
          :key="fase.id"
          class="rounded-lg border p-4"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 min-w-0">
              <NuxtLink
                :to="`/rkap/fase/${fase.id}`"
                class="text-lg font-medium hover:underline underline-offset-4"
              >
                {{ fase.name }}
              </NuxtLink>
              <p class="mt-1 text-sm text-muted-foreground truncate">
                Referensi: {{ fase.momTitle }}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <span
                class="rounded-full px-2.5 py-1 text-xs font-medium"
                :class="fase.status === 'berjalan'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'"
              >
                {{ fase.status === 'berjalan' ? 'Berjalan' : 'Arsip' }}
              </span>
              <!-- Add Item Button (COO only, for running phases) (Req-6 AC3, Req-8) -->
              <NuxtLink
                v-if="isCoo && fase.status === 'berjalan'"
                :to="`/rkap/fase/${fase.id}?tambah=item`"
                class="inline-flex h-8 items-center gap-1 rounded-md border bg-background px-2 text-xs font-medium hover:bg-muted"
                data-testid="tambah-item-btn"
                title="Tambah Capital Item"
              >
                <span class="text-base">+</span>
                <span>Item</span>
              </NuxtLink>
            </div>
          </div>

          <!-- RkapTable will be integrated here in task 14.2 -->
          <!-- Usage: <RkapTable :items="fase.items" :is-coo="isCoo" :phase-id="fase.id" @adjust="..." @utilization="..." /> -->
          <!-- The table will show items with: nama, jenis modal, Initial Requirement, 
               Final Requirement, Fulfillment, Fulfillment Rate, Shortfall, 
               Utilization, Achievement, Held -->
          <!-- Mobile viewport (<lg) will have sticky left column with horizontal scroll -->
          <!-- COO users will see action column with adjust and utilization buttons (Req-6 AC3) -->
        </div>
      </section>
    </template>

    <!-- Phase Create Dialog (Task 15.1) -->
    <RkapPhaseCreateDialog
      v-if="isCoo"
      v-model:open="isCreateDialogOpen"
      @created="onPhaseCreated"
    />
  </main>
</template>
