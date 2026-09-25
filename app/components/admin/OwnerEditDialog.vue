<script setup lang="ts">
/**
 * OwnerEditDialog — dialog edit owner oleh COO (Story 1.8, Req 2).
 * Menggunakan Drawer di mobile, Dialog di desktop.
 *
 * Fitur:
 * - Edit field: fullName, alias, phoneNumber, emergency contact, bank account
 * - Status field DISABLED dengan tooltip (AD-11)
 * - Email field DISABLED (identifier unik)
 * - Audit trail ditulis otomatis di server (AD-3)
 *
 * Props:
 * - open: boolean — kontrol buka/tutup
 * - ownerId: string — ID owner yang diedit
 *
 * Emits:
 * - update:open — saat dialog ditutup
 * - saved — saat berhasil simpan
 */
import { computed, ref, watch } from 'vue'
import {
  BANK_LAINNYA,
  DAFTAR_BANK,
  DAFTAR_HUBUNGAN,
  PANJANG_MAKS_ALIAS,
  PANJANG_MAKS_NAMA,
  PANJANG_MAKS_REKENING,
  sanitasiNomor,
} from '#shared/domain/profil'
import {
  BADGE_VARIANT,
  LABEL_STATUS,
  type GetOwnerResponse,
  type UpdateOwnerRequest,
} from '~/lib/admin-owners'
import { BREAKPOINT_MD } from '~/lib/responsive'

const props = defineProps<{
  open: boolean
  ownerId: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

/** Loading state untuk fetch detail dan simpan. */
const loading = ref(false)
const saving = ref(false)
const errorMsg = ref('')

/** Data owner dari API. */
const ownerData = ref<GetOwnerResponse | null>(null)

/** Form state — shallow reactive copy dari ownerData. */
const form = ref({
  fullName: '',
  alias: '',
  phoneNumber: '',
  emergencyContactName: '',
  emergencyContactPhoneNumber: '',
  emergencyContactRelationship: '',
  bankName: '',
  otherBankName: '',
  accountHolderName: '',
  accountNumber: '',
})

/** Dropdown values terurut alfabetis. */
const BANK_TERURUT = [...DAFTAR_BANK].sort((a, b) => a.localeCompare(b, 'id'))
const HUBUNGAN_TERURUT = [...DAFTAR_HUBUNGAN].sort((a, b) => a.localeCompare(b, 'id'))

/** Responsive container — Drawer di mobile, Dialog di desktop. */
const isMobile = ref(false)
if (import.meta.client) {
  isMobile.value = window.innerWidth < BREAKPOINT_MD
  window.addEventListener('resize', () => {
    isMobile.value = window.innerWidth < BREAKPOINT_MD
  })
}

/** Computed untuk tampilkan/tidak form berdasarkan loading. */
const showForm = computed(() => !loading.value && ownerData.value !== null)

/** Fetch owner detail saat dialog dibuka. */
watch(() => props.open, async (isOpen) => {
  if (!isOpen) return
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await $fetch<GetOwnerResponse>(`/api/admin/owners/${props.ownerId}`)
    ownerData.value = data

    // Populate form
    const o = data.owner
    const ec = data.emergencyContact
    const ba = data.bankAccount
    form.value = {
      fullName: o.fullName ?? '',
      alias: o.alias ?? '',
      phoneNumber: o.phoneNumber ?? '',
      emergencyContactName: ec?.name ?? '',
      emergencyContactPhoneNumber: ec?.phoneNumber ?? '',
      emergencyContactRelationship: ec?.relationship ?? '',
      bankName: ba?.bankName ?? '',
      otherBankName: ba?.otherBankName ?? '',
      accountHolderName: ba?.accountHolderName ?? '',
      accountNumber: ba?.accountNumber ?? '',
    }
  } catch {
    errorMsg.value = 'Gagal memuat data owner.'
  } finally {
    loading.value = false
  }
}, { immediate: true })

