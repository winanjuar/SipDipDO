<script setup lang="ts">
/**
 * ItemAddDialog — Dialog untuk COO menambah Capital Item baru ke fase RKAP.
 *
 * Fitur utama (Req-8):
 * - Input nama item (wajib)
 * - Selector jenis modal: Tetap/Bergerak (wajib)
 * - Input nilai kebutuhan akhir / Final Requirement (money input dengan format Rupiah)
 * - Tombol Submit untuk menambah item
 * - Tombol Batal untuk membatalkan
 * - Validasi form dan penanganan error
 *
 * Flow:
 * 1. POST /api/rkap/fase/[phaseId]/items
 * 2. isInitialItem = false → Initial = 0, Final = nilai input
 *
 * Saat COO menambah Capital_Item baru ke fase berjalan, sistem menyimpan
 * item dengan Initial_Requirement = 0 dan Final_Requirement = nilai yang diinput.
 *
 * **Validates: Requirements 8**
 */
import type { CapitalType, CapitalItemWire } from '#shared/domain/rkap'
import { ref, computed, watch } from 'vue'

// ---------------------------------------------------------------------------
// Props & Emits
// ---------------------------------------------------------------------------

const props = defineProps<{
  /** Apakah dialog terbuka */
  open?: boolean
  /** Phase ID untuk menambah item */
  phaseId: string
}>()

const emit = defineEmits<{
  /** Emitted saat dialog ditutup (batal atau sukses) */
  (e: 'update:open', value: boolean): void
  /** Emitted setelah item berhasil ditambahkan */
  (e: 'created', item: CapitalItemWire): void
}>()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Label untuk jenis modal dalam Bahasa Indonesia */
const CAPITAL_TYPE_OPTIONS: { value: CapitalType; label: string }[] = [
  { value: 'tetap', label: 'Tetap' },
  { value: 'bergerak', label: 'Bergerak' },
]

// ---------------------------------------------------------------------------
// Form State
// ---------------------------------------------------------------------------

const formName = ref('')
const formCapitalType = ref<CapitalType>('tetap')
const formRequirement = ref('')

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

// ---------------------------------------------------------------------------
// Form Submission
// ---------------------------------------------------------------------------

async function submitForm() {
  pesanError.value = ''

  // Client-side validation
  if (!formName.value.trim()) {
    pesanError.value = 'Nama item wajib diisi.'
    return
  }
  if (!formRequirement.value.trim()) {
    pesanError.value = 'Kebutuhan Akhir wajib diisi.'
    return
  }

  // Validate requirement is a valid number
  const normalizedRequirement = normalizeRupiahInput(formRequirement.value)
  const parsedAmount = Number.parseFloat(normalizedRequirement)
  if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    pesanError.value = 'Kebutuhan Akhir harus berupa angka positif.'
    return
  }

  menyimpan.value = true

  try {
    // POST /api/rkap/fase/[phaseId]/items
    // isInitialItem = false (default) → Initial = 0, Final = requirement (Req-8)
    const item = await $fetch<CapitalItemWire>(`/api/rkap/fase/${props.phaseId}/items`, {
      method: 'POST',
      body: {
        name: formName.value.trim(),
        capitalType: formCapitalType.value,
        requirement: normalizedRequirement,
        isInitialItem: false, // New item to running phase: Initial = 0, Final = requirement
      },
    })

    // Emit success and close dialog
    emit('created', item)
    closeDialog()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string; code?: string; details?: Record<string, string> } }
    
    // Handle specific error codes
    if (err.data?.code === 'NOT_FOUND') {
      pesanError.value = 'Fase tidak ditemukan.'
    } else if (err.data?.code === 'PHASE_NOT_ACTIVE') {
      pesanError.value = 'Fase tidak aktif. Hanya dapat menambah item ke fase berjalan.'
    } else if (err.data?.code === 'LIMIT_EXCEEDED') {
      // Req-9: Alert Penolakan Terhitung dengan detail batas, terpakai, sisa
      const details = err.data.details
      if (details) {
        pesanError.value = `Penyesuaian melebihi batas agregat.\nBatas: Rp${details.batas}\nTerpakai: Rp${details.terpakai}\nSisa: Rp${details.sisa}\n${details.langkahLanjut ?? ''}`
      } else {
        pesanError.value = err.data.message ?? 'Penyesuaian melebihi batas agregat.'
      }
    } else if (err.data?.code === 'VALIDATION') {
      pesanError.value = err.data.message ?? 'Data tidak valid.'
    } else if (err.data?.code === 'FORBIDDEN') {
      pesanError.value = 'Anda tidak memiliki akses untuk menambah item.'
    } else {
      pesanError.value = err.data?.message ?? 'Gagal menambah Capital Item.'
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
  formCapitalType.value = 'tetap'
  formRequirement.value = ''
  pesanError.value = ''

  emit('update:open', false)
}

