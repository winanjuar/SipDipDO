<script setup lang="ts">
import type { MomWire } from '#shared/domain/mom'
import { LANDING_PATH } from '#shared/domain/identity'
import type { LandingRespons } from '~/lib/landing'

/**
 * Buat MoM Baru — khusus COO (FR-7, AD-8). Non-COO dialihkan ke landing
 * role-nya.
 */
definePageMeta({ auth: true })

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

// Form state
const formTitle = ref('')
const formHeldAt = ref(new Date().toISOString().split('T')[0])
const formContentText = ref('')

const menyimpan = ref(false)
const pesanError = ref('')

async function buatMom() {
  if (!formTitle.value.trim()) {
    pesanError.value = 'Judul MoM wajib diisi.'
    return
  }
  if (!formHeldAt.value) {
    pesanError.value = 'Tanggal MoM wajib diisi.'
    return
  }

  menyimpan.value = true
  pesanError.value = ''

  try {
    const mom = await $fetch<MomWire>('/api/mom', {
      method: 'POST',
      body: {
        title: formTitle.value.trim(),
        heldAt: formHeldAt.value + 'T12:00:00+07:00',
        contentText: formContentText.value.trim() || null,
      },
    })
    await router.push(`/mom/${mom.id}`)
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    pesanError.value = err.data?.message ?? 'Gagal membuat MoM.'
  } finally {
    menyimpan.value = false
  }
}

useHead({ title: 'Buat MoM Baru — Sip & Dip' })
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-4 py-8">
    <div class="flex items-center gap-2">
      <NuxtLink to="/mom" class="text-sm text-muted-foreground hover:text-foreground">
        ← Kembali ke daftar
      </NuxtLink>
    </div>

    <header>
      <h1 class="text-2xl font-semibold">Buat MoM Baru</h1>
      <p class="text-sm text-muted-foreground">Buat notulen MRO/RUPS baru.</p>
    </header>

    <Alert v-if="pesanError" variant="destructive" class="mb-4" aria-live="assertive">
      {{ pesanError }}
    </Alert>

    <form class="flex flex-col gap-6" @submit.prevent="buatMom">
      <div class="flex flex-col gap-2">
        <label for="title" class="text-sm font-medium">Judul MoM <span class="text-destructive">*</span></label>
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
        <label for="heldAt" class="text-sm font-medium">Tanggal Meeting <span class="text-destructive">*</span></label>
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

      <div class="flex items-center gap-3">
        <button
          type="submit"
          :disabled="menyimpan"
          class="flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {{ menyimpan ? 'Menyimpan...' : 'Buat MoM' }}
        </button>
        <NuxtLink
          to="/mom"
          class="flex h-10 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent"
        >
          Batal
        </NuxtLink>
      </div>
    </form>
  </main>
</template>
