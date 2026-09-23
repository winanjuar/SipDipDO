<script setup lang="ts">
/**
 * PdfUploadZone — komponen upload drag-drop untuk PDF MoM (Req-1, Story 2.2).
 *
 * Fitur:
 * - Drag-and-drop file zone
 * - Click to browse file input
 * - Validasi file (PDF only, max 10MB) dengan pesan user-friendly
 * - Progress indicator upload
 * - Hanya tampil untuk COO pada draft MoM (dikelola parent)
 *
 * Emits:
 * - `uploaded`: ketika upload berhasil dengan wire MoM terbaru
 * - `error`: ketika upload gagal dengan pesan error
 */
import type { MomWire } from '#shared/domain/mom'
import { MOM_PDF_ALLOWED_MIME_TYPES, MOM_PDF_MAX_SIZE_BYTES } from '#shared/domain/mom'
import { ref, computed } from 'vue'

const props = defineProps<{
  momId: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  uploaded: [mom: MomWire]
  error: [message: string]
}>()

// State
const isDragging = ref(false)
const isUploading = ref(false)
const uploadProgress = ref(0)
const errorMessage = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

// Konstanta konversi bytes ke MB — konstanta bernama (pola AD-10).
const BYTES_PER_KB = 1024
const KB_PER_MB = 1024

// Konstanta progress percentage — konstanta bernama.
const PROGRESS_COMPLETE = 100

// Konstanta HTTP status range — konstanta bernama.
const HTTP_STATUS_OK_MIN = 200
const HTTP_STATUS_OK_MAX = 300

// Konstanta ukuran file dalam MB untuk pesan
const MAX_SIZE_MB = MOM_PDF_MAX_SIZE_BYTES / (BYTES_PER_KB * KB_PER_MB)

// Computed
const isDisabled = computed(() => props.disabled || isUploading.value)

/**
 * Validasi file sebelum upload.
 * Mengembalikan pesan error atau null jika valid.
 */
function validateFile(file: File): string | null {
  // Validasi MIME type
  if (!MOM_PDF_ALLOWED_MIME_TYPES.includes(file.type as typeof MOM_PDF_ALLOWED_MIME_TYPES[number])) {
    return `Tipe file tidak valid — hanya file PDF yang diizinkan.`
  }

  // Validasi ukuran file
  if (file.size > MOM_PDF_MAX_SIZE_BYTES) {
    const fileSizeMB = (file.size / (BYTES_PER_KB * KB_PER_MB)).toFixed(1)
    return `Ukuran file (${fileSizeMB} MB) melebihi batas maksimal ${MAX_SIZE_MB} MB.`
  }

  return null
}

/**
 * Upload file ke server via XHR untuk progress tracking.
 */
async function uploadFile(file: File) {
  errorMessage.value = null

  // Validasi client-side (defense in depth)
  const validationError = validateFile(file)
  if (validationError) {
    errorMessage.value = validationError
    emit('error', validationError)
    return
  }

  isUploading.value = true
  uploadProgress.value = 0

  try {
    const formData = new FormData()
    formData.append('file', file)

    // Gunakan XMLHttpRequest untuk progress tracking
    const response = await new Promise<MomWire>((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          uploadProgress.value = Math.round((event.loaded / event.total) * PROGRESS_COMPLETE)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= HTTP_STATUS_OK_MIN && xhr.status < HTTP_STATUS_OK_MAX) {
          try {
            const data = JSON.parse(xhr.responseText) as MomWire
            resolve(data)
          } catch {
            reject(new Error('Gagal memproses respons server.'))
          }
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText) as { message?: string }
            reject(new Error(errorData.message || `Upload gagal dengan status ${xhr.status}.`))
          } catch {
            reject(new Error(`Upload gagal dengan status ${xhr.status}.`))
          }
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('Koneksi terputus saat upload.'))
      })

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload dibatalkan.'))
      })

      xhr.open('POST', `/api/mom/${props.momId}/upload`)
      xhr.send(formData)
    })

    emit('uploaded', response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat upload.'
    errorMessage.value = message
    emit('error', message)
  } finally {
    isUploading.value = false
    uploadProgress.value = 0
  }
}

// Event handlers
function handleDrop(event: DragEvent) {
  isDragging.value = false

  if (isDisabled.value) return

  const files = event.dataTransfer?.files
  const firstFile = files?.[0]
  if (firstFile) {
    uploadFile(firstFile)
  }
}

function handleDragOver() {
  if (isDisabled.value) return
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  const firstFile = files?.[0]
  if (firstFile) {
    uploadFile(firstFile)
  }
  // Reset input agar file yang sama bisa dipilih ulang
  target.value = ''
}

function openFilePicker() {
  if (isDisabled.value) return
  fileInputRef.value?.click()
}

function clearError() {
  errorMessage.value = null
}
</script>

<template>
  <div class="space-y-3">
    <!-- Upload Zone -->
    <div
      role="button"
      tabindex="0"
      :aria-disabled="isDisabled"
      :aria-label="isUploading ? `Mengupload ${uploadProgress}%` : 'Klik atau drag file PDF untuk upload'"
      class="relative rounded-lg border-2 border-dashed p-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      :class="[
        isDragging && !isDisabled
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-muted-foreground/50',
        isDisabled && 'cursor-not-allowed opacity-60',
        !isDisabled && 'cursor-pointer',
      ]"
      @drop.prevent="handleDrop"
      @dragover.prevent="handleDragOver"
      @dragleave="handleDragLeave"
      @click="openFilePicker"
      @keydown.enter="openFilePicker"
      @keydown.space.prevent="openFilePicker"
    >
      <input
        ref="fileInputRef"
        type="file"
        accept="application/pdf"
        class="hidden"
        :disabled="isDisabled"
        @change="handleFileSelect"
      >

      <!-- Uploading State -->
      <div v-if="isUploading" class="space-y-3">
        <div class="mx-auto flex h-12 w-12 items-center justify-center">
          <svg
            class="h-8 w-8 animate-spin text-primary"
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
        </div>
        <p class="text-sm font-medium text-foreground">
          Mengupload... {{ uploadProgress }}%
        </p>
        <!-- Progress bar -->
        <div class="mx-auto h-2 w-48 overflow-hidden rounded-full bg-muted">
          <div
            class="h-full bg-primary transition-all duration-200"
            :style="{ width: `${uploadProgress}%` }"
          />
        </div>
      </div>

      <!-- Idle State -->
      <div v-else class="space-y-2">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <!-- Upload icon -->
          <svg
            class="h-6 w-6 text-muted-foreground"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
        </div>
        <div>
          <p class="text-sm font-medium text-foreground">
            Drag & drop file PDF di sini
          </p>
          <p class="text-xs text-muted-foreground">
            atau <span class="text-primary underline underline-offset-2">klik untuk memilih file</span>
          </p>
        </div>
        <p class="text-xs text-muted-foreground">
          Maksimum {{ MAX_SIZE_MB }} MB
        </p>
      </div>
    </div>

    <!-- Error Message -->
    <Alert v-if="errorMessage" variant="destructive" class="relative">
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
      <AlertDescription class="flex-1">
        {{ errorMessage }}
      </AlertDescription>
      <button
        type="button"
        class="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Tutup pesan error"
        @click.stop="clearError"
      >
        <svg
          class="h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </Alert>
  </div>
</template>
