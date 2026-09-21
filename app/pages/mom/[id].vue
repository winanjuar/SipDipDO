<script setup lang="ts">
import type { MomWire } from '#shared/domain/mom'
import type { LandingRespons } from '~/lib/landing'
import { formatTanggalMom, formatWaktuLengkap, PETA_BADGE_MOM } from '~/lib/mom'

/**
 * Detail/Edit MoM — COO dapat edit (bila draft) dan finalkan; pemegang saham
 * hanya bisa membaca. Owner tanpa saham dialihkan ke Halaman Personal (spec AC).
 */
definePageMeta({ auth: true })

const api = useRequestFetch()
const route = useRoute()
const router = useRouter()
const momIdParam = route.params.id
const momId = (Array.isArray(momIdParam) ? momIdParam[0] : momIdParam) ?? ''

if (!momId) {
  await navigateTo('/mom')
}

const landing = await api<LandingRespons>('/api/landing').catch(() => null)
if (!landing) {
  await navigateTo('/login')
} else if ('unlinked' in landing) {
  await navigateTo('/login?res=unlinked')
} else if (landing.role === 'tanpa_saham' || landing.role === 'calon_owner') {
  await navigateTo('/personal?akses=mom')
}

const isCoo = landing && !('unlinked' in landing) && landing.role === 'coo'

const mom = ref<MomWire | null>(null)
const gagalMuat = ref(false)
const memuat = ref(false)
const menyimpan = ref(false)
const pesanError = ref('')
const pesanSukses = ref('')

// Form state
const formTitle = ref('')
const formHeldAt = ref('')
const formContentText = ref('')

// Load MoM data
async function muatMom() {
  memuat.value = true
  gagalMuat.value = false
  try {
    const data = await api<MomWire>(`/api/mom/${momId}`)
    mom.value = data
    formTitle.value = data.title
    const datePart = data.heldAt.split('T')[0]
    formHeldAt.value = datePart ?? ''
    formContentText.value = data.contentText ?? ''
  } catch {
    gagalMuat.value = true
  } finally {
    memuat.value = false
  }
}

await muatMom()

const isDraft = computed(() => mom.value?.status === 'draft')
const canEdit = computed(() => isCoo && isDraft.value)

// Durasi tampil pesan sukses — konstanta bernama (ms).
const DURASI_PESAN_SUKSES = 3000

// Simpan perubahan MoM
async function simpanMom() {
  if (!canEdit.value || !mom.value) return
  menyimpan.value = true
  pesanError.value = ''
  pesanSukses.value = ''

  try {
    const updated = await $fetch<MomWire>(`/api/mom/${momId}`, {
      method: 'PUT',
      body: {
        title: formTitle.value,
        heldAt: formHeldAt.value + 'T12:00:00+07:00',
        contentText: formContentText.value || null,
      },
    })
    mom.value = updated
    pesanSukses.value = 'MoM berhasil disimpan.'
    setTimeout(() => pesanSukses.value = '', DURASI_PESAN_SUKSES)
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    pesanError.value = err.data?.message ?? 'Gagal menyimpan MoM.'
  } finally {
    menyimpan.value = false
  }
}

// Finalkan MoM
async function finalkanMom() {
  if (!canEdit.value || !mom.value) return
  if (!confirm('Yakin ingin memfinalkan MoM ini? MoM yang sudah final tidak dapat diubah lagi.')) return

  menyimpan.value = true
  pesanError.value = ''

  try {
    const updated = await $fetch<MomWire>(`/api/mom/${momId}/finalize`, {
      method: 'POST',
    })
    mom.value = updated
    pesanSukses.value = 'MoM berhasil difinalkan.'
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    pesanError.value = err.data?.message ?? 'Gagal memfinalkan MoM.'
  } finally {
    menyimpan.value = false
  }
}

// Hapus MoM
async function hapusMom() {
  if (!canEdit.value || !mom.value) return
  if (!confirm('Yakin ingin menghapus MoM ini? Tindakan ini tidak dapat dibatalkan.')) return

  menyimpan.value = true
  pesanError.value = ''

  try {
    await $fetch(`/api/mom/${momId}`, {
      method: 'DELETE',
    })
    await router.push('/mom')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    pesanError.value = err.data?.message ?? 'Gagal menghapus MoM.'
    menyimpan.value = false
  }
}

