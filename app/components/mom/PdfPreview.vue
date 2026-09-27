<script setup lang="ts">
/**
 * PdfPreview — komponen preview PDF MoM via iframe dengan signed URL (Req-2, Story 2.2).
 *
 * Fitur:
 * - Tampilkan PDF dalam iframe menggunakan signed URL (Req-2 AC5)
 * - Loading state saat memuat signed URL (Task 9.2)
 * - Error state bila gagal memuat (404/503) (Task 9.2)
 * - Tampilkan waktu kedaluwarsa dengan countdown (Task 9.2)
 * - Tombol refresh URL bila sudah kedaluwarsa (Task 9.2)
 * - Hanya tampil untuk COO dan pemegang saham (dikelola parent via visibilitas komponen)
 *
 * API Endpoint: GET /api/mom/[id]/signed → { url: string, expiresAt: string }
 *
 * Emits:
 * - `error`: ketika terjadi error yang perlu ditangani parent
 */
import { MOM_PDF_SIGNED_URL_EXPIRY_SECONDS } from '#shared/domain/mom'
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  momId: string
}>()

const emit = defineEmits<{
  error: [message: string]
}>()

// State
const signedUrl = ref<string | null>(null)
const expiresAt = ref<Date | null>(null)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const iframeLoaded = ref(false)
const countdownInterval = ref<ReturnType<typeof setInterval> | null>(null)
const remainingSeconds = ref(0)

// Konstanta — bernama (AD-10)
const SECONDS_PER_MINUTE = 60
const COUNTDOWN_INTERVAL_MS = 1000

// Computed
const isExpired = computed(() => {
  if (!expiresAt.value) return true
  return remainingSeconds.value <= 0
})

const formattedExpiry = computed(() => {
  if (remainingSeconds.value <= 0) return 'Kedaluwarsa'

  const minutes = Math.floor(remainingSeconds.value / SECONDS_PER_MINUTE)
  const seconds = remainingSeconds.value % SECONDS_PER_MINUTE

  if (minutes > 0) {
    return `${minutes}m ${seconds}s tersisa`
  }
  return `${seconds}s tersisa`
})

/**
 * Update remaining seconds berdasarkan expiresAt.
 */
function updateRemainingSeconds() {
  if (!expiresAt.value) {
    remainingSeconds.value = 0
    return
  }

  const now = Date.now()
  const expiry = expiresAt.value.getTime()
  const diff = Math.floor((expiry - now) / COUNTDOWN_INTERVAL_MS)

  remainingSeconds.value = Math.max(0, diff)

  // Stop countdown bila sudah kedaluwarsa
  if (remainingSeconds.value <= 0 && countdownInterval.value) {
    clearInterval(countdownInterval.value)
    countdownInterval.value = null
  }
}

/**
 * Mulai countdown timer.
 */
function startCountdown() {
  // Clear existing interval
  if (countdownInterval.value) {
    clearInterval(countdownInterval.value)
  }

  // Update immediately
  updateRemainingSeconds()

  // Start interval
  countdownInterval.value = setInterval(updateRemainingSeconds, COUNTDOWN_INTERVAL_MS)
}

/**
 * Fetch signed URL dari API.
 */
async function fetchSignedUrl() {
  isLoading.value = true
  errorMessage.value = null
  iframeLoaded.value = false

  try {
    const response = await $fetch<{ url: string, expiresAt: string }>(
      `/api/mom/${props.momId}/signed`,
    )

    signedUrl.value = response.url
    expiresAt.value = new Date(response.expiresAt)

    // Start countdown timer
    startCountdown()
  } catch (error: unknown) {
    const err = error as { statusCode?: number, data?: { message?: string } }

    if (err.statusCode === 404) {
      errorMessage.value = 'PDF tidak ditemukan untuk MoM ini.'
    } else if (err.statusCode === 503) {
      errorMessage.value = 'Layanan storage tidak tersedia. Silakan coba lagi.'
    } else if (err.statusCode === 403) {
      errorMessage.value = 'Anda tidak memiliki akses untuk melihat PDF ini.'
    } else {
      errorMessage.value = err.data?.message ?? 'Gagal memuat preview PDF.'
    }

    emit('error', errorMessage.value)
    signedUrl.value = null
    expiresAt.value = null
  } finally {
    isLoading.value = false
  }
}

