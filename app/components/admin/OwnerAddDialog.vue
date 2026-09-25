<script setup lang="ts">
/**
 * OwnerAddDialog — dialog tambah owner baru oleh COO (Story 1.8, Req 3).
 * Menggunakan Drawer di mobile, Dialog di desktop.
 *
 * Fitur:
 * - Email WAJIB dan harus unik
 * - Owner dibuat dengan status `terverifikasi` (pre-approved)
 * - Field opsional: fullName, alias, phoneNumber, emergency contact, bank account
 * - Audit trail ditulis otomatis di server (AD-3)
 *
 * Props:
 * - open: boolean — kontrol buka/tutup
 *
 * Emits:
 * - update:open — saat dialog ditutup
 * - saved — saat berhasil simpan
 */
import { ref, watch } from 'vue'
import {
  BANK_LAINNYA,
  DAFTAR_BANK,
  DAFTAR_HUBUNGAN,
  PANJANG_MAKS_ALIAS,
  PANJANG_MAKS_NAMA,
  PANJANG_MAKS_REKENING,
  sanitasiNomor,
} from '#shared/domain/profil'
import type { CreateOwnerRequest, CreateOwnerResponse } from '~/lib/admin-owners'
import { BREAKPOINT_MD } from '~/lib/responsive'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'saved': []
}>()

/** Loading state. */
const saving = ref(false)
const errorMsg = ref('')
const emailError = ref('')

/** Form state. */
const form = ref({
  email: '',
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

/** Reset form saat dialog dibuka. */
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    form.value = {
      email: '',
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
    }
    errorMsg.value = ''
    emailError.value = ''
  }
})

/** Filter input nomor (HP/rekening). */
function handleNomorInput(event: Event, field: 'phoneNumber' | 'emergencyContactPhoneNumber' | 'accountNumber') {
  const input = event.target as HTMLInputElement
  const cleaned = sanitasiNomor(input.value)
  form.value[field] = cleaned
  input.value = cleaned
}

