<script setup lang="ts">
/**
 * Manajemen Owner — halaman khusus COO (Story 1.8, FR-13).
 * CRUD owner: daftar, edit, tambah. Status tidak dapat diubah via halaman ini
 * (AD-11). Semua perubahan tercatat di audit trail (AD-3).
 *
 * Pola authorization: sama dengan audit-trail.vue — fetch `/api/landing`
 * untuk cek role, non-COO dialihkan ke landing role-nya.
 */
import { computed, ref } from 'vue'
import { LANDING_PATH } from '#shared/domain/identity'
import type { LandingRespons } from '~/lib/landing'
import {
  BADGE_VARIANT,
  formatTanggal,
  LABEL_STATUS,
  namaTampilan,
  type ListOwnersResponse,
  type OwnerListItem,
} from '~/lib/admin-owners'

definePageMeta({ auth: true })

const api = useRequestFetch()

const landing = await api<LandingRespons>('/api/landing').catch(() => null)
if (!landing) {
  await navigateTo('/login')
} else if ('unlinked' in landing) {
  await navigateTo('/login?res=unlinked')
} else if (landing.role !== 'coo') {
  // Non-COO membuka URL langsung → kembali ke landing role-nya (UX-DR14).
  await navigateTo(LANDING_PATH[landing.role])
}

/** Daftar owner dari API. */
const { data: ownersData, refresh: refreshOwners } = await useAsyncData(
  'admin-owners-list',
  () => api<ListOwnersResponse>('/api/admin/owners').catch(() => ({ owners: [] })),
)

const owners = computed<OwnerListItem[]>(() => ownersData.value?.owners ?? [])

/** State search filter. */
const searchQuery = ref('')

/** Owner terfilter berdasarkan search query. */
const filteredOwners = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  if (query === '') return owners.value
  return owners.value.filter((o) => {
    const searchable = [o.fullName, o.alias, o.email, o.phoneNumber]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return searchable.includes(query)
  })
})

/** Stats ringkasan. */
const stats = computed(() => {
  const total = owners.value.length
  const lengkap = owners.value.filter(o => o.profileComplete).length
  const aktif = owners.value.filter(o => o.status === 'terverifikasi').length
  return { total, lengkap, aktif }
})

/** State dialog edit/add. */
const editDialogOpen = ref(false)
const editOwnerId = ref('')
const addDialogOpen = ref(false)

/** Buka dialog edit. */
function openEdit(ownerId: string) {
  editOwnerId.value = ownerId
  editDialogOpen.value = true
}

/** Handler setelah simpan berhasil. */
function onSaved() {
  refreshOwners()
}

useHead({ title: 'Manajemen Owner — Sip & Dip' })
</script>

<template>
  <main data-testid="admin-owners-halaman" class="mx-auto flex min-h-dvh max-w-7xl flex-col gap-6 px-4 py-8">
    <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Manajemen Owner</h1>
        <p class="text-sm text-muted-foreground">Kelola data owner Sip & Dip — hanya untuk COO.</p>
      </div>
      <Button data-testid="admin-owners-tambah" @click="addDialogOpen = true">
        Tambah Owner
      </Button>
    </header>

    <!-- Stats -->
    <section class="grid gap-4 sm:grid-cols-3">
      <div class="rounded-lg border p-4">
        <p class="text-sm text-muted-foreground">Total Owner</p>
        <p class="text-2xl font-semibold tabular-nums">{{ stats.total }}</p>
      </div>
      <div class="rounded-lg border p-4">
        <p class="text-sm text-muted-foreground">Profil Lengkap</p>
        <p class="text-2xl font-semibold tabular-nums">{{ stats.lengkap }}</p>
      </div>
      <div class="rounded-lg border p-4">
        <p class="text-sm text-muted-foreground">Aktif (Terverifikasi)</p>
        <p class="text-2xl font-semibold tabular-nums">{{ stats.aktif }}</p>
      </div>
    </section>

    <!-- Search -->
    <div class="flex items-center gap-4">
      <input