/** Filter input nomor (HP/rekening). */
function handleNomorInput(event: Event, field: 'phoneNumber' | 'emergencyContactPhoneNumber' | 'accountNumber') {
  const input = event.target as HTMLInputElement
  const cleaned = sanitasiNomor(input.value)
  form.value[field] = cleaned
  input.value = cleaned
}

/** Simpan perubahan. */
async function simpan() {
  if (saving.value) return
  saving.value = true
  errorMsg.value = ''

  try {
    const body: UpdateOwnerRequest = {}

    // Only include changed fields
    if (form.value.fullName !== (ownerData.value?.owner.fullName ?? '')) {
      body.fullName = form.value.fullName || undefined
    }
    if (form.value.alias !== (ownerData.value?.owner.alias ?? '')) {
      body.alias = form.value.alias || undefined
    }
    if (form.value.phoneNumber !== (ownerData.value?.owner.phoneNumber ?? '')) {
      body.phoneNumber = form.value.phoneNumber || undefined
    }

    // Emergency contact
    const ec = ownerData.value?.emergencyContact
    const ecChanged = form.value.emergencyContactName !== (ec?.name ?? '')
      || form.value.emergencyContactPhoneNumber !== (ec?.phoneNumber ?? '')
      || form.value.emergencyContactRelationship !== (ec?.relationship ?? '')
    if (ecChanged) {
      body.emergencyContact = {
        name: form.value.emergencyContactName || undefined,
        phoneNumber: form.value.emergencyContactPhoneNumber || undefined,
        relationship: form.value.emergencyContactRelationship || undefined,
      }
    }

    // Bank account
    const ba = ownerData.value?.bankAccount
    const baChanged = form.value.bankName !== (ba?.bankName ?? '')
      || form.value.otherBankName !== (ba?.otherBankName ?? '')
      || form.value.accountHolderName !== (ba?.accountHolderName ?? '')
      || form.value.accountNumber !== (ba?.accountNumber ?? '')
    if (baChanged) {
      body.bankAccount = {
        bankName: form.value.bankName || undefined,
        otherBankName: form.value.otherBankName || undefined,
        accountHolderName: form.value.accountHolderName || undefined,
        accountNumber: form.value.accountNumber || undefined,
      }
    }

    await $fetch(`/api/admin/owners/${props.ownerId}`, {
      method: 'PUT',
      body,
    })

    emit('saved')
    emit('update:open', false)
  } catch (err) {
    const data = (err as { data?: { code?: string } } | null)?.data
    if (data?.code === 'STATUS_CHANGE_FORBIDDEN') {
      errorMsg.value = 'Perubahan status tidak diizinkan.'
    } else {
      errorMsg.value = 'Gagal menyimpan perubahan.'
    }
  } finally {
    saving.value = false
  }
}

function tutup() {
  emit('update:open', false)
}
</script>

