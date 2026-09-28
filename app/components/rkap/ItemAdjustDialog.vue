<script setup lang="ts">
/**
 * ItemAdjustDialog — Dialog untuk COO menyesuaikan Final Requirement item eksisting.
 *
 * Fitur utama (Req-7, Req-10):
 * - Menampilkan nilai saat ini (current Final Requirement)
 * - Input nilai baru (New Final Requirement) dengan format Rupiah
 * - Menampilkan sisa batas penyesuaian sebelum tombol confirm (Req-10 AC2)
 * - Kalkulasi selisih (difference) ditampilkan real-time
 * - Validasi: penyesuaian tidak melebihi batas agregat
 * - Semua angka dengan format tabular-nums (Req-10 AC3)
 *
 * Flow:
 * 1. PUT /api/rkap/fase/[phaseId]/adjust
 * 2. Body: { itemId, newFinalRequirement }
 *
 * **Validates: Requirements 7, 10**
 */
import type { CapitalItemWire, RkapPhaseSummary } from '#shared/domain/rkap'
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
  /** Ringkasan batas penyesuaian fase — untuk menampilkan sisa limit (Req-10) */
  summary: RkapPhaseSummary | null
}>()

const emit = defineEmits<{
  /** Emitted saat dialog ditutup (batal atau sukses) */
  (e: 'update:open', value: boolean): void
  /** Emitted setelah adjustment berhasil — item dan summary terupdate */
  (e: 'saved', result: { item: CapitalItemWire; summary: RkapPhaseSummary }): void
}>()

// ---------------------------------------------------------------------------
// Form State
// ---------------------------------------------------------------------------

const formNewValue = ref('')
const menyimpan = ref(false)
const pesanError = ref('')

/** Panjang digit per kelompok ribuan di format id-ID (mis. 52.000). */
const PANJANG_KELOMPOK_RIBUAN = 3

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
// Computed Values
// ---------------------------------------------------------------------------

/** Label untuk jenis modal dalam Bahasa Indonesia */
const capitalTypeLabel = computed(() => {
  if (!props.item) return ''
  return props.item.capitalType === 'tetap' ? 'Tetap' : 'Bergerak'
})

/**
 * Kalkulasi selisih (difference) antara nilai baru dan nilai saat ini.
 * Ditampilkan real-time saat user mengetik.
 */
const difference = computed((): { value: string; isPositive: boolean; isValid: boolean } => {
  if (!props.item || !formNewValue.value.trim()) {
    return { value: '0.00', isPositive: false, isValid: false }
  }

  const normalizedNew = normalizeRupiahInput(formNewValue.value)
  const newVal = Number.parseFloat(normalizedNew)
  const currentVal = Number.parseFloat(props.item.finalRequirement)

  if (Number.isNaN(newVal) || Number.isNaN(currentVal)) {
    return { value: '0.00', isPositive: false, isValid: false }
  }

  const diff = newVal - currentVal
  return {
    value: Math.abs(diff).toFixed(2),
    isPositive: diff > 0,
    isValid: true,
  }
})

/**
 * Sisa batas penyesuaian SETELAH penyesuaian yang diinput.
 * Ditampilkan untuk memenuhi Req-10 AC2: menampilkan sisa batas sebelum confirm.
 */
const projectedRemaining = computed((): { value: string; willExceed: boolean } => {
  if (!props.summary || !difference.value.isValid || !difference.value.isPositive) {
    // Jika tidak ada adjustment (value sama atau berkurang), tidak perlu validasi limit
    return {
      value: props.summary?.adjustmentRemaining ?? '0.00',
      willExceed: false,
    }
  }

  const currentRemaining = Number.parseFloat(props.summary.adjustmentRemaining)
  const diff = Number.parseFloat(difference.value.value)

  if (Number.isNaN(currentRemaining) || Number.isNaN(diff)) {
    return { value: '0.00', willExceed: true }
  }

  const projected = currentRemaining - diff
  return {
    value: projected.toFixed(2),
    willExceed: projected < 0,
  }
})

// ---------------------------------------------------------------------------
// Form Submission
// ---------------------------------------------------------------------------

