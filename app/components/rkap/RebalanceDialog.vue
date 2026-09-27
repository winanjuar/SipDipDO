<script setup lang="ts">
/**
 * RebalanceDialog — Dialog untuk COO melakukan rebalancing Capital Items.
 *
 * Fitur utama (Req-13, Req-14):
 * - Dropdown "Dari Item" (From) untuk memilih item sumber
 * - Dropdown "Ke Item" (To) yang otomatis difilter hanya menampilkan
 *   item dengan jenis modal yang sama (Tetap→Tetap, Bergerak→Bergerak)
 * - Input jumlah (amount) dengan format Rupiah (tabular-nums, Rp prefix)
 * - Dropdown MoM final (wajib, hanya MoM berstatus final — Req-14)
 * - Validasi: amount > 0, amount tidak melebihi Final Requirement item sumber
 * - Zero-sum transfer: total Final Requirement jenis modal tidak berubah
 *
 * Flow:
 * 1. POST /api/rkap/fase/[phaseId]/rebalance
 * 2. Body: { fromItemId, toItemId, amount, momId }
 *
 * **Validates: Requirements 13, 14**
 */
import type { MomWire } from '#shared/domain/mom'
import type { CapitalItemWire } from '#shared/domain/rkap'
import { formatTanggalSingkat, formatRupiah } from '~/lib/harga'
import { ref, computed, watch } from 'vue'

// ---------------------------------------------------------------------------
// Props & Emits
// ---------------------------------------------------------------------------

const props = defineProps<{
  /** Apakah dialog terbuka */
  open?: boolean
  /** Phase ID untuk API call */
  phaseId: string
  /** Daftar Capital Items dalam fase (untuk selector) */
  items: CapitalItemWire[]
}>()

const emit = defineEmits<{
  /** Emitted saat dialog ditutup (batal atau sukses) */
  (e: 'update:open', value: boolean): void
  /** Emitted setelah rebalancing berhasil — from dan to item terupdate */
  (e: 'saved', result: { from: CapitalItemWire; to: CapitalItemWire }): void
}>()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MomListResponse {
  data: MomWire[]
}

interface RebalanceResult {
  from: CapitalItemWire
  to: CapitalItemWire
}

/** Label untuk jenis modal dalam Bahasa Indonesia */
const CAPITAL_TYPE_LABELS: Record<string, string> = {
  tetap: 'Tetap',
  bergerak: 'Bergerak',
}

// ---------------------------------------------------------------------------
// MoM Data Loading
// ---------------------------------------------------------------------------

const momList = ref<MomWire[]>([])
const momLoading = ref(true)
const momError = ref('')