/**
 * Handler saat iframe selesai memuat.
 */
function handleIframeLoad() {
  iframeLoaded.value = true
}

/**
 * Handler saat iframe gagal memuat (misal URL sudah expired).
 */
function handleIframeError() {
  errorMessage.value = 'Gagal memuat PDF — URL mungkin sudah kedaluwarsa.'
  iframeLoaded.value = false
}

/**
 * Refresh signed URL — dipanggil user atau saat URL expired.
 */
async function refreshUrl() {
  await fetchSignedUrl()
}

// Lifecycle
onMounted(() => {
  fetchSignedUrl()
})

onUnmounted(() => {
  if (countdownInterval.value) {
    clearInterval(countdownInterval.value)
  }
})

// Expose refresh method untuk parent
defineExpose({ refreshUrl })
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Header dengan status dan tombol refresh -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">Preview PDF</h2>
      <div class="flex items-center gap-3">
        <!-- Expiry countdown badge -->
        <span
          v-if="signedUrl && !isLoading"
          class="text-xs tabular-nums"
          :class="[
            isExpired
              ? 'text-destructive font-medium'
              : remainingSeconds < 120 ? 'text-amber-600' : 'text-muted-foreground',
          ]"
        >
          {{ formattedExpiry }}
        </span>

        <!-- Refresh button -->
        <button
          type="button"
          class="flex h-8 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent disabled:opacity-50"
          :disabled="isLoading"
          @click="refreshUrl"
        >
          <svg
            class="h-4 w-4"
            :class="{ 'animate-spin': isLoading }"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {{ isLoading ? 'Memuat...' : 'Perbarui URL' }}
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div
      v-if="isLoading && !signedUrl"
      class="flex aspect-[8.5/11] w-full items-center justify-center rounded-lg border bg-muted/50"
    >
      <div class="flex flex-col items-center gap-3">
        <svg
          class="h-8 w-8 animate-spin text-muted-foreground"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <p class="text-sm text-muted-foreground">Memuat preview PDF...</p>
      </div>
    </div>

    <!-- Error State -->
    <Alert v-else-if="errorMessage && !signedUrl" variant="destructive">
      <svg
        class="h-4 w-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <AlertDescription>
        {{ errorMessage }}
      </AlertDescription>
    </Alert>

    <!-- Expired State -->
    <div
      v-else-if="isExpired && signedUrl"
      class="flex aspect-[8.5/11] w-full flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/30"
    >
      <div class="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <svg
          class="h-8 w-8 text-muted-foreground"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <div class="text-center">
        <p class="font-medium text-foreground">URL Preview Kedaluwarsa</p>
        <p class="mt-1 text-sm text-muted-foreground">
          Signed URL berlaku {{ MOM_PDF_SIGNED_URL_EXPIRY_SECONDS / SECONDS_PER_MINUTE }} menit.
          Klik tombol di atas untuk memperbarui.
        </p>
      </div>
    </div>

    <!-- PDF Preview Iframe -->
    <div v-else-if="signedUrl" class="relative">
      <!-- Loading overlay for iframe -->
      <div
        v-if="!iframeLoaded"
        class="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-muted/50"
      >
        <div class="flex flex-col items-center gap-3">
          <svg
            class="h-8 w-8 animate-spin text-muted-foreground"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p class="text-sm text-muted-foreground">Memuat dokumen PDF...</p>
        </div>
      </div>

      <!-- Iframe -->
      <iframe
        :src="signedUrl"
        :key="signedUrl"
        class="aspect-[8.5/11] w-full rounded-lg border"
        title="Preview PDF MoM"
        @load="handleIframeLoad"
        @error="handleIframeError"
      />
    </div>
  </div>
</template>
