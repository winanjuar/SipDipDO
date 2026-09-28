<script setup lang="ts">
import { LANDING_PATH } from '#shared/domain/identity'
import type { CapitalItemWire, RkapPhaseWire } from '#shared/domain/rkap'
import type { LandingRespons } from '~/lib/landing'

/**
 * Halaman Detail Fase RKAP — menampilkan tabel RKAP dan aksi untuk fase tertentu.
 *
 * Fitur utama:
 * - Tampilkan RkapTable dengan semua Capital Items fase
 * - AdjustmentSummaryCard menampilkan batas, terpakai, sisa penyesuaian
 * - COO dapat: tambah item, adjust Final Requirement, input Utilization, rebalancing
 * - Non-COO: read-only view
 *
 * Query params:
 * - ?tambah=item → Buka ItemAddDialog otomatis
 *
 * **Validates: Requirements 5, 6, 7, 8, 10, 11, 13**
 */
definePageMeta({ layout: 'app', auth: true, key: route => route.fullPath })

const route = useRoute()
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
  await navigateTo(LANDING_PATH.calon_owner)
}

const isCoo = landing && !('unlinked' in landing) && landing.role === 'coo'

// ---------------------------------------------------------------------------
// Data Loading
// ---------------------------------------------------------------------------

const phaseId = route.params.id as string
const HTTP_NOT_FOUND = 404
const HTTP_FORBIDDEN = 403

const phase = ref<RkapPhaseWire | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

async function muatFase() {
  loading.value = true
  error.value = null
  try {
    phase.value = await api<RkapPhaseWire>(`/api/rkap/fase/${phaseId}`)
  } catch (err: unknown) {
    const e = err as { statusCode?: number; data?: { message?: string } }
    if (e.statusCode === HTTP_NOT_FOUND) {
      error.value = 'Fase RKAP tidak ditemukan.'
    } else if (e.statusCode === HTTP_FORBIDDEN) {
      await navigateTo('/personal')
      return
    } else {
      error.value = e.data?.message ?? 'Gagal memuat data fase.'
    }
  } finally {
    loading.value = false
  }
}

// Initial load
if (landing && !('unlinked' in landing) && landing.role !== 'calon_owner') {
  await muatFase()
}

// ---------------------------------------------------------------------------
// Dialog States
// ---------------------------------------------------------------------------

const isAddItemDialogOpen = ref(false)
const isAdjustDialogOpen = ref(false)
const isUtilizationDialogOpen = ref(false)
const isRebalanceDialogOpen = ref(false)

/** Item yang sedang di-adjust atau di-input utilization */
const selectedItem = ref<CapitalItemWire | null>(null)

// Check query params for auto-open dialog
onMounted(() => {
  const tambah = route.query.tambah
  if (tambah === 'item' && isCoo) {
    isAddItemDialogOpen.value = true
  }
})

// ---------------------------------------------------------------------------
// Event Handlers
// ---------------------------------------------------------------------------

async function onItemCreated(_item: CapitalItemWire) {
  await muatFase()
}

async function onItemAdjusted() {
  await muatFase()
}

async function onUtilizationUpdated() {
  await muatFase()
}

async function onRebalanced() {
  await muatFase()
}

function openAdjustDialog(item: CapitalItemWire) {
  selectedItem.value = item
  isAdjustDialogOpen.value = true
}

function openUtilizationDialog(item: CapitalItemWire) {
  selectedItem.value = item
  isUtilizationDialogOpen.value = true
}

useHead({ title: computed(() => phase.value ? `${phase.value.name} — RKAP` : 'Detail Fase — RKAP') })
</script>