async function loadFinalMoms() {
  momLoading.value = true
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

// ---------------------------------------------------------------------------
// Form State
// ---------------------------------------------------------------------------

const formFromItemId = ref('')
const formToItemId = ref('')
const formAmount = ref('')
const formMomId = ref('')

const menyimpan = ref(false)
const pesanError = ref('')

/**
 * Normalisasi input rupiah id-ID ke format kanonik.
 * Menerima: "52.000" atau "52000" atau "52.000,50" atau "52000.50"
 * Mengembalikan: "52000.00" atau "52000.50"
 */
function normalizeRupiahInput(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''

  const idIdPattern = /^[\d.]+(?:,\d+)?$/
  const canonicalPattern = /^\d+(?:\.\d+)?$/
  const PANJANG_KELOMPOK_RIBUAN = 3

  if (idIdPattern.test(trimmed) && trimmed.includes('.') && !trimmed.includes(',')) {
    const parts = trimmed.split('.')
    const isThousandsSeparator = parts.length > 1 && parts.slice(1).every(p => p.length === PANJANG_KELOMPOK_RIBUAN)
    if (isThousandsSeparator) {
      return parts.join('') + '.00'
    }
    return trimmed
  }

  if (trimmed.includes(',')) {
    const normalized = trimmed.replace(/\./g, '').replace(',', '.')
    return normalized
  }

  if (canonicalPattern.test(trimmed)) {
    if (!trimmed.includes('.')) {
      return trimmed + '.00'
    }
    return trimmed
  }

  return trimmed
}

// ---------------------------------------------------------------------------
// Computed: Filtered items for "To" selector
// ---------------------------------------------------------------------------

/** Item yang dipilih sebagai sumber (From) */
const selectedFromItem = computed(() => {
  if (!formFromItemId.value) return null
  return props.items.find(item => item.id === formFromItemId.value) ?? null
})

/**
 * Daftar item untuk selector "Ke Item" (To) — difilter hanya item sejenis.
 * Req-13: Rebalancing hanya antar item dengan jenis modal yang sama.
 */
const filteredToItems = computed(() => {
  if (!selectedFromItem.value) return []
  
  const fromType = selectedFromItem.value.capitalType
  return props.items.filter(item => 
    item.capitalType === fromType && item.id !== formFromItemId.value
  )
})

/** Maximum amount yang bisa direbalancing dari item sumber */
const maxAmount = computed(() => {
  if (!selectedFromItem.value) return '0.00'
  return selectedFromItem.value.finalRequirement
})

// ---------------------------------------------------------------------------
// Form Submission
// ---------------------------------------------------------------------------

async function submitForm() {
  pesanError.value = ''

  // Client-side validation
  if (!formFromItemId.value) {
    pesanError.value = 'Pilih item sumber.'
    return
  }
  if (!formToItemId.value) {
    pesanError.value = 'Pilih item tujuan.'
    return
  }
  if (!formAmount.value.trim()) {
    pesanError.value = 'Jumlah wajib diisi.'
    return
  }
  if (!formMomId.value) {
    pesanError.value = 'MoM referensi wajib dipilih.'
    return
  }

  // Validate amount
  const normalizedAmount = normalizeRupiahInput(formAmount.value)
  const parsedAmount = Number.parseFloat(normalizedAmount)
  if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    pesanError.value = 'Jumlah harus berupa angka positif.'
    return
  }

  // Validate amount doesn't exceed From item's Final Requirement
  const maxAllowed = Number.parseFloat(maxAmount.value)
  if (parsedAmount > maxAllowed) {
    pesanError.value = `Jumlah tidak boleh melebihi Final Requirement item sumber (${formatRupiah(maxAmount.value)}).`
    return
  }

  menyimpan.value = true

  try {
    // POST /api/rkap/fase/[phaseId]/rebalance
    const result = await $fetch<RebalanceResult>(`/api/rkap/fase/${props.phaseId}/rebalance`, {
      method: 'POST',
      body: {
        fromItemId: formFromItemId.value,
        toItemId: formToItemId.value,
        amount: normalizedAmount,
        momId: formMomId.value,
      },
    })

    // Emit success and close dialog
    emit('saved', result)
    closeDialog()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string; code?: string; details?: Record<string, string> } }
    
    // Handle specific error codes
    if (err.data?.code === 'NOT_FOUND') {
      pesanError.value = err.data.message ?? 'Item atau fase tidak ditemukan.'
    } else if (err.data?.code === 'TYPE_MISMATCH') {
      pesanError.value = 'Rebalancing hanya dapat dilakukan antar item dengan jenis modal yang sama.'
    } else if (err.data?.code === 'MOM_NOT_FINAL') {
      pesanError.value = 'MoM yang dipilih harus berstatus final.'
    } else if (err.data?.code === 'PHASE_NOT_ACTIVE') {
      pesanError.value = 'Fase tidak aktif. Rebalancing hanya dapat dilakukan pada fase berjalan.'
    } else if (err.data?.code === 'VALIDATION') {
      pesanError.value = err.data.message ?? 'Data tidak valid.'
    } else if (err.data?.code === 'FORBIDDEN') {
      pesanError.value = 'Anda tidak memiliki akses untuk melakukan rebalancing.'
    } else {
      pesanError.value = err.data?.message ?? 'Gagal melakukan rebalancing.'
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
  formFromItemId.value = ''
  formToItemId.value = ''
  formAmount.value = ''
  formMomId.value = ''
  pesanError.value = ''

  emit('update:open', false)
}

// Load MoMs and reset form when dialog opens
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    // Reset form
    formFromItemId.value = ''
    formToItemId.value = ''
    formAmount.value = ''
    formMomId.value = ''
    pesanError.value = ''
    
    // Load final MoMs if not already loaded
    if (momList.value.length === 0) {
      loadFinalMoms()
    }
  }
}, { immediate: true })

// Reset "To Item" when "From Item" changes (karena filter berubah)
watch(formFromItemId, () => {
  formToItemId.value = ''
})

// ---------------------------------------------------------------------------
// Computed: Form validation
// ---------------------------------------------------------------------------

const isFormValid = computed(() => {
  return formFromItemId.value && 
         formToItemId.value && 
         formAmount.value.trim() && 
         formMomId.value
})
</script>