// Reset form when dialog opens
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    formName.value = ''
    formCapitalType.value = 'tetap'
    formRequirement.value = ''
    pesanError.value = ''
  }
})

// ---------------------------------------------------------------------------
// Computed
// ---------------------------------------------------------------------------

const isFormValid = computed(() => {
  return formName.value.trim() && formRequirement.value.trim()
})
</script>

<template>
  <ClientOnly>
    <Dialog :open="open" @update:open="emit('update:open', $event)">
      <DialogContent
        class="sm:max-w-md"
        data-testid="item-add-dialog"
      >
        <DialogHeader>
          <DialogTitle>Tambah Item</DialogTitle>
          <DialogDescription>
            Tambahkan Capital Item baru ke fase RKAP. Item baru akan memiliki Initial Requirement = 0.
          </DialogDescription>
        </DialogHeader>

        <!-- Error Alert -->
        <Alert v-if="pesanError" variant="destructive" class="mb-4" aria-live="assertive">
          <pre class="whitespace-pre-wrap text-sm">{{ pesanError }}</pre>
        </Alert>

        <form
          id="item-add-form"
          class="flex flex-col gap-5"
          @submit.prevent="submitForm"
        >
          <!-- Item Name Input -->
          <div class="flex flex-col gap-2">
            <label for="item-name" class="text-sm font-medium">
              Nama Item <span class="text-destructive">*</span>
            </label>
            <input
              id="item-name"
              v-model="formName"
              type="text"
              required
              placeholder="Pembelian Peralatan Dapur"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              data-testid="item-name-input"
            >
          </div>

          <!-- Capital Type Select -->
          <div class="flex flex-col gap-2">
            <label for="item-capital-type" class="text-sm font-medium">
              Jenis Modal <span class="text-destructive">*</span>
            </label>
            <Select v-model="formCapitalType">
              <SelectTrigger
                id="item-capital-type"
                class="w-full"
                data-testid="item-capital-type-select"
              >
                <SelectValue placeholder="Pilih jenis modal" />
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
            <p class="text-xs text-muted-foreground">
              Tetap = aset tidak bergerak (gedung, tanah). Bergerak = aset dapat dipindah (kendaraan, peralatan).
            </p>
          </div>

          <!-- Final Requirement (Money Input) -->
          <div class="flex flex-col gap-2">
            <label for="item-requirement" class="text-sm font-medium">
              Kebutuhan Akhir <span class="text-destructive">*</span>
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                Rp
              </span>
              <input
                id="item-requirement"
                v-model="formRequirement"
                type="text"
                inputmode="decimal"
                required
                placeholder="50.000.000"
                class="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm tabular-nums ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                data-testid="item-requirement-input"
              >
            </div>
            <p class="text-xs text-muted-foreground">
              Nilai Final Requirement untuk item ini. Initial Requirement akan otomatis diset 0 untuk item baru.
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
            form="item-add-form"
            :disabled="menyimpan || !isFormValid"
            class="flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            data-testid="submit-btn"
          >
            {{ menyimpan ? 'Menyimpan...' : 'Tambah Item' }}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </ClientOnly>
</template>