useHead({ title: computed(() => mom.value ? `${mom.value.title} — MoM` : 'MoM — Sip & Dip') })
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-8">
    <div class="flex items-center gap-2">
      <NuxtLink to="/mom" class="text-sm text-muted-foreground hover:text-foreground">
        ← Kembali ke daftar
      </NuxtLink>
    </div>

    <section
      v-if="memuat"
      class="flex flex-1 items-center justify-center"
    >
      <p class="text-sm text-muted-foreground">Memuat...</p>
    </section>

    <section
      v-else-if="gagalMuat"
      class="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center"
    >
      <p class="text-sm text-muted-foreground">MoM tidak ditemukan atau gagal dimuat.</p>
      <button
        type="button"
        class="text-sm font-medium underline underline-offset-4"
        @click="muatMom"
      >
        Coba lagi
      </button>
    </section>

    <template v-else-if="mom">
      <Alert v-if="pesanError" variant="destructive" class="mb-4" aria-live="assertive">
        {{ pesanError }}
      </Alert>
      <Alert v-if="pesanSukses" variant="success" class="mb-4" aria-live="polite">
        {{ pesanSukses }}
      </Alert>

      <header class="flex flex-col gap-2">
        <div class="flex items-start justify-between gap-4">
          <h1 v-if="!canEdit" class="text-2xl font-semibold">{{ mom.title }}</h1>
          <Badge :variant="PETA_BADGE_MOM[mom.status].variant" class="shrink-0 rounded-full">
            {{ PETA_BADGE_MOM[mom.status].label }}
          </Badge>
        </div>
        <p v-if="!canEdit" class="text-sm text-muted-foreground">{{ formatTanggalMom(mom.heldAt) }}</p>
      </header>

      <!-- Form untuk COO edit draft -->
      <form v-if="canEdit" class="flex flex-col gap-6" @submit.prevent="simpanMom">
        <div class="flex flex-col gap-2">
          <label for="title" class="text-sm font-medium">Judul MoM</label>
          <input
            id="title"
            v-model="formTitle"
            type="text"
            required
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="Judul notulen"
          >
        </div>

        <div class="flex flex-col gap-2">
          <label for="heldAt" class="text-sm font-medium">Tanggal Meeting</label>
          <input
            id="heldAt"
            v-model="formHeldAt"
            type="date"
            required
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
        </div>

        <div class="flex flex-col gap-2">
          <label for="contentText" class="text-sm font-medium">Isi Notulen</label>
          <textarea
            id="contentText"
            v-model="formContentText"
            rows="12"
            class="flex min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="Tulis isi notulen di sini..."
          />
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            :disabled="menyimpan"
            class="flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {{ menyimpan ? 'Menyimpan...' : 'Simpan Perubahan' }}
          </button>
          <button
            type="button"
            :disabled="menyimpan"
            class="flex h-10 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
            @click="finalkanMom"
          >
            Finalkan MoM
          </button>
          <button
            type="button"
            :disabled="menyimpan"
            class="flex h-10 items-center justify-center rounded-md border border-destructive/50 px-4 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            @click="hapusMom"
          >
            Hapus
          </button>
        </div>
      </form>

      <!-- Read-only view untuk viewer atau final -->
      <section v-else class="flex flex-col gap-6">
        <article class="rounded-lg border p-6">
          <div class="prose prose-sm max-w-none whitespace-pre-wrap">
            {{ mom.contentText || '(Tidak ada konten teks)' }}
          </div>
        </article>

        <div class="flex flex-col gap-2 text-sm text-muted-foreground">
          <p>Dibuat: {{ formatWaktuLengkap(mom.createdAt) }}</p>
          <p v-if="mom.finalizedAt">Difinalkan: {{ formatWaktuLengkap(mom.finalizedAt) }}</p>
        </div>
      </section>
    </template>
  </main>
</template>