<template>
  <ClientOnly>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
      <DialogContent
        class="sm:max-w-lg"
        data-testid="rebalance-dialog"
      >
        <DialogHeader>
          <DialogTitle>Rebalance</DialogTitle>
          <DialogDescription>
            Relokasi kebutuhan antar Capital Item dengan jenis modal yang sama.
          </DialogDescription>
        </DialogHeader>

        <!-- Error Alert -->
        <Alert v-if="pesanError" variant="destructive" class="mb-4" aria-live="assertive">
          <pre class="whitespace-pre-wrap text-sm">{{ pesanError }}</pre>
        </Alert>

        <form
          id="rebalance-form"
          class="flex flex-col gap-5"
          @submit.prevent="submitForm"
        >
          <!-- From Item Select -->
          <div class="flex flex-col gap-2">
            <label for="from-item" class="text-sm font-medium">
              Dari Item <span class="text-destructive">*</span>
            </label>
            
            <div v-if="items.length === 0" class="text-sm text-muted-foreground">
              Tidak ada Capital Item di fase ini.
            </div>

            <Select v-else v-model="formFromItemId">
              <SelectTrigger
                id="from-item"
                class="w-full"
                data-testid="from-item-select"
              >
                <SelectValue placeholder="Pilih item sumber" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="item in items"
                  :key="item.id"
                  :value="item.id"
                >
                  <span class="flex items-center gap-2">
                    <span class="truncate">{{ item.name }}</span>
                    <span
                      class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                      :class="item.capitalType === 'tetap'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'"
                    >
                      {{ CAPITAL_TYPE_LABELS[item.capitalType] }}
                    </span>
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            <!-- Show From Item info when selected -->
            <div v-if="selectedFromItem" class="rounded-md bg-muted/50 p-3 text-sm">
              <div class="flex justify-between">
                <span class="text-muted-foreground">Final Requirement:</span>
                <span class="tabular-nums font-medium">{{ formatRupiah(selectedFromItem.finalRequirement) }}</span>
              </div>
            </div>
          </div>

          <!-- To Item Select (filtered by same capital type) -->
          <div class="flex flex-col gap-2">
            <label for="to-item" class="text-sm font-medium">
              Ke Item <span class="text-destructive">*</span>
            </label>

            <div v-if="!formFromItemId" class="text-sm text-muted-foreground">
              Pilih item sumber terlebih dahulu.
            </div>

            <div
              v-else-if="filteredToItems.length === 0"
              class="text-sm text-muted-foreground"
            >
              Tidak ada item lain dengan jenis modal {{ selectedFromItem?.capitalType === 'tetap' ? 'Tetap' : 'Bergerak' }}.
            </div>

            <Select v-else v-model="formToItemId">
              <SelectTrigger
                id="to-item"
                class="w-full"
                data-testid="to-item-select"
              >
                <SelectValue placeholder="Pilih item tujuan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="item in filteredToItems"
                  :key="item.id"
                  :value="item.id"
                >
                  <span class="flex items-center gap-2">
                    <span class="truncate">{{ item.name }}</span>
                    <span
                      class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                      :class="item.capitalType === 'tetap'
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'"
                    >
                      {{ CAPITAL_TYPE_LABELS[item.capitalType] }}
                    </span>
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            <p class="text-xs text-muted-foreground">
              Hanya item dengan jenis modal yang sama dapat dipilih (Req-13).
            </p>
          </div>

          <!-- Amount Input (Money Input with Rp prefix) -->
          <div class="flex flex-col gap-2">
            <label for="amount" class="text-sm font-medium">
              Jumlah <span class="text-destructive">*</span>
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                Rp
              </span>
              <input
                id="amount"
                v-model="formAmount"
                type="text"
                inputmode="decimal"
                required
                placeholder="10.000.000"
                class="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm tabular-nums ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                data-testid="amount-input"
              >
            </div>
            <p v-if="selectedFromItem" class="text-xs text-muted-foreground">
              Maksimum: {{ formatRupiah(maxAmount) }}
            </p>
          </div>

          <!-- MoM Dropdown -->
          <div class="flex flex-col gap-2">
            <label for="mom-ref" class="text-sm font-medium">
              Referensi MoM <span class="text-destructive">*</span>
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
                id="mom-ref"
                class="w-full"
                data-testid="mom-select"
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
              Rebalancing wajib tercatat dalam keputusan MRO (Req-14).
            </p>
          </div>
        </form>

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
            form="rebalance-form"
            :disabled="menyimpan || momLoading || momList.length === 0 || !isFormValid || items.length < 2"
            class="flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            data-testid="submit-btn"
          >
            {{ menyimpan ? 'Menyimpan...' : 'Rebalance' }}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </ClientOnly>
</template>