<template>
  <!-- Mobile: Drawer -->
  <Drawer v-if="isMobile" :open="open" @update:open="emit('update:open', $event)">
    <DrawerContent data-testid="owner-edit-dialog">
      <DrawerHeader>
        <DrawerTitle>Edit Owner</DrawerTitle>
        <DrawerDescription>Ubah data owner. Status tidak dapat diubah via form ini.</DrawerDescription>
      </DrawerHeader>

      <div class="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
        <Alert v-if="errorMsg" variant="destructive">{{ errorMsg }}</Alert>

        <div v-if="loading" class="flex items-center justify-center py-8">
          <span class="text-sm text-muted-foreground">Memuat...</span>
        </div>

        <template v-if="showForm && ownerData">
          <!-- Status (readonly dengan tooltip) -->
          <fieldset class="flex flex-col gap-4 rounded-lg border p-4">
            <legend class="px-1 text-sm font-semibold">Status</legend>
            <div class="flex flex-col gap-1">
              <div class="flex items-center gap-2">
                <Badge :variant="BADGE_VARIANT[ownerData.owner.status]">
                  {{ LABEL_STATUS[ownerData.owner.status] }}
                </Badge>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <span class="cursor-help text-xs text-muted-foreground underline decoration-dotted">(tidak dapat diubah)</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p class="max-w-xs text-sm">Status owner hanya dapat berubah melalui event domain yang sah (verifikasi, penolakan, kedaluwarsa, atau keluar).</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </fieldset>

          <!-- Profil Pemilik -->
          <fieldset class="flex flex-col gap-4 rounded-lg border p-4">
            <legend class="px-1 text-sm font-semibold">Profil Pemilik</legend>

            <div class="flex flex-col gap-1">
              <label for="edit-email" class="text-sm font-medium">Email</label>
              <input
                id="edit-email"
                :value="ownerData.owner.email"
                type="text"
                disabled
                class="flex h-11 w-full rounded-md border bg-muted px-3 py-1 text-sm text-muted-foreground opacity-80"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label for="edit-fullName" class="text-sm font-medium">Nama Lengkap</label>
              <input
                id="edit-fullName"
                v-model="form.fullName"
                type="text"
                :maxlength="PANJANG_MAKS_NAMA"
                autocomplete="off"
                class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label for="edit-alias" class="text-sm font-medium">Alias</label>
              <input
                id="edit-alias"
                v-model="form.alias"
                type="text"
                :maxlength="PANJANG_MAKS_ALIAS"
                autocomplete="off"
                class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label for="edit-phoneNumber" class="text-sm font-medium">No HP</label>
              <input
                id="edit-phoneNumber"
                v-model="form.phoneNumber"
                type="text"
                inputmode="tel"
                autocomplete="off"
                class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
                @input="handleNomorInput($event, 'phoneNumber')"
              >
            </div>
          </fieldset>

          <!-- Kontak Darurat -->
          <fieldset class="flex flex-col gap-4 rounded-lg border p-4">
            <legend class="px-1 text-sm font-semibold">Kontak Darurat</legend>

            <div class="flex flex-col gap-1">
              <label for="edit-ecName" class="text-sm font-medium">Nama</label>
              <input
                id="edit-ecName"
                v-model="form.emergencyContactName"
                type="text"
                :maxlength="PANJANG_MAKS_NAMA"
                autocomplete="off"
                class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label for="edit-ecPhone" class="text-sm font-medium">No HP</label>
              <input
                id="edit-ecPhone"
                v-model="form.emergencyContactPhoneNumber"
                type="text"
                inputmode="tel"
                autocomplete="off"
                class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
                @input="handleNomorInput($event, 'emergencyContactPhoneNumber')"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label for="edit-ecRelationship" class="text-sm font-medium">Hubungan</label>
              <Select v-model="form.emergencyContactRelationship">
                <SelectTrigger id="edit-ecRelationship" class="h-11 w-full">
                  <SelectValue placeholder="Pilih hubungan…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem v-for="hubungan in HUBUNGAN_TERURUT" :key="hubungan" :value="hubungan">
                      {{ hubungan }}
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </fieldset>

          <!-- Rekening Bank -->
          <fieldset class="flex flex-col gap-4 rounded-lg border p-4">
            <legend class="px-1 text-sm font-semibold">Rekening Bank</legend>

            <div class="flex flex-col gap-1">
              <label for="edit-accountNumber" class="text-sm font-medium">No. Rekening</label>
              <input
                id="edit-accountNumber"
                v-model="form.accountNumber"
                type="text"
                inputmode="numeric"
                :maxlength="PANJANG_MAKS_REKENING"
                autocomplete="off"
                class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
                @input="handleNomorInput($event, 'accountNumber')"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label for="edit-accountHolderName" class="text-sm font-medium">Nama Pemilik</label>
              <input
                id="edit-accountHolderName"
                v-model="form.accountHolderName"
                type="text"
                :maxlength="PANJANG_MAKS_NAMA"
                autocomplete="off"
                class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label for="edit-bankName" class="text-sm font-medium">Bank</label>
              <Select v-model="form.bankName">
                <SelectTrigger id="edit-bankName" class="h-11 w-full">
                  <SelectValue placeholder="Pilih bank…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem v-for="bank in BANK_TERURUT" :key="bank" :value="bank">
                      {{ bank }}
                    </SelectItem>
                    <SelectItem :value="BANK_LAINNYA">{{ BANK_LAINNYA }}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div v-if="form.bankName === BANK_LAINNYA" class="flex flex-col gap-1">
              <label for="edit-otherBankName" class="text-sm font-medium">Bank Lainnya</label>
              <input
                id="edit-otherBankName"
                v-model="form.otherBankName"
                type="text"
                :maxlength="PANJANG_MAKS_NAMA"
                autocomplete="off"
                class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
              >
            </div>
          </fieldset>
        </template>
      </div>

      <DrawerFooter>
        <Button :disabled="saving || loading" @click="simpan">
          {{ saving ? 'Menyimpan…' : 'Simpan' }}
        </Button>
        <DrawerClose as-child>
          <Button variant="outline" @click="tutup">Batal</Button>
        </DrawerClose>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>

  <!-- Desktop: Dialog -->
  <Dialog v-else :open="open" @update:open="emit('update:open', $event)">
    <DialogContent data-testid="owner-edit-dialog" class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Edit Owner</DialogTitle>
        <DialogDescription>Ubah data owner. Status tidak dapat diubah via form ini.</DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4">
        <Alert v-if="errorMsg" variant="destructive">{{ errorMsg }}</Alert>

        <div v-if="loading" class="flex items-center justify-center py-8">
          <span class="text-sm text-muted-foreground">Memuat...</span>
        </div>

        <template v-if="showForm && ownerData">
          <!-- Status (readonly dengan tooltip) -->
          <fieldset class="flex flex-col gap-4 rounded-lg border p-4">
            <legend class="px-1 text-sm font-semibold">Status</legend>
            <div class="flex flex-col gap-1">
              <div class="flex items-center gap-2">
                <Badge :variant="BADGE_VARIANT[ownerData.owner.status]">
                  {{ LABEL_STATUS[ownerData.owner.status] }}
                </Badge>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <span class="cursor-help text-xs text-muted-foreground underline decoration-dotted">(tidak dapat diubah)</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p class="max-w-xs text-sm">Status owner hanya dapat berubah melalui event domain yang sah (verifikasi, penolakan, kedaluwarsa, atau keluar).</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </fieldset>

          <!-- Two column layout for desktop -->
          <div class="grid gap-4 md:grid-cols-2">
            <!-- Profil Pemilik -->
            <fieldset class="flex flex-col gap-4 rounded-lg border p-4">
              <legend class="px-1 text-sm font-semibold">Profil Pemilik</legend>

              <div class="flex flex-col gap-1">
                <label for="edit-email-d" class="text-sm font-medium">Email</label>
                <input
                  id="edit-email-d"
                  :value="ownerData.owner.email"
                  type="text"
                  disabled
                  class="flex h-11 w-full rounded-md border bg-muted px-3 py-1 text-sm text-muted-foreground opacity-80"
                >
              </div>

              <div class="flex flex-col gap-1">
                <label for="edit-fullName-d" class="text-sm font-medium">Nama Lengkap</label>
                <input
                  id="edit-fullName-d"
                  v-model="form.fullName"
                  type="text"
                  :maxlength="PANJANG_MAKS_NAMA"
                  autocomplete="off"
                  class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
                >
              </div>

              <div class="flex flex-col gap-1">
                <label for="edit-alias-d" class="text-sm font-medium">Alias</label>
                <input
                  id="edit-alias-d"
                  v-model="form.alias"
                  type="text"
                  :maxlength="PANJANG_MAKS_ALIAS"
                  autocomplete="off"
                  class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
                >
              </div>

              <div class="flex flex-col gap-1">
                <label for="edit-phoneNumber-d" class="text-sm font-medium">No HP</label>
                <input
                  id="edit-phoneNumber-d"
                  v-model="form.phoneNumber"
                  type="text"
                  inputmode="tel"
                  autocomplete="off"
                  class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
                  @input="handleNomorInput($event, 'phoneNumber')"
                >
              </div>
            </fieldset>

            <!-- Kontak Darurat -->
            <fieldset class="flex flex-col gap-4 rounded-lg border p-4">
              <legend class="px-1 text-sm font-semibold">Kontak Darurat</legend>

              <div class="flex flex-col gap-1">
                <label for="edit-ecName-d" class="text-sm font-medium">Nama</label>
                <input
                  id="edit-ecName-d"
                  v-model="form.emergencyContactName"
                  type="text"
                  :maxlength="PANJANG_MAKS_NAMA"
                  autocomplete="off"
                  class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
                >
              </div>

              <div class="flex flex-col gap-1">
                <label for="edit-ecPhone-d" class="text-sm font-medium">No HP</label>
                <input
                  id="edit-ecPhone-d"
                  v-model="form.emergencyContactPhoneNumber"
                  type="text"
                  inputmode="tel"
                  autocomplete="off"
                  class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
                  @input="handleNomorInput($event, 'emergencyContactPhoneNumber')"
                >
              </div>

              <div class="flex flex-col gap-1">
                <label for="edit-ecRelationship-d" class="text-sm font-medium">Hubungan</label>
                <Select v-model="form.emergencyContactRelationship">
                  <SelectTrigger id="edit-ecRelationship-d" class="h-11 w-full">
                    <SelectValue placeholder="Pilih hubungan…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem v-for="hubungan in HUBUNGAN_TERURUT" :key="hubungan" :value="hubungan">
                        {{ hubungan }}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </fieldset>
          </div>

          <!-- Rekening Bank (full width) -->
          <fieldset class="flex flex-col gap-4 rounded-lg border p-4 md:grid md:grid-cols-2">
            <legend class="px-1 text-sm font-semibold md:col-span-2">Rekening Bank</legend>

            <div class="flex flex-col gap-1">
              <label for="edit-accountNumber-d" class="text-sm font-medium">No. Rekening</label>
              <input
                id="edit-accountNumber-d"
                v-model="form.accountNumber"
                type="text"
                inputmode="numeric"
                :maxlength="PANJANG_MAKS_REKENING"
                autocomplete="off"
                class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
                @input="handleNomorInput($event, 'accountNumber')"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label for="edit-accountHolderName-d" class="text-sm font-medium">Nama Pemilik</label>
              <input
                id="edit-accountHolderName-d"
                v-model="form.accountHolderName"
                type="text"
                :maxlength="PANJANG_MAKS_NAMA"
                autocomplete="off"
                class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label for="edit-bankName-d" class="text-sm font-medium">Bank</label>
              <Select v-model="form.bankName">
                <SelectTrigger id="edit-bankName-d" class="h-11 w-full">
                  <SelectValue placeholder="Pilih bank…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem v-for="bank in BANK_TERURUT" :key="bank" :value="bank">
                      {{ bank }}
                    </SelectItem>
                    <SelectItem :value="BANK_LAINNYA">{{ BANK_LAINNYA }}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div v-if="form.bankName === BANK_LAINNYA" class="flex flex-col gap-1">
              <label for="edit-otherBankName-d" class="text-sm font-medium">Bank Lainnya</label>
              <input
                id="edit-otherBankName-d"
                v-model="form.otherBankName"
                type="text"
                :maxlength="PANJANG_MAKS_NAMA"
                autocomplete="off"
                class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
              >
            </div>
          </fieldset>
        </template>
      </div>

      <DialogFooter class="gap-2 sm:gap-0">
        <Button variant="outline" @click="tutup">Batal</Button>
        <Button :disabled="saving || loading" @click="simpan">
          {{ saving ? 'Menyimpan…' : 'Simpan' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