/** Simpan owner baru. */
async function simpan() {
  if (saving.value) return

  // Validasi email
  if (!form.value.email.trim()) {
    emailError.value = 'Email wajib diisi.'
    return
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
    emailError.value = 'Format email tidak valid.'
    return
  }

  saving.value = true
  errorMsg.value = ''
  emailError.value = ''

  try {
    const body: CreateOwnerRequest = {
      email: form.value.email.trim(),
    }

    // Optional fields
    if (form.value.fullName.trim()) body.fullName = form.value.fullName.trim()
    if (form.value.alias.trim()) body.alias = form.value.alias.trim()
    if (form.value.phoneNumber.trim()) body.phoneNumber = form.value.phoneNumber.trim()

    // Emergency contact (only if any field filled)
    if (form.value.emergencyContactName.trim() || form.value.emergencyContactPhoneNumber.trim() || form.value.emergencyContactRelationship) {
      body.emergencyContact = {}
      if (form.value.emergencyContactName.trim()) body.emergencyContact.name = form.value.emergencyContactName.trim()
      if (form.value.emergencyContactPhoneNumber.trim()) body.emergencyContact.phoneNumber = form.value.emergencyContactPhoneNumber.trim()
      if (form.value.emergencyContactRelationship) body.emergencyContact.relationship = form.value.emergencyContactRelationship
    }

    // Bank account (only if any field filled)
    if (form.value.bankName || form.value.accountHolderName.trim() || form.value.accountNumber.trim()) {
      body.bankAccount = {}
      if (form.value.bankName) body.bankAccount.bankName = form.value.bankName
      if (form.value.bankName === BANK_LAINNYA && form.value.otherBankName.trim()) {
        body.bankAccount.otherBankName = form.value.otherBankName.trim()
      }
      if (form.value.accountHolderName.trim()) body.bankAccount.accountHolderName = form.value.accountHolderName.trim()
      if (form.value.accountNumber.trim()) body.bankAccount.accountNumber = form.value.accountNumber.trim()
    }

    await $fetch<CreateOwnerResponse>('/api/admin/owners', {
      method: 'POST',
      body,
    })

    emit('saved')
    emit('update:open', false)
  } catch (err) {
    const data = (err as { data?: { code?: string } } | null)?.data
    if (data?.code === 'EMAIL_EXISTS') {
      emailError.value = 'Email sudah terdaftar.'
    } else {
      errorMsg.value = 'Gagal menambahkan owner.'
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
    <DrawerContent data-testid="owner-add-dialog">
      <DrawerHeader>
        <DrawerTitle>Tambah Owner</DrawerTitle>
        <DrawerDescription>Tambah owner baru. Owner akan langsung berstatus Terverifikasi (pre-approved).</DrawerDescription>
      </DrawerHeader>

      <div class="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
        <Alert v-if="errorMsg" variant="destructive">{{ errorMsg }}</Alert>

        <Alert variant="default" class="border-primary/40 bg-primary/10">
          <p class="text-sm">
            Owner yang ditambahkan COO langsung berstatus <strong>Terverifikasi</strong> tanpa perlu verifikasi email.
          </p>
        </Alert>

        <!-- Email (wajib) -->
        <fieldset class="flex flex-col gap-4 rounded-lg border p-4">
          <legend class="px-1 text-sm font-semibold">Email <span class="text-destructive">*</span></legend>
          <div class="flex flex-col gap-1">
            <label for="add-email" class="sr-only">Email</label>
            <input
              id="add-email"
              v-model="form.email"
              type="email"
              placeholder="owner@email.com"
              autocomplete="off"
              class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
              :class="{ 'border-destructive': emailError }"
            >
            <p v-if="emailError" class="text-xs text-destructive">{{ emailError }}</p>
          </div>
        </fieldset>

        <!-- Profil Pemilik (opsional) -->
        <fieldset class="flex flex-col gap-4 rounded-lg border p-4">
          <legend class="px-1 text-sm font-semibold">Profil Pemilik <span class="text-xs font-normal text-muted-foreground">(opsional)</span></legend>

          <div class="flex flex-col gap-1">
            <label for="add-fullName" class="text-sm font-medium">Nama Lengkap</label>
            <input
              id="add-fullName"
              v-model="form.fullName"
              type="text"
              :maxlength="PANJANG_MAKS_NAMA"
              autocomplete="off"
              class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
            >
          </div>

          <div class="flex flex-col gap-1">
            <label for="add-alias" class="text-sm font-medium">Alias</label>
            <input
              id="add-alias"
              v-model="form.alias"
              type="text"
              :maxlength="PANJANG_MAKS_ALIAS"
              autocomplete="off"
              class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
            >
          </div>

          <div class="flex flex-col gap-1">
            <label for="add-phoneNumber" class="text-sm font-medium">No HP</label>
            <input
              id="add-phoneNumber"
              v-model="form.phoneNumber"
              type="text"
              inputmode="tel"
              autocomplete="off"
              class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
              @input="handleNomorInput($event, 'phoneNumber')"
            >
          </div>
        </fieldset>

        <!-- Kontak Darurat (opsional) -->
        <fieldset class="flex flex-col gap-4 rounded-lg border p-4">
          <legend class="px-1 text-sm font-semibold">Kontak Darurat <span class="text-xs font-normal text-muted-foreground">(opsional)</span></legend>

          <div class="flex flex-col gap-1">
            <label for="add-ecName" class="text-sm font-medium">Nama</label>
            <input
              id="add-ecName"
              v-model="form.emergencyContactName"
              type="text"
              :maxlength="PANJANG_MAKS_NAMA"
              autocomplete="off"
              class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
            >
          </div>

          <div class="flex flex-col gap-1">
            <label for="add-ecPhone" class="text-sm font-medium">No HP</label>
            <input
              id="add-ecPhone"
              v-model="form.emergencyContactPhoneNumber"
              type="text"
              inputmode="tel"
              autocomplete="off"
              class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
              @input="handleNomorInput($event, 'emergencyContactPhoneNumber')"
            >
          </div>

          <div class="flex flex-col gap-1">
            <label for="add-ecRelationship" class="text-sm font-medium">Hubungan</label>
            <Select v-model="form.emergencyContactRelationship">
              <SelectTrigger id="add-ecRelationship" class="h-11 w-full">
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

        <!-- Rekening Bank (opsional) -->
        <fieldset class="flex flex-col gap-4 rounded-lg border p-4">
          <legend class="px-1 text-sm font-semibold">Rekening Bank <span class="text-xs font-normal text-muted-foreground">(opsional)</span></legend>

          <div class="flex flex-col gap-1">
            <label for="add-accountNumber" class="text-sm font-medium">No. Rekening</label>
            <input
              id="add-accountNumber"
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
            <label for="add-accountHolderName" class="text-sm font-medium">Nama Pemilik</label>
            <input
              id="add-accountHolderName"
              v-model="form.accountHolderName"
              type="text"
              :maxlength="PANJANG_MAKS_NAMA"
              autocomplete="off"
              class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
            >
          </div>

          <div class="flex flex-col gap-1">
            <label for="add-bankName" class="text-sm font-medium">Bank</label>
            <Select v-model="form.bankName">
              <SelectTrigger id="add-bankName" class="h-11 w-full">
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
            <label for="add-otherBankName" class="text-sm font-medium">Bank Lainnya</label>
            <input
              id="add-otherBankName"
              v-model="form.otherBankName"
              type="text"
              :maxlength="PANJANG_MAKS_NAMA"
              autocomplete="off"
              class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
            >
          </div>
        </fieldset>
      </div>

      <DrawerFooter>
        <Button :disabled="saving" @click="simpan">
          {{ saving ? 'Menyimpan…' : 'Tambah Owner' }}
        </Button>
        <DrawerClose as-child>
          <Button variant="outline" @click="tutup">Batal</Button>
        </DrawerClose>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>

  <!-- Desktop: Dialog -->
  <Dialog v-else :open="open" @update:open="emit('update:open', $event)">
    <DialogContent data-testid="owner-add-dialog" class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Tambah Owner</DialogTitle>
        <DialogDescription>Tambah owner baru. Owner akan langsung berstatus Terverifikasi (pre-approved).</DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4">
        <Alert v-if="errorMsg" variant="destructive">{{ errorMsg }}</Alert>

        <Alert variant="default" class="border-primary/40 bg-primary/10">
          <p class="text-sm">
            Owner yang ditambahkan COO langsung berstatus <strong>Terverifikasi</strong> tanpa perlu verifikasi email.
          </p>
        </Alert>

        <!-- Email (wajib) -->
        <fieldset class="flex flex-col gap-4 rounded-lg border p-4">
          <legend class="px-1 text-sm font-semibold">Email <span class="text-destructive">*</span></legend>
          <div class="flex flex-col gap-1">
            <label for="add-email-d" class="sr-only">Email</label>
            <input
              id="add-email-d"
              v-model="form.email"
              type="email"
              placeholder="owner@email.com"
              autocomplete="off"
              class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
              :class="{ 'border-destructive': emailError }"
            >
            <p v-if="emailError" class="text-xs text-destructive">{{ emailError }}</p>
          </div>
        </fieldset>

        <!-- Two column layout for desktop -->
        <div class="grid gap-4 md:grid-cols-2">
          <!-- Profil Pemilik (opsional) -->
          <fieldset class="flex flex-col gap-4 rounded-lg border p-4">
            <legend class="px-1 text-sm font-semibold">Profil Pemilik <span class="text-xs font-normal text-muted-foreground">(opsional)</span></legend>

            <div class="flex flex-col gap-1">
              <label for="add-fullName-d" class="text-sm font-medium">Nama Lengkap</label>
              <input
                id="add-fullName-d"
                v-model="form.fullName"
                type="text"
                :maxlength="PANJANG_MAKS_NAMA"
                autocomplete="off"
                class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label for="add-alias-d" class="text-sm font-medium">Alias</label>
              <input
                id="add-alias-d"
                v-model="form.alias"
                type="text"
                :maxlength="PANJANG_MAKS_ALIAS"
                autocomplete="off"
                class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label for="add-phoneNumber-d" class="text-sm font-medium">No HP</label>
              <input
                id="add-phoneNumber-d"
                v-model="form.phoneNumber"
                type="text"
                inputmode="tel"
                autocomplete="off"
                class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
                @input="handleNomorInput($event, 'phoneNumber')"
              >
            </div>
          </fieldset>

          <!-- Kontak Darurat (opsional) -->
          <fieldset class="flex flex-col gap-4 rounded-lg border p-4">
            <legend class="px-1 text-sm font-semibold">Kontak Darurat <span class="text-xs font-normal text-muted-foreground">(opsional)</span></legend>

            <div class="flex flex-col gap-1">
              <label for="add-ecName-d" class="text-sm font-medium">Nama</label>
              <input
                id="add-ecName-d"
                v-model="form.emergencyContactName"
                type="text"
                :maxlength="PANJANG_MAKS_NAMA"
                autocomplete="off"
                class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label for="add-ecPhone-d" class="text-sm font-medium">No HP</label>
              <input
                id="add-ecPhone-d"
                v-model="form.emergencyContactPhoneNumber"
                type="text"
                inputmode="tel"
                autocomplete="off"
                class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
                @input="handleNomorInput($event, 'emergencyContactPhoneNumber')"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label for="add-ecRelationship-d" class="text-sm font-medium">Hubungan</label>
              <Select v-model="form.emergencyContactRelationship">
                <SelectTrigger id="add-ecRelationship-d" class="h-11 w-full">
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

        <!-- Rekening Bank (full width, opsional) -->
        <fieldset class="flex flex-col gap-4 rounded-lg border p-4 md:grid md:grid-cols-2">
          <legend class="px-1 text-sm font-semibold md:col-span-2">Rekening Bank <span class="text-xs font-normal text-muted-foreground">(opsional)</span></legend>

          <div class="flex flex-col gap-1">
            <label for="add-accountNumber-d" class="text-sm font-medium">No. Rekening</label>
            <input
              id="add-accountNumber-d"
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
            <label for="add-accountHolderName-d" class="text-sm font-medium">Nama Pemilik</label>
            <input
              id="add-accountHolderName-d"
              v-model="form.accountHolderName"
              type="text"
              :maxlength="PANJANG_MAKS_NAMA"
              autocomplete="off"
              class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
            >
          </div>

          <div class="flex flex-col gap-1">
            <label for="add-bankName-d" class="text-sm font-medium">Bank</label>
            <Select v-model="form.bankName">
              <SelectTrigger id="add-bankName-d" class="h-11 w-full">
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
            <label for="add-otherBankName-d" class="text-sm font-medium">Bank Lainnya</label>
            <input
              id="add-otherBankName-d"
              v-model="form.otherBankName"
              type="text"
              :maxlength="PANJANG_MAKS_NAMA"
              autocomplete="off"
              class="flex h-11 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
            >
          </div>
        </fieldset>
      </div>

      <DialogFooter class="gap-2 sm:gap-0">
        <Button variant="outline" @click="tutup">Batal</Button>
        <Button :disabled="saving" @click="simpan">
          {{ saving ? 'Menyimpan…' : 'Tambah Owner' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
