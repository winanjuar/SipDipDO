<script setup lang="ts">
/**
 * PhaseCreateDialog — Dialog untuk COO membuat fase RKAP baru.
 *
 * Fitur utama (Req-5, Req-14):
 * - Input nama fase (wajib)
 * - Dropdown MoM final (wajib, hanya MoM berstatus final dapat dipilih — Req-14)
 * - Section untuk menambah Capital Items awal dengan:
 *   - Nama item
 *   - Selector jenis modal (Tetap/Bergerak)
 *   - Input Initial Requirement (nilai rupiah)
 * - Tombol Submit untuk membuat fase
 * - Tombol Batal untuk membatalkan
 * - Validasi form dan penanganan error
 *
 * Flow:
 * 1. POST /api/rkap/fase → buat fase
 * 2. Untuk setiap initial item, POST /api/rkap/fase/[id]/items dengan isInitialItem=true
 *
 * Note: Endpoint items.post.ts menggunakan isInitialItem=false. Untuk initial items
 * yang dibuat bersamaan dengan fase, kita perlu menambah endpoint baru atau
 * memodifikasi flow. Saat ini, initial items akan ditambahkan setelah fase dibuat.
 *
 * **Validates: Requirements 5, 14**
 */
import type { MomWire } from '#shared/domain/mom'
import type { CapitalType, RkapPhaseWire } from '#shared/domain/rkap'
import { formatTanggalSingkat, formatRupiah } from '~/lib/harga'
import { computed, ref, reactive, onMounted, watch } from 'vue'

// ---------------------------------------------------------------------------
// Props & Emits
// ---------------------------------------------------------------------------

const props = defineProps<{
  /** Apakah dialog terbuka */
  open?: boolean
}>()

const emit = defineEmits<{
  /** Emitted saat dialog ditutup (batal atau sukses) */
  (e: 'update:open', value: boolean): void
  /** Emitted setelah fase berhasil dibuat */
  (e: 'created', phase: RkapPhaseWire): void
}>()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Label untuk jenis modal dalam Bahasa Indonesia */
const CAPITAL_TYPE_OPTIONS: { value: CapitalType; label: string }[] = [
  { value: 'tetap', label: 'Tetap' },
  { value: 'bergerak', label: 'Bergerak' },
]

/** Input item untuk pembuatan awal */
interface InitialItemInput {
  id: string
  name: string
  capitalType: CapitalType
  requirement: string
}

// ---------------------------------------------------------------------------
// MoM Data Loading
// ---------------------------------------------------------------------------

interface MomListResponse {
  data: MomWire[]
}

const momList = ref<MomWire[]>([])
const momLoading = ref(true)
const momError = ref('')

async function loadFinalMoms() {
  try {
    const result = await $fetch<MomListResponse>('/api/mom?status=final')
    momList.value = result.data
    momError.value = ''
  } catch {
    momError.value = 'Gagal memuat daftar MoM.'
  } finally {
    momLoading.value = false
  }
}

// Load MoMs when dialog opens
watch(() => props.open, (isOpen) => {
  if (isOpen && momList.value.length === 0) {
    loadFinalMoms()
  }
}, { immediate: true })

// ---------------------------------------------------------------------------
// Form State
// ---------------------------------------------------------------------------

const formName = ref('')
const formMomId = ref('')
const initialItems = ref<InitialItemInput[]>([])

const menyimpan = ref(false)
const pesanError = ref('')

/** Counter untuk ID unik item */
let itemIdCounter = 0

/**
 * Normalisasi input rupiah id-ID ke format kanonik.
 * Menerima: "52.000" atau "52000" atau "52.000,50" atau "52000.50"
 * Mengembalikan: "52000.00" atau "52000.50"
 */
