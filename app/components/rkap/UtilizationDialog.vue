<script setup lang="ts">
/**
 * UtilizationDialog — Dialog untuk COO menginput Utilization per Capital Item.
 *
 * Fitur utama (Req-11, Req-12):
 * - Menampilkan informasi item yang sedang diedit
 * - Input nilai Utilization dengan format Rupiah (tabular-nums, Rp prefix)
 * - Validasi nilai adalah numeric non-negatif
 * - Tombol Submit untuk menyimpan
 * - Tombol Batal untuk membatalkan
 * - Penanganan error
 *
 * Alur:
 * 1. PUT /api/rkap/fase/[phaseId]/utilization dengan { itemId, utilization }
 * 2. Utilization tersimpan terpisah dari Fulfillment — kedua nilai independen (Req-11)
 * 3. Achievement = Utilization ÷ Fulfillment (Req-12)
 * 4. Held = Fulfillment − Utilization (Req-12)
 *
 * **Validates: Requirements 11, 12**
 */
import type { CapitalItemWire } from '#shared/domain/rkap'
import { formatRupiah } from '~/lib/harga'
import { ref, computed, watch } from 'vue'

// ---------------------------------------------------------------------------
// Props & Emits
// ---------------------------------------------------------------------------

const props = defineProps<{
  /** Apakah dialog terbuka */
  open?: boolean
  /** Phase ID untuk API call */
  phaseId: string
  /** Capital Item yang sedang diedit (null jika tidak ada) */
  item: CapitalItemWire | null
}>()

const emit = defineEmits<{
  /** Emitted saat dialog ditutup (batal atau sukses) */
  (e: 'update:open', value: boolean): void
  /** Emitted setelah utilization berhasil disimpan */
  (e: 'saved', item: CapitalItemWire): void
}>()

// ---------------------------------------------------------------------------
// Form State
// ---------------------------------------------------------------------------

const formUtilization = ref('')
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

/**
 * Format nilai decimal string menjadi format id-ID untuk display dalam input.
 * Misal: "52000.00" -> "52.000" (tanpa desimal jika .00)
 */
function formatForInput(value: string): string {
  if (!value) return ''
  
  const num = Number.parseFloat(value)
  if (Number.isNaN(num)) return value
  
  // Format dengan locale id-ID tanpa desimal jika bilangan bulat
  if (num % 1 === 0) {
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(num)
  }
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num)
}

// ---------------------------------------------------------------------------
// Form Submission
// ---------------------------------------------------------------------------

async function submitForm() {
  pesanError.value = ''

  if (!props.item) {
    pesanError.value = 'Item tidak ditemukan.'
    return
  }

  // Client-side validation: utilization bisa kosong (berarti 0)
  const inputValue = formUtilization.value.trim() || '0'
  
  // Validate utilization is a valid number and non-negative (Req-11)
  const normalizedUtilization = normalizeRupiahInput(inputValue)
  const parsedAmount = Number.parseFloat(normalizedUtilization)
  if (Number.isNaN(parsedAmount)) {
    pesanError.value = 'Utilisasi harus berupa angka.'
    return
  }
  if (parsedAmount < 0) {
    pesanError.value = 'Utilisasi tidak boleh negatif.'
    return
  }

  menyimpan.value = true

  try {
    // PUT /api/rkap/fase/[phaseId]/utilization
    const result = await $fetch<CapitalItemWire>(`/api/rkap/fase/${props.phaseId}/utilization`, {
      method: 'PUT',
      body: {
        itemId: props.item.id,
        utilization: normalizedUtilization,
      },
    })

    // Emit success and close dialog
    emit('saved', result)
    closeDialog()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string; code?: string; details?: Record<string, string> } }
    
    // Handle specific error codes
    if (err.data?.code === 'NOT_FOUND') {
      pesanError.value = 'Item tidak ditemukan.'
    } else if (err.data?.code === 'VALIDATION') {
      pesanError.value = err.data.message ?? 'Nilai tidak valid.'
    } else if (err.data?.code === 'FORBIDDEN') {
      pesanError.value = 'Anda tidak memiliki akses untuk mencatat utilisasi.'
    } else {
      pesanError.value = err.data?.message ?? 'Gagal menyimpan utilisasi.'
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
  formUtilization.value = ''
  pesanError.value = ''

  emit('update:open', false)
}

// Populate form when dialog opens with existing item data
watch([() => props.open, () => props.item], ([isOpen, item]) => {
  if (isOpen && item) {
    // Pre-fill with existing utilization value formatted for input
    formUtilization.value = formatForInput(item.utilization)
    pesanError.value = ''
  }
}, { immediate: true })

// ---------------------------------------------------------------------------
// Computed
// ---------------------------------------------------------------------------

/** Label untuk jenis modal dalam Bahasa Indonesia */
const capitalTypeLabel = computed(() => {
  if (!props.item) return ''
  return props.item.capitalType === 'tetap' ? 'Tetap' : 'Bergerak'
})
</script>

<template>
  <ClientOnly>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
      <DialogContent
        class="sm:max-w-md"
        data-testid="utilization-dialog"
      >
        <DialogHeader>
          <DialogTitle>Input Utilisasi</DialogTitle>
          <DialogDescription>
            Catat realisasi penggunaan modal untuk item ini.
          </DialogDescription>
        </DialogHeader>

        <!-- Error Alert -->
        <Alert v-if="pesanError" variant="destructive" class="mb-4" aria-live="assertive">
          {{ pesanError }}
        </Alert>

        <!-- Item Info Card -->
        <div v-if="item" class="rounded-lg border bg-muted/30 p-4">
          <div class="flex flex-col gap-2">
            <!-- Item Name -->
            <div class="flex items-start justify-between gap-2">
              <span class="font-medium">{{ item.name }}</span>
              <span
                class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium"
                :class="item.capitalType === 'tetap'
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                  : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'"
              >
                {{ capitalTypeLabel }}
              </span>
            </div>
            
            <!-- Current Values -->
            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div class="text-muted-foreground">Fulfillment:</div>
              <div class="text-right tabular-nums">{{ formatRupiah(item.fulfillment) }}</div>
              
              <div class="text-muted-foreground">Utilisasi saat ini:</div>
              <div class="text-right tabular-nums">{{ formatRupiah(item.utilization) }}</div>
              
              <div class="text-muted-foreground">Held:</div>
              <div class="text-right tabular-nums">{{ formatRupiah(item.held) }}</div>
            </div>
          </div>
        </div>

        <form
          id="utilization-form"
          class="flex flex-col gap-5"
          @submit.prevent="submitForm"
        >
          <!-- Utilization Input (Money Input with Rp prefix) -->
          <div class="flex flex-col gap-2">
            <label for="utilization-value" class="text-sm font-medium">
              Utilisasi Baru <span class="text-destructive">*</span>
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                Rp
              </span>
              <input
                id="utilization-value"
                v-model="formUtilization"
                type="text"
                inputmode="decimal"
                required
                placeholder="0"
                class="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm tabular-nums ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                data-testid="utilization-input"
              >
            </div>
            <p class="text-xs text-muted-foreground">
              Nilai realisasi penggunaan modal di lapangan. Achievement dan Held akan otomatis dihitung ulang.
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
            form="utilization-form"
            :disabled="menyimpan"
            class="flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            data-testid="submit-btn"
          >
            {{ menyimpan ? 'Menyimpan...' : 'Simpan' }}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </ClientOnly>
</template>