<template>
  <main data-testid="rkap-fase-detail" class="mx-auto flex min-h-dvh max-w-7xl flex-col gap-6 px-4 py-8">
    <!-- Loading State -->
    <div
      v-if="loading"
      class="flex flex-1 items-center justify-center rounded-lg border border-dashed p-10"
    >
      <p class="text-sm text-muted-foreground">Memuat data fase RKAP...</p>
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center"
    >
      <p class="text-sm text-destructive">{{ error }}</p>
      <NuxtLink
        to="/rkap"
        class="text-sm font-medium text-primary underline underline-offset-4"
      >
        Kembali ke daftar RKAP
      </NuxtLink>
    </div>

    <!-- Phase Detail -->
    <template v-else-if="phase">
      <!-- Header -->
      <header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            <NuxtLink to="/rkap" class="text-muted-foreground hover:text-foreground">
              <svg class="size-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </NuxtLink>
            <h1 class="text-2xl font-semibold">{{ phase.name }}</h1>
            <span
              class="rounded-full px-2.5 py-1 text-xs font-medium"
              :class="phase.status === 'berjalan'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'"
            >
              {{ phase.status === 'berjalan' ? 'Berjalan' : 'Arsip' }}
            </span>
            <!-- Read-only indicator for non-COO -->
            <span
              v-if="!isCoo"
              class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              data-testid="rkap-readonly-badge"
            >
              Lihat saja
            </span>
          </div>
          <p class="text-sm text-muted-foreground">Referensi MoM: {{ phase.momTitle }}</p>
        </div>

        <!-- Actions for COO -->
        <div v-if="isCoo && phase.status === 'berjalan'" class="flex items-center gap-2">
          <button
            type="button"
            class="flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium hover:bg-muted"
            data-testid="rebalance-btn"
            @click="isRebalanceDialogOpen = true"
          >
            <svg class="size-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3l4 4-4 4"/><path d="M20 7H4"/><path d="M8 21l-4-4 4-4"/><path d="M4 17h16"/></svg>
            <span>Rebalance</span>
          </button>
          <button
            type="button"
            class="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            data-testid="tambah-item-btn"
            @click="isAddItemDialogOpen = true"
          >
            <span class="text-base">+</span>
            <span>Tambah Item</span>
          </button>
        </div>
      </header>

      <!-- Adjustment Summary Card (COO only) -->
      <RkapAdjustmentSummaryCard
        v-if="isCoo && phase.summary"
        :summary="phase.summary"
        data-testid="adjustment-summary"
      />

      <!-- Items Table -->
      <section class="flex flex-col gap-4">
        <div v-if="phase.items.length === 0" class="rounded-lg border border-dashed p-10 text-center">
          <p class="text-sm text-muted-foreground">Belum ada Capital Item di fase ini.</p>
          <button
            v-if="isCoo && phase.status === 'berjalan'"
            type="button"
            class="mt-4 text-sm font-medium text-primary underline underline-offset-4"
            @click="isAddItemDialogOpen = true"
          >
            Tambah Item Pertama
          </button>
        </div>

        <RkapTable
          v-else
          :items="phase.items"
          :is-coo="isCoo ?? false"
          @adjust="openAdjustDialog"
          @utilization="openUtilizationDialog"
        />
      </section>
    </template>

    <!-- Dialogs (COO only) -->
    <template v-if="isCoo && phase">
      <!-- Add Item Dialog -->
      <RkapItemAddDialog
        v-model:open="isAddItemDialogOpen"
        :phase-id="phase.id"
        @created="onItemCreated"
      />

      <!-- Adjust Item Dialog -->
      <RkapItemAdjustDialog
        v-if="selectedItem"
        v-model:open="isAdjustDialogOpen"
        :phase-id="phase.id"
        :item="selectedItem"
        :summary="phase.summary ?? null"
        @saved="onItemAdjusted"
      />

      <!-- Utilization Dialog -->
      <RkapUtilizationDialog
        v-if="selectedItem"
        v-model:open="isUtilizationDialogOpen"
        :phase-id="phase.id"
        :item="selectedItem"
        @saved="onUtilizationUpdated"
      />

      <!-- Rebalance Dialog -->
      <RkapRebalanceDialog
        v-model:open="isRebalanceDialogOpen"
        :phase-id="phase.id"
        :items="phase.items"
        @saved="onRebalanced"
      />
    </template>
  </main>
</template>