v-model="searchQuery" type="text" placeholder="Cari owner (nama, email, HP)…"
        data-testid="admin-owners-search"
        class="flex h-11 w-full max-w-sm rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring">
    </div>

    <!-- Table (desktop) -->
    <div class="hidden overflow-x-auto rounded-lg border md:block">
      <Table data-testid="admin-owners-tabel">
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>No HP</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Profil</TableHead>
            <TableHead>Terdaftar</TableHead>
            <TableHead class="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="owner in filteredOwners" :key="owner.id" data-testid="admin-owners-baris">
            <TableCell class="font-medium">
              {{ namaTampilan(owner) }}
              <span v-if="owner.alias && owner.fullName" class="text-muted-foreground">({{ owner.alias }})</span>
            </TableCell>
            <TableCell class="text-sm">{{ owner.email }}</TableCell>
            <TableCell class="text-sm tabular-nums">{{ owner.phoneNumber ?? '—' }}</TableCell>
            <TableCell>
              <Badge :variant="BADGE_VARIANT[owner.status]">
                {{ LABEL_STATUS[owner.status] }}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge :variant="owner.profileComplete ? 'success' : 'muted'">
                {{ owner.profileComplete ? 'Lengkap' : 'Belum' }}
              </Badge>
            </TableCell>
            <TableCell class="text-sm tabular-nums">{{ formatTanggal(owner.createdAt) }}</TableCell>
            <TableCell class="text-right">
              <Button variant="ghost" size="sm" data-testid="admin-owners-edit" @click="openEdit(owner.id)">
                Edit
              </Button>
            </TableCell>
          </TableRow>

          <TableRow v-if="filteredOwners.length === 0">
            <TableCell colspan="7" class="py-8 text-center text-muted-foreground">
              {{ searchQuery ? 'Tidak ditemukan owner yang cocok.' : 'Belum ada owner.' }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Card list (mobile) -->
    <div class="flex flex-col gap-4 md:hidden">
      <div
v-for="owner in filteredOwners" :key="owner.id" class="flex flex-col gap-3 rounded-lg border p-4"
        data-testid="admin-owners-card">
        <div class="flex items-start justify-between">
          <div>
            <p class="font-medium">{{ namaTampilan(owner) }}</p>
            <p class="text-sm text-muted-foreground">{{ owner.email }}</p>
          </div>
          <Badge :variant="BADGE_VARIANT[owner.status]">
            {{ LABEL_STATUS[owner.status] }}
          </Badge>
        </div>

        <div class="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p class="text-muted-foreground">No HP</p>
            <p class="tabular-nums">{{ owner.phoneNumber ?? '—' }}</p>
          </div>
          <div>
            <p class="text-muted-foreground">Profil</p>
            <Badge :variant="owner.profileComplete ? 'success' : 'muted'" class="mt-0.5">
              {{ owner.profileComplete ? 'Lengkap' : 'Belum' }}
            </Badge>
          </div>
          <div>
            <p class="text-muted-foreground">Terdaftar</p>
            <p class="tabular-nums">{{ formatTanggal(owner.createdAt) }}</p>
          </div>
        </div>

        <Button variant="outline" size="sm" class="w-full" data-testid="admin-owners-edit" @click="openEdit(owner.id)">
          Edit
        </Button>
      </div>

      <div
v-if="filteredOwners.length === 0"
        class="flex items-center justify-center rounded-lg border border-dashed p-10 text-center">
        <p class="text-sm text-muted-foreground">
          {{ searchQuery ? 'Tidak ditemukan owner yang cocok.' : 'Belum ada owner.' }}
        </p>
      </div>
    </div>

    <!-- Edit Dialog -->
    <ClientOnly>
      <TooltipProvider>
        <AdminOwnerEditDialog v-model:open="editDialogOpen" :owner-id="editOwnerId" @saved="onSaved" />
      </TooltipProvider>
    </ClientOnly>

    <!-- Add Dialog -->
    <ClientOnly>
      <AdminOwnerAddDialog v-model:open="addDialogOpen" @saved="onSaved" />
    </ClientOnly>
  </main>
</template>