async function submitForm() {
  pesanError.value = ''

  if (!props.item) {
    pesanError.value = 'Item tidak ditemukan.'
    return
  }

  // Client-side validation
  if (!formNewValue.value.trim()) {
    pesanError.value = 'Nilai baru wajib diisi.'
    return
  }

  // Validate new value is a valid number
  const normalizedNewValue = normalizeRupiahInput(formNewValue.value)
  const parsedNewValue = Number.parseFloat(normalizedNewValue)
  if (Number.isNaN(parsedNewValue) || parsedNewValue < 0) {
    pesanError.value = 'Nilai baru harus berupa angka non-negatif.'
    return
  }

  // Check if value actually changed
  const currentVal = Number.parseFloat(props.item.finalRequirement)
  if (parsedNewValue === currentVal) {
    pesanError.value = 'Nilai baru sama dengan nilai saat ini.'
    return
  }

  // Pre-check: warn if projected remaining is negative (Req-9)
  // This is just a client-side warning — server will enforce the limit
  if (projectedRemaining.value.willExceed) {
    // Show warning but still allow submission — server will reject if truly exceeds
    // The actual validation happens server-side in a transaction (AD-2)
  }

  menyimpan.value = true

  try {
    // PUT /api/rkap/fase/[phaseId]/adjust
    interface AdjustResult {
      item: CapitalItemWire
      summary: RkapPhaseSummary
    }

    const result = await $fetch<AdjustResult>(`/api/rkap/fase/${props.phaseId}/adjust`, {
      method: 'PUT',
      body: {
        itemId: props.item.id,
        newFinalRequirement: normalizedNewValue,
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
    } else if (err.data?.code === 'PHASE_NOT_ACTIVE') {
      pesanError.value = 'Fase tidak aktif. Penyesuaian hanya dapat dilakukan pada fase berjalan.'
    } else if (err.data?.code === 'LIMIT_EXCEEDED') {
      // Req-9: Alert Penolakan Terhitung dengan detail batas, terpakai, sisa, diminta
      const details = err.data.details
      if (details) {
        pesanError.value = `Penyesuaian melebihi batas agregat.\n\nBatas: Rp${formatForInput(details.batas ?? '0')}\nTerpakai: Rp${formatForInput(details.terpakai ?? '0')}\nSisa: Rp${formatForInput(details.sisa ?? '0')}\nDiminta: Rp${formatForInput(details.diminta ?? '0')}\n\n${details.langkahLanjut ?? 'Ajukan ke MRO untuk menambah batas fase.'}`
      } else {
        pesanError.value = err.data.message ?? 'Penyesuaian melebihi batas agregat.'
      }
    } else if (err.data?.code === 'VALIDATION') {
      pesanError.value = err.data.message ?? 'Nilai tidak valid.'
    } else if (err.data?.code === 'FORBIDDEN') {
      pesanError.value = 'Anda tidak memiliki akses untuk menyesuaikan item.'
    } else {
      pesanError.value = err.data?.message ?? 'Gagal menyesuaikan Final Requirement.'
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
  formNewValue.value = ''
  pesanError.value = ''

  emit('update:open', false)
}

// Populate form when dialog opens with existing item data
watch([() => props.open, () => props.item], ([isOpen, item]) => {
  if (isOpen && item) {
    // Pre-fill with existing Final Requirement value formatted for input
    formNewValue.value = formatForInput(item.finalRequirement)
    pesanError.value = ''
  }
}, { immediate: true })

// ---------------------------------------------------------------------------
// Computed: Form validation
// ---------------------------------------------------------------------------

const isFormValid = computed(() => {
  if (!formNewValue.value.trim()) return false

  const normalizedNew = normalizeRupiahInput(formNewValue.value)
  const newVal = Number.parseFloat(normalizedNew)
  const currentVal = props.item ? Number.parseFloat(props.item.finalRequirement) : 0

  // Must be a valid number, non-negative, and different from current
  return !Number.isNaN(newVal) && newVal >= 0 && newVal !== currentVal
})
</script>

<template>
  <ClientOnly>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
      <DialogContent
        class="sm:max-w-md"
        data-testid="item-adjust-dialog"
      >
        <DialogHeader>
          <DialogTitle>Sesuaikan Final Requirement</DialogTitle>
          <DialogDescription>
            Ubah nilai Final Requirement untuk item ini. Penyesuaian akan dihitung terhadap batas agregat.
          </DialogDescription>
        </DialogHeader>

        <!-- Error Alert -->
        <Alert v-if="pesanError" variant="destructive" class="mb-4" aria-live="assertive">
          <pre class="whitespace-pre-wrap text-sm">{{ pesanError }}</pre>
        </Alert>

        <!-- Item Info Card -->
        <div v-if="item" class="rounded-lg border bg-muted/30 p-4">
          <div class="flex flex-col gap-2">
            <!-- Item Name and Type -->
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

            <!-- Current Values (Req-7 AC1: showing current finalRequirement) -->
            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div class="text-muted-foreground">Initial Requirement:</div>
              <div class="text-right tabular-nums">{{ formatRupiah(item.initialRequirement) }}</div>

              <div class="text-muted-foreground">Final Requirement saat ini:</div>
              <div class="text-right tabular-nums font-medium">{{ formatRupiah(item.finalRequirement) }}</div>
            </div>
          </div>
        </div>

        <form
          id="item-adjust-form"
          class="flex flex-col gap-5"
          @submit.prevent="submitForm"
        >
          <!-- New Value Input (Req-7: new value input) -->
          <div class="flex flex-col gap-2">
            <label for="new-value" class="text-sm font-medium">
              Nilai Baru <span class="text-destructive">*</span>
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                Rp
              </span>
              <input
                id="new-value"
                v-model="formNewValue"
                type="text"
                inputmode="decimal"
                required
                placeholder="0"
                class="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm tabular-nums ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                data-testid="new-value-input"
              >
            </div>
          </div>

          <!-- Difference Display (real-time calculation) -->
          <div v-if="difference.isValid && item" class="rounded-lg border p-3">
            <div class="flex items-center justify-between text-sm">
              <span class="text-muted-foreground">Selisih:</span>
              <span
                class="font-medium tabular-nums"
                :class="difference.isPositive ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'"
              >
                {{ difference.isPositive ? '+' : '-' }}{{ formatRupiah(difference.value) }}
              </span>
            </div>
            <p v-if="difference.isPositive" class="mt-1 text-xs text-muted-foreground">
              Kenaikan akan dihitung sebagai penyesuaian agregat.
            </p>
            <p v-else class="mt-1 text-xs text-muted-foreground">
              Penurunan tidak mempengaruhi batas penyesuaian.
            </p>
          </div>

          <!-- Remaining Limit Display (Req-10 AC2: show remaining limit before confirm) -->
          <div v-if="summary" class="rounded-lg border bg-muted/30 p-3">
            <h4 class="mb-2 text-xs font-medium text-muted-foreground">Batas Penyesuaian Fase</h4>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div class="text-muted-foreground">Batas (1% + 1 saham):</div>
              <div class="text-right tabular-nums">{{ formatRupiah(summary.adjustmentLimit) }}</div>

              <div class="text-muted-foreground">Sudah terpakai:</div>
              <div class="text-right tabular-nums">{{ formatRupiah(summary.adjustmentUsed) }}</div>

              <div class="text-muted-foreground">Sisa saat ini:</div>
              <div class="text-right tabular-nums font-medium">{{ formatRupiah(summary.adjustmentRemaining) }}</div>

              <!-- Projected remaining after this adjustment (Req-10 AC2) -->
              <template v-if="difference.isValid && difference.isPositive">
                <div class="text-muted-foreground">Sisa setelah penyesuaian:</div>
                <div
                  class="text-right tabular-nums font-medium"
                  :class="projectedRemaining.willExceed ? 'text-red-600 dark:text-red-400' : ''"
                >
                  {{ formatRupiah(projectedRemaining.value) }}
                </div>
              </template>
            </div>

            <!-- Warning if will exceed limit -->
            <div
              v-if="projectedRemaining.willExceed"
              class="mt-2 rounded-md bg-red-100 p-2 text-xs text-red-800 dark:bg-red-900/50 dark:text-red-200"
            >
              ⚠️ Penyesuaian ini akan melebihi batas agregat. Ajukan ke MRO untuk menambah batas fase.
            </div>
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
            form="item-adjust-form"
            :disabled="menyimpan || !isFormValid"
            class="flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            data-testid="submit-btn"
          >
            {{ menyimpan ? 'Menyimpan...' : 'Simpan Perubahan' }}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </ClientOnly>
</template>
