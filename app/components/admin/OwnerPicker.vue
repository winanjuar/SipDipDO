<script setup lang="ts">
/**
 * OwnerPicker — komponen combobox untuk memilih owner (Story 1.8, Req 4).
 * Didesain untuk dipakai ulang di Epic 3 (manajemen kepemilikan saham).
 *
 * Fitur:
 * - Search owner by nama/alias/email
 * - Tampilkan semua owner termasuk `keluar` (FR-13)
 * - Badge status per owner
 * - Emit selected owner ID
 *
 * Props:
 * - modelValue: string | undefined — ID owner terpilih
 * - owners: OwnerListItem[] — daftar owner dari parent (sudah di-fetch)
 * - placeholder: string — teks placeholder
 * - disabled: boolean — nonaktifkan picker
 */
import { computed, ref } from 'vue'
import { BADGE_VARIANT, LABEL_STATUS, namaTampilan, type OwnerListItem } from '~/lib/admin-owners'

const props = withDefaults(defineProps<{
  modelValue?: string
  owners: OwnerListItem[]
  placeholder?: string
  disabled?: boolean
}>(), {
  modelValue: undefined,
  placeholder: 'Pilih owner…',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | undefined]
}>()

/** Teks filter pencarian. */
const filterText = ref('')

/** Owner terfilter berdasarkan search — case-insensitive partial match. */
const ownersFiltered = computed(() => {
  const query = filterText.value.toLowerCase().trim()
  if (query === '') return props.owners
  return props.owners.filter((o) => {
    const searchable = [o.fullName, o.alias, o.email].filter(Boolean).join(' ').toLowerCase()
    return searchable.includes(query)
  })
})

/** Owner terpilih saat ini. */
const selectedOwner = computed(() =>
  props.owners.find(o => o.id === props.modelValue),
)

/** Handler select owner — nilai dari Select adalah AcceptableValue. */
function selectOwner(value: string | number | bigint | Record<string, unknown> | null) {
  if (typeof value === 'string' && value !== '') {
    emit('update:modelValue', value)
  } else {
    emit('update:modelValue', undefined)
  }
}
</script>

<template>
  <Select
    :model-value="modelValue"
    :disabled="disabled"
    @update:model-value="selectOwner"
  >
    <SelectTrigger
      data-testid="owner-picker-trigger"
      class="h-11 w-full"
    >
      <SelectValue :placeholder="placeholder">
        <template v-if="selectedOwner">
          <span class="flex items-center gap-2">
            <span class="truncate">{{ namaTampilan(selectedOwner) }}</span>
            <Badge :variant="BADGE_VARIANT[selectedOwner.status]" class="shrink-0">
              {{ LABEL_STATUS[selectedOwner.status] }}
            </Badge>
          </span>
        </template>
      </SelectValue>
    </SelectTrigger>
    <SelectContent>
      <!-- Search input di atas daftar -->
      <div class="px-2 pb-2">
        <input
          v-model="filterText"
          type="text"
          placeholder="Cari owner…"
          data-testid="owner-picker-search"
          class="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
      </div>

      <SelectGroup>
        <SelectItem
          v-for="owner in ownersFiltered"
          :key="owner.id"
          :value="owner.id"
          :data-testid="`owner-picker-item-${owner.id}`"
        >
          <span class="flex w-full items-center justify-between gap-2">
            <span class="flex flex-col">
              <span class="font-medium">{{ namaTampilan(owner) }}</span>
              <span class="text-xs text-muted-foreground">{{ owner.email }}</span>
            </span>
            <Badge :variant="BADGE_VARIANT[owner.status]" class="shrink-0">
              {{ LABEL_STATUS[owner.status] }}
            </Badge>
          </span>
        </SelectItem>

        <SelectItem v-if="ownersFiltered.length === 0" value="" disabled>
          Tidak ditemukan
        </SelectItem>
      </SelectGroup>
    </SelectContent>
  </Select>
</template>