function normalizeRupiahInput(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''

  // Check if it's id-ID format (has dot as thousands separator, comma as decimal)
  // Pattern: digits with optional dots as thousands separator, optional comma + decimals
  const idIdPattern = /^[\d.]+(?:,\d+)?$/
  const canonicalPattern = /^\d+(?:\.\d+)?$/
  /** Panjang digit per kelompok ribuan di format id-ID (mis. 52.000). */
  const PANJANG_KELOMPOK_RIBUAN = 3

  if (idIdPattern.test(trimmed) && trimmed.includes('.') && !trimmed.includes(',')) {
    // Could be id-ID thousands separator (52.000) or canonical decimal (52000.50)
    // If dots are in groups of 3, treat as id-ID thousands separator
    const parts = trimmed.split('.')
    const isThousandsSeparator = parts.length > 1 && parts.slice(1).every(p => p.length === PANJANG_KELOMPOK_RIBUAN)
    if (isThousandsSeparator) {
      // id-ID format without decimals: "52.000" -> "52000.00"
      return parts.join('') + '.00'
    }
    // Canonical format: "52000.50" -> "52000.50"
    return trimmed
  }

  if (trimmed.includes(',')) {
    // id-ID format with decimal: "52.000,50" -> "52000.50"
    const normalized = trimmed.replace(/\./g, '').replace(',', '.')
    return normalized
  }

  if (canonicalPattern.test(trimmed)) {
    // Pure number without separators: "52000" -> "52000.00"
    if (!trimmed.includes('.')) {
      return trimmed + '.00'
    }
    return trimmed
  }

  // Return as-is, let server validate
  return trimmed
}

// ---------------------------------------------------------------------------
// Initial Items Management
// ---------------------------------------------------------------------------

function tambahItem() {
  initialItems.value.push({
    id: `temp-${++itemIdCounter}`,
    name: '',
    capitalType: 'tetap',
    requirement: '',
  })
}

function hapusItem(index: number) {
  initialItems.value.splice(index, 1)
}

// ---------------------------------------------------------------------------
// Form Submission
// ---------------------------------------------------------------------------

async function submitForm() {
  pesanError.value = ''

  // Client-side validation
  if (!formName.value.trim()) {
    pesanError.value = 'Nama fase wajib diisi.'
    return
  }
  if (!formMomId.value) {
    pesanError.value = 'MoM referensi wajib dipilih.'
    return
  }

  // Validate initial items if any
  for (let i = 0; i < initialItems.value.length; i++) {
    const item = initialItems.value[i]
    if (!item) continue // Safety check for TypeScript
    if (!item.name.trim()) {
      pesanError.value = `Nama item #${i + 1} wajib diisi.`
      return
    }
    if (!item.requirement.trim()) {
      pesanError.value = `Nilai kebutuhan item #${i + 1} wajib diisi.`
      return
    }
  }

  menyimpan.value = true

  try {
    // 1. Create phase
    const phase = await $fetch<RkapPhaseWire>('/api/rkap/fase', {
      method: 'POST',
      body: {
        name: formName.value.trim(),
        momId: formMomId.value,
      },
    })

    // 2. Add initial items (if any)
    // Note: These are initial items, so Initial = Final = requirement
    // The service uses isInitialItem parameter, but we need to call the internal
    // service method. For now, we'll add items through the API which creates
    // them as new items (Initial=0, Final=requirement). This is a known limitation.
    //
    // TODO: Add an API endpoint that supports isInitialItem=true for initial items
    // or modify the create phase endpoint to accept initial items in the request body.
    //
    // Current workaround: Items added here will have Initial=0, Final=requirement.
    // For proper Initial=Final behavior, we need backend changes.
    for (const item of initialItems.value) {
      const normalizedRequirement = normalizeRupiahInput(item.requirement)
      await $fetch(`/api/rkap/fase/${phase.id}/items`, {
        method: 'POST',
        body: {
          name: item.name.trim(),
          capitalType: item.capitalType,
          requirement: normalizedRequirement,
          isInitialItem: true, // Request flag - backend may or may not support this
        },
      })
    }

    // 3. Emit success and close dialog
    emit('created', phase)
    closeDialog()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string; code?: string } }
    if (err.data?.code === 'MOM_NOT_FINAL') {
      pesanError.value = 'MoM yang dipilih harus berstatus final.'
    } else if (err.data?.code === 'VALIDATION') {
      pesanError.value = err.data.message ?? 'Data tidak valid.'
    } else {
      pesanError.value = err.data?.message ?? 'Gagal membuat fase RKAP.'
    }
  } finally {
    menyimpan.value = false
  }
}

