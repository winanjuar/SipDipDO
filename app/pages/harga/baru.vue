<script setup lang="ts">
import { LANDING_PATH } from '#shared/domain/identity'
import type { MomWire } from '#shared/domain/mom'
import type { PriceCreateInput, PriceType, PriceWire } from '#shared/domain/price'
import type { LandingRespons } from '~/lib/landing'
import { formatTanggalSingkat, PETA_LABEL_TIPE } from '~/lib/harga'

/**
 * Tetapkan Harga Baru — khusus COO (Req-3, AD-8). Non-COO dialihkan ke landing
 * role-nya (middleware registry Story 2.1b yang otoritatif; resolver di
 * sini defensif — pola 1.7). Layout `app` (Story 2.1b — nav registry).
 *
 * Form fields (Req-3):
 * - Type selector (beli/jual)
 * - Date picker for effective date
 * - Amount input (rupiah format)
 * - MoM dropdown (only final MoMs can be selected, per Req-14)
 *
 * Submit to POST /api/harga
 *
 * **Validates: Requirements 3, 14**
 */
definePageMeta({ layout: 'app', auth: true })

const api = useRequestFetch()
const router = useRouter()

const landing = await api<LandingRespons>('/api/landing').catch(() => null)
if (!landing) {
  await navigateTo('/login')
} else if ('unlinked' in landing) {
  await navigateTo('/login?res=unlinked')
} else if (landing.role !== 'coo') {
  await navigateTo(LANDING_PATH[landing.role])
}

// Load final MoMs for dropdown (Req-14)
interface MomListResponse {
  data: MomWire[]
}

const momList = ref<MomWire[]>([])
const momLoading = ref(true)
const momError = ref('')

async function loadFinalMoms() {
  try {
    const result = await api<MomListResponse>('/api/mom?status=final')
    momList.value = result.data
  } catch {
    momError.value = 'Gagal memuat daftar MoM.'
  } finally {
    momLoading.value = false
  }
}

// Load MoMs on mount
onMounted(() => {
  loadFinalMoms()
})

// Form state
const formType = ref<PriceType>('beli')
const formEffectiveDate = ref(new Date().toISOString().split('T')[0])
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

async function tetapkanHarga() {
  pesanError.value = ''

  // Client-side validation
  if (!formType.value) {
    pesanError.value = 'Tipe harga wajib dipilih.'
    return
  }
  if (!formEffectiveDate.value) {
    pesanError.value = 'Tanggal efektif wajib diisi.'
    return
  }
  if (!formAmount.value.trim()) {
    pesanError.value = 'Nilai harga wajib diisi.'
    return
  }
  if (!formMomId.value) {
    pesanError.value = 'MoM referensi wajib dipilih.'
    return
  }

  menyimpan.value = true

  try {
    const normalizedAmount = normalizeRupiahInput(formAmount.value)

    const input: PriceCreateInput = {
      type: formType.value,
      effectiveDate: formEffectiveDate.value,
      amount: normalizedAmount,
      momId: formMomId.value,
    }

    await $fetch<PriceWire>('/api/harga', {
      method: 'POST',
      body: input,
    })

    await router.push('/harga')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string, code?: string } }
    if (err.data?.code === 'MOM_NOT_FINAL') {
      pesanError.value = 'MoM yang dipilih harus berstatus final.'
    } else if (err.data?.code === 'PAST_DATE') {
      pesanError.value = 'Tanggal efektif tidak boleh di masa lampau untuk harga baru.'
    } else {
      pesanError.value = err.data?.message ?? 'Gagal menyimpan harga.'
    }
  } finally {
    menyimpan.value = false
  }
}

/** Get today's date in YYYY-MM-DD format for min attribute. */
const todayDate = new Date().toISOString().split('T')[0]

useHead({ title: 'Tetapkan Harga Baru — Sip & Dip' })
</script>

<template>
  <main data-testid="harga-baru-halaman" class="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-8">
    <div class="flex items-center gap-2">
      <NuxtLink to="/harga" class="text-sm text-muted-foreground hover:text-foreground">
        ← Kembali ke daftar
      </NuxtLink>
    </div>

    <header>
      <h1 class="text-2xl font-semibold">Tetapkan Harga Baru</h1>
      <p class="text-sm text-muted-foreground">Tetapkan harga beli atau jual saham dengan referensi MoM.</p>
    </header>

    <Alert v-if="pesanError" variant="destructive" class="mb-4" aria-live="assertive">
      {{ pesanError }}
    </Alert>

    <form class="flex flex-col gap-6" @submit.prevent="tetapkanHarga">
      <!-- Type Selector -->
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium">Tipe Harga <span class="text-destructive">*</span></label>
        <div class="flex gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="formType"
              type="radio"
              name="type"
              value="beli"
              class="size-4 accent-primary"
            >
            <span
              class="rounded-full px-2.5 py-1 text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
            >
              {{ PETA_LABEL_TIPE.beli }}
            </span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="formType"
              type="radio"
              name="type"
              value="jual"
              class="size-4 accent-primary"
            >
            <span
              class="rounded-full px-2.5 py-1 text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
            >
              {{ PETA_LABEL_TIPE.jual }}
            </span>
          </label>
        </div>
      </div>

      <!-- Effective Date -->
      <div class="flex flex-col gap-2">
        <label for="effectiveDate" class="text-sm font-medium">
          Tanggal Efektif <span class="text-destructive">*</span>
        </label>
        <input
          id="effectiveDate"
          v-model="formEffectiveDate"
          type="date"
          required
          :min="todayDate"
          class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
        <p class="text-xs text-muted-foreground">
          Harga berlaku mulai tanggal ini.
        </p>
      </div>

      <!-- Amount Input -->
      <div class="flex flex-col gap-2">
        <label for="amount" class="text-sm font-medium">
          Nilai Harga <span class="text-destructive">*</span>
        </label>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
          <input
            id="amount"
            v-model="formAmount"
            type="text"
            inputmode="decimal"
            required
            placeholder="52.000"
            class="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm tabular-nums ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
        </div>
        <p class="text-xs text-muted-foreground">
          Masukkan nilai dalam format angka (mis. 52.000 atau 52000).
        </p>
      </div>

      <!-- MoM Dropdown -->
      <div class="flex flex-col gap-2">
        <label for="momId" class="text-sm font-medium">
          MoM Referensi <span class="text-destructive">*</span>
        </label>

        <div v-if="momLoading" class="flex h-10 items-center text-sm text-muted-foreground">
          Memuat daftar MoM...
        </div>

        <div v-else-if="momError" class="flex h-10 items-center text-sm text-destructive">
          {{ momError }}
        </div>

        <div v-else-if="momList.length === 0" class="flex h-10 items-center text-sm text-muted-foreground">
          Tidak ada MoM final tersedia. Finalkan MoM terlebih dahulu.
        </div>

        <Select v-else v-model="formMomId">
          <SelectTrigger id="momId" class="w-full">
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
          Keputusan harga harus tertaut MoM yang sudah difinalkan.
        </p>
      </div>

      <!-- Submit Buttons -->
      <div class="flex items-center gap-3 pt-2">
        <button
          type="submit"
          :disabled="menyimpan || momLoading || momList.length === 0"
          class="flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {{ menyimpan ? 'Menyimpan...' : 'Tetapkan Harga' }}
        </button>
        <NuxtLink
          to="/harga"
          class="flex h-10 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent"
        >
          Batal
        </NuxtLink>
      </div>
    </form>
  </main>
</template>