// ---------------------------------------------------------------------------
// Dialog Control
// ---------------------------------------------------------------------------

function closeDialog() {
  // Reset form state
  formName.value = ''
  formMomId.value = ''
  initialItems.value = []
  pesanError.value = ''
  itemIdCounter = 0

  emit('update:open', false)
}

// ---------------------------------------------------------------------------
// Computed
// ---------------------------------------------------------------------------

const isFormValid = computed(() => {
  return formName.value.trim() && formMomId.value
})
</script>

<template>
  <ClientOnly>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
      <DialogContent
        class="max-h-[90vh] overflow-hidden sm:max-w-2xl"
        data-testid="phase-create-dialog"
      >
        <DialogHeader>
          <DialogTitle>Buat Fase RKAP Baru</DialogTitle>
          <DialogDescription>
            Buat fase RKAP baru dengan referensi MoM. Anda dapat menambahkan Capital Items awal.
          </DialogDescription>
        </DialogHeader>

        <!-- Scrollable content -->
        <div class="max-h-[60vh] overflow-y-auto pr-2">
          <!-- Error Alert -->
          <Alert v-if="pesanError" variant="destructive" class="mb-4" aria-live="assertive">
            {{ pesanError }}
          </Alert>

          <form
            id="phase-create-form"
            class="flex flex-col gap-6"
            @submit.prevent="submitForm"
          >
            <!-- Phase Name Input -->
            <div class="flex flex-col gap-2">
              <label for="phase-name" class="text-sm font-medium">
                Nama Fase <span class="text-destructive">*</span>
              </label>
              <input
                id="phase-name"
                v-model="formName"
                type="text"
                required
                placeholder="Fase 1 - 2026"
                class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                data-testid="phase-name-input"
              >
            </div>

            <!-- MoM Dropdown -->
            <div class="flex flex-col gap-2">
              <label for="phase-mom" class="text-sm font-medium">
                MoM Referensi <span class="text-destructive">*</span>
              </label>

              <div v-if="momLoading" class="flex h-10 items-center text-sm text-muted-foreground">
                Memuat daftar MoM...
              </div>

              <div v-else-if="momError" class="flex h-10 items-center text-sm text-destructive">
                {{ momError }}
                <button
                  type="button"
                  class="ml-2 text-primary underline underline-offset-4"
                  @click="loadFinalMoms"
                >
                  Coba lagi
                </button>
              </div>

              <div
                v-else-if="momList.length === 0"
                class="flex h-10 items-center text-sm text-muted-foreground"
              >
                Tidak ada MoM final tersedia. Finalkan MoM terlebih dahulu.
              </div>

              <Select v-else v-model="formMomId">
                <SelectTrigger
                  id="phase-mom"
                  class="w-full"
                  data-testid="phase-mom-select"
                >
                  <SelectValue placeholder="Pilih MoM referensi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="mom in momList"
                    :key="mom.id"
                    :value="mom.id"
                  >
                    <span class="flex items-center gap-2">
                      <span class="truncate">{{ mom.title }}</span>
                      <span class="text-xs text-muted-foreground tabular-nums">
                        ({{ formatTanggalSingkat(mom.heldAt) }})
                      </span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              <p class="text-xs text-muted-foreground">
                Keputusan fase RKAP harus tertaut MoM yang sudah difinalkan.
              </p>
            </div>

            <!-- Separator -->
            <div class="border-t pt-4">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-sm font-medium">Capital Items Awal</h3>
                  <p class="text-xs text-muted-foreground">
                    Tambahkan item kebutuhan pemodalan awal (opsional).
                  </p>
                </div>
                <button
                  type="button"
                  class="inline-flex h-8 items-center gap-1 rounded-md border bg-background px-3 text-xs font-medium hover:bg-muted"
                  data-testid="add-item-btn"
                  @click="tambahItem"
                >
                  <span class="text-base">+</span>
                  <span>Tambah Item</span>
                </button>
              </div>
            </div>

            <!-- Initial Items List -->
            <div v-if="initialItems.length > 0" class="flex flex-col gap-4">
              <div
                v-for="(item, index) in initialItems"
                :key="item.id"
                class="relative rounded-lg border p-4"
                :data-testid="`initial-item-${index}`"
              >
                <!-- Remove button -->
                <button
                  type="button"
                  class="absolute right-2 top-2 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  :title="`Hapus item #${index + 1}`"
                  :data-testid="`remove-item-btn-${index}`"
                  @click="hapusItem(index)"
                >
                  <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                <div class="flex flex-col gap-4 pr-6">
                  <div class="text-xs font-medium text-muted-foreground">
                    Item #{{ index + 1 }}
                  </div>

                  <!-- Item Name -->
                  <div class="flex flex-col gap-2">
                    <label :for="`item-name-${index}`" class="text-sm font-medium">
                      Nama Item <span class="text-destructive">*</span>
                    </label>
                    <input
                      :id="`item-name-${index}`"
                      v-model="item.name"
                      type="text"
                      required
                      placeholder="Pembelian Peralatan Dapur"
                      class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      :data-testid="`item-name-input-${index}`"
                    >
                  </div>

                  <!-- Capital Type and Requirement in row on larger screens -->
                  <div class="grid gap-4 sm:grid-cols-2">
                    <!-- Capital Type -->
                    <div class="flex flex-col gap-2">
                      <label :for="`item-type-${index}`" class="text-sm font-medium">
                        Jenis Modal <span class="text-destructive">*</span>
                      </label>
                      <Select v-model="item.capitalType">
                        <SelectTrigger
                          :id="`item-type-${index}`"
                          class="w-full"
                          :data-testid="`item-type-select-${index}`"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            v-for="option in CAPITAL_TYPE_OPTIONS"
                            :key="option.value"
                            :value="option.value"
                          >
                            <span
                              class="rounded-full px-2 py-0.5 text-xs font-medium"
                              :class="option.value === 'tetap'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'"
                            >
                              {{ option.label }}
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <!-- Initial Requirement -->
                    <div class="flex flex-col gap-2">
                      <label :for="`item-req-${index}`" class="text-sm font-medium">
                        Kebutuhan Awal <span class="text-destructive">*</span>
                      </label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          Rp
                        </span>
                        <input
                          :id="`item-req-${index}`"
                          v-model="item.requirement"
                          type="text"
                          inputmode="decimal"
                          required
                          placeholder="50.000.000"
                          class="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm tabular-nums ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          :data-testid="`item-requirement-input-${index}`"
                        >
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Empty state for initial items -->
            <div
              v-else
              class="rounded-lg border border-dashed p-6 text-center"
            >
              <p class="text-sm text-muted-foreground">
                Belum ada Capital Item. Klik "Tambah Item" untuk menambahkan.
              </p>
            </div>
          </form>
        </div>

        <!-- Dialog Footer -->
        <DialogFooter class="mt-4 flex-col gap-2 sm:flex-row">
          <button
            type="button"
            class="flex h-10 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent"
            :disabled="menyimpan"
            data-testid="cancel-btn"
            @click="closeDialog"
          >
            Batal
          </button>
          <button
            type="submit"
            form="phase-create-form"
            :disabled="menyimpan || momLoading || momList.length === 0 || !isFormValid"
            class="flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            data-testid="submit-btn"
          >
            {{ menyimpan ? 'Menyimpan...' : 'Buat Fase' }}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </ClientOnly>
</template>
