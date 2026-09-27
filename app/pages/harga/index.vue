<script setup lang="ts">
import {
  PRICE_LIMIT_DEFAULT,
  PRICE_LIMIT_OPSI,
  type PriceCorrectInput,
  type PriceLimit,
  type PriceWire,
} from '#shared/domain/price'
import { LANDING_PATH } from '#shared/domain/identity'
import type { MomWire } from '#shared/domain/mom'
import type { LandingRespons } from '~/lib/landing'
import {
  formatTanggalSingkat,
  formatRupiah,
  PETA_LABEL_TIPE,
  PETA_WARNA_TIPE,
  HTTP_FORBIDDEN,
  type PriceDaftar,
  type PriceResolveResult,
} from '~/lib/harga'

/**
 * Halaman Harga — untuk pemegang saham, COO, dan owner tanpa saham (Req-4, AD-8).
 * Menampilkan harga berjalan (beli dan jual) serta riwayat harga.
 * COO dapat mengelola harga; lainnya hanya baca.
 * Layout `app` (Story 2.1b — nav registry).
 *
 * Fitur Koreksi Harga (Req-3 AC4):
 * - Dialog koreksi terbuka via tombol "Koreksi" pada tiap baris riwayat (COO saja)
 * - Dialog menampilkan info harga saat ini (tipe, tanggal, nilai)
 * - Input nilai baru + dropdown MoM final untuk referensi
 * - Submit ke PUT /api/harga/[id], audit `price-corrected`
 *
 * **Validates: Requirements 3, 4**
 */
definePageMeta({ layout: 'app', auth: true, key: route => route.fullPath })

const api = useRequestFetch()

const landing = await api<LandingRespons>('/api/landing').catch(() => null)
if (!landing) {
  await navigateTo('/login')
} else if ('unlinked' in landing) {
  await navigateTo('/login?res=unlinked')
} else if (landing.role === 'calon_owner') {
  // Calon owner tidak boleh akses harga — redirect ke landing calon
  await navigateTo(LANDING_PATH.calon_owner)
}

// ---------------------------------------------------------------------------
// Pagination Query Parsing (pola mom/index.vue)
// ---------------------------------------------------------------------------
const POLA_ANGKA = /^\d+$/
const MAKS_ANGKA_AMAN = Number.MAX_SAFE_INTEGER

function parseAngka(nilai: unknown): number | null {
  if (typeof nilai !== 'string' || !POLA_ANGKA.test(nilai)) return null
  const hasil = Number.parseInt(nilai, 10)
  return hasil >= 1 && hasil <= MAKS_ANGKA_AMAN ? hasil : null
}

const route = useRoute()
const HALAMAN_AWAL = 1
const halamanAktif = parseAngka(route.query.page) ?? HALAMAN_AWAL
const limitAktif = parseAngka(route.query.limit)
const ukuranAktif = limitAktif !== null && PRICE_LIMIT_OPSI.includes(limitAktif as PriceLimit)
  ? (limitAktif as PriceLimit)
  : PRICE_LIMIT_DEFAULT

function tautanHarga(halaman: number, ukuran: PriceLimit): string {
  const params: string[] = []
  if (halaman > 1) params.push(`page=${halaman}`)
  if (ukuran !== PRICE_LIMIT_DEFAULT) params.push(`limit=${ukuran}`)
  return params.length === 0 ? '/harga' : `/harga?${params.join('&')}`
}

// ---------------------------------------------------------------------------
// Data Loading
// ---------------------------------------------------------------------------

/** Muat harga berjalan — 403 defensif → /personal (pola mom/index.vue). */
async function muatHargaBerjalan(): Promise<PriceResolveResult | null> {
  try {
    return await api<PriceResolveResult>('/api/harga/resolve')
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode === HTTP_FORBIDDEN) {
      await navigateTo('/personal')
    }
    return null
  }
}

/** Muat riwayat harga — 403 defensif → /personal. */
async function muatRiwayatHarga(): Promise<PriceDaftar | null> {
  try {
    return await api<PriceDaftar>(`/api/harga?page=${halamanAktif}&limit=${ukuranAktif}`)
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode === HTTP_FORBIDDEN) {
      await navigateTo('/personal')
    }
    return null
  }
}

// Muat data paralel (reactive refs untuk reload setelah koreksi)
const hargaBerjalanRef = ref<PriceResolveResult | null>(null)
const hasilRiwayatRef = ref<PriceDaftar | null>(null)

const [initialHargaBerjalan, initialHasilRiwayat] = landing && !('unlinked' in landing) && landing.role !== 'calon_owner'
  ? await Promise.all([muatHargaBerjalan(), muatRiwayatHarga()])
  : [null, null]

hargaBerjalanRef.value = initialHargaBerjalan
hasilRiwayatRef.value = initialHasilRiwayat

const gagalMuatBerjalan = computed(() => hargaBerjalanRef.value === null)
const gagalMuatRiwayat = computed(() => hasilRiwayatRef.value === null)
const riwayatKosong = computed(() => hasilRiwayatRef.value !== null && hasilRiwayatRef.value.data.length === 0)
const nextPage = computed(() => hasilRiwayatRef.value?.nextPage ?? null)
const isCoo = landing && !('unlinked' in landing) && landing.role === 'coo'

// ---------------------------------------------------------------------------
// Dialog Koreksi Harga (Req-3 AC4) — COO only
// ---------------------------------------------------------------------------
interface MomListResponse {
  data: MomWire[]
}

/** Harga yang sedang dikoreksi (membuka dialog). */
const hargaDikoreksi = ref<PriceWire | null>(null)
const dialogTerbuka = computed({
  get: () => hargaDikoreksi.value !== null,
  set: (val: boolean) => { if (!val) hargaDikoreksi.value = null },
})

/** Form state untuk koreksi. */
const koreksiAmount = ref('')
const koreksiMomId = ref('')
const koreksiSaving = ref(false)
const koreksiError = ref('')

/** Daftar MoM final untuk dropdown. */
const momList = ref<MomWire[]>([])
const momLoading = ref(false)
const momError = ref('')

/** Muat MoM final saat dialog dibuka. */
async function loadFinalMoms() {
  momLoading.value = true
  momError.value = ''
  try {
    const result = await $fetch<MomListResponse>('/api/mom?status=final')
    momList.value = result.data
  } catch {
    momError.value = 'Gagal memuat daftar MoM.'
  } finally {
    momLoading.value = false
  }
}

/** Buka dialog koreksi untuk harga tertentu. */
function bukaKoreksi(price: PriceWire) {
  hargaDikoreksi.value = price
  // Pre-fill dengan nilai saat ini
  koreksiAmount.value = formatRupiahInput(price.amount)
  koreksiMomId.value = price.momId
  koreksiError.value = ''
  // Muat MoM final
  loadFinalMoms()
}

/** Tutup dialog koreksi dan reset state. */
function tutupKoreksi() {
  hargaDikoreksi.value = null
  koreksiAmount.value = ''
  koreksiMomId.value = ''
  koreksiError.value = ''
}

/**
 * Format nilai amount dari API ke format input id-ID (untuk pre-fill).
 * "52000.00" → "52.000"
 */
function formatRupiahInput(amount: string): string {
  const normalized = amount.replace(/\./g, '').replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  if (Number.isNaN(parsed)) return amount
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(parsed)
}

/**
 * Normalisasi input rupiah id-ID ke format kanonik.
 * Menerima: "52.000" atau "52000" atau "52.000,50" atau "52000.50"
 * Mengembalikan: "52000.00" atau "52000.50"
 */
function normalizeRupiahInput(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''

  const idIdPattern = /^[\d.]+(?:,\d+)?$/
  const canonicalPattern = /^\d+(?:\.\d+)?$/
  const PANJANG_KELOMPOK_RIBUAN = 3

  if (idIdPattern.test(trimmed) && trimmed.includes('.') && !trimmed.includes(',')) {
    const parts = trimmed.split('.')
    const isThousandsSeparator = parts.length > 1 && parts.slice(1).every(p => p.length === PANJANG_KELOMPOK_RIBUAN)
    if (isThousandsSeparator) {
      return parts.join('') + '.00'
    }
    return trimmed
  }

  if (trimmed.includes(',')) {
    const normalized = trimmed.replace(/\./g, '').replace(',', '.')
    return normalized
  }

  if (canonicalPattern.test(trimmed)) {
    if (!trimmed.includes('.')) {
      return trimmed + '.00'
    }
    return trimmed
  }

  return trimmed
}

/** Submit koreksi harga ke PUT /api/harga/[id]. */
async function submitKoreksi() {
  if (!hargaDikoreksi.value) return

  koreksiError.value = ''

  // Client-side validation
  if (!koreksiAmount.value.trim()) {
    koreksiError.value = 'Nilai harga baru wajib diisi.'
    return
  }
  if (!koreksiMomId.value) {
    koreksiError.value = 'MoM referensi wajib dipilih.'
    return
  }

  koreksiSaving.value = true

  try {
    const normalizedAmount = normalizeRupiahInput(koreksiAmount.value)

    const input: PriceCorrectInput = {
      amount: normalizedAmount,
      momId: koreksiMomId.value,
    }

    await $fetch<PriceWire>(`/api/harga/${hargaDikoreksi.value.id}`, {
      method: 'PUT',
      body: input,
    })

    // Sukses: tutup dialog dan refresh data
    tutupKoreksi()
    await refreshData()
  } catch (error: unknown) {
    const err = error as { data?: { message?: string, code?: string } }
    if (err.data?.code === 'MOM_NOT_FINAL') {
      koreksiError.value = 'MoM yang dipilih harus berstatus final.'
    } else if (err.data?.code === 'NOT_FOUND') {
      koreksiError.value = 'Harga tidak ditemukan.'
    } else {
      koreksiError.value = err.data?.message ?? 'Gagal menyimpan koreksi harga.'
    }
  } finally {
    koreksiSaving.value = false
  }
}

/** Refresh data harga berjalan dan riwayat setelah koreksi sukses. */
async function refreshData() {
  const [newBerjalan, newRiwayat] = await Promise.all([
    muatHargaBerjalan(),
    muatRiwayatHarga(),
  ])
  hargaBerjalanRef.value = newBerjalan
  hasilRiwayatRef.value = newRiwayat
}

useHead({ title: 'Harga Saham — Sip & Dip' })
</script>

<template>
  <main data-testid="harga-halaman" class="mx-auto flex min-h-dvh max-w-7xl flex-col gap-6 px-4 py-8">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Harga Saham</h1>
        <p class="text-sm text-muted-foreground">Harga beli dan jual saham Sip & Dip.</p>
      </div>
      <NuxtLink
        v-if="isCoo"
        to="/harga/baru"
        class="flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <span class="text-lg">+</span>
        <span>Tetapkan Harga</span>
      </NuxtLink>
    </header>

    <!-- Harga Berjalan Section -->
    <section data-testid="harga-berjalan">
      <h2 class="mb-3 text-lg font-medium">Harga Berjalan</h2>

      <div
        v-if="gagalMuatBerjalan"
        class="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center"
      >
        <p class="text-sm text-muted-foreground">Harga berjalan gagal dimuat.</p>
        <a href="/harga" class="text-sm font-medium underline underline-offset-4">
          Coba lagi
        </a>
      </div>

      <div
        v-else
        class="grid gap-4 sm:grid-cols-2"
      >
        <!-- Harga Beli Card -->
        <div
          class="flex flex-col gap-2 rounded-lg border p-4"
          data-testid="harga-beli-card"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">Harga Beli</span>
            <span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              Beli
            </span>
          </div>
          <p class="text-2xl font-semibold tabular-nums">
            {{ formatRupiah(hargaBerjalanRef!.beli.amount) }}
          </p>
          <p class="text-xs text-muted-foreground">
            Berlaku sejak {{ formatTanggalSingkat(hargaBerjalanRef!.beli.effectiveDate) }}
          </p>
        </div>

        <!-- Harga Jual Card -->
        <div
          class="flex flex-col gap-2 rounded-lg border p-4"
          data-testid="harga-jual-card"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted-foreground">Harga Jual</span>
            <span class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
              Jual
            </span>
          </div>
          <p class="text-2xl font-semibold tabular-nums">
            {{ formatRupiah(hargaBerjalanRef!.jual.amount) }}
          </p>
          <p class="text-xs text-muted-foreground">
            Berlaku sejak {{ formatTanggalSingkat(hargaBerjalanRef!.jual.effectiveDate) }}
          </p>
        </div>
      </div>
    </section>

    <!-- Riwayat Harga Section -->
    <section data-testid="harga-riwayat">
      <h2 class="mb-3 text-lg font-medium">Riwayat Harga</h2>

      <div
        v-if="gagalMuatRiwayat"
        class="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center"
      >
        <p class="text-sm text-muted-foreground">Riwayat harga gagal dimuat.</p>
        <a href="/harga" class="text-sm font-medium underline underline-offset-4">
          Coba lagi
        </a>
      </div>

      <div
        v-else-if="riwayatKosong"
        data-testid="harga-kosong"
        class="flex items-center justify-center rounded-lg border border-dashed p-10 text-center"
      >
        <p class="text-sm text-muted-foreground">Belum ada harga terdaftar.</p>
      </div>

      <template v-else>
        <!-- Per halaman selector -->
        <div class="mb-4 flex items-center justify-end gap-2" data-testid="harga-ukuran">
          <span class="text-sm text-muted-foreground">Per halaman:</span>
          <NuxtLink
            v-for="opsi in PRICE_LIMIT_OPSI"
            :key="opsi"
            :to="tautanHarga(1, opsi)"
            class="rounded-md px-2 py-1 text-sm tabular-nums"
            :class="opsi === ukuranAktif
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent'"
            :aria-current="opsi === ukuranAktif ? 'true' : undefined"
          >
            {{ opsi }}
          </NuxtLink>
        </div>

        <!-- Riwayat Table -->
        <div class="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="whitespace-nowrap">Nilai</TableHead>
                <TableHead class="whitespace-nowrap">Jenis</TableHead>
                <TableHead class="whitespace-nowrap">Tanggal Efektif</TableHead>
                <TableHead class="whitespace-nowrap">Referensi MRO</TableHead>
                <TableHead v-if="isCoo" class="whitespace-nowrap">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="price in hasilRiwayatRef?.data"
                :key="price.id"
                data-testid="harga-row"
              >
                <TableCell class="whitespace-nowrap tabular-nums font-medium">
                  {{ formatRupiah(price.amount) }}
                </TableCell>
                <TableCell class="whitespace-nowrap">
                  <span
                    class="rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="PETA_WARNA_TIPE[price.type]"
                  >
                    {{ PETA_LABEL_TIPE[price.type] }}
                  </span>
                </TableCell>
                <TableCell class="whitespace-nowrap tabular-nums">
                  {{ formatTanggalSingkat(price.effectiveDate) }}
                </TableCell>
                <TableCell class="max-w-[200px] truncate">
                  <NuxtLink
                    :to="`/mom/${price.momId}`"
                    class="text-primary hover:underline underline-offset-4"
                  >
                    {{ price.momTitle }}
                  </NuxtLink>
                </TableCell>
                <TableCell v-if="isCoo" class="whitespace-nowrap">
                  <button
                    type="button"
                    data-testid="koreksi-btn"
                    class="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
                    @click="bukaKoreksi(price)"
                  >
                    Koreksi
                  </button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <!-- Pagination -->
        <nav
          v-if="halamanAktif > 1 || nextPage !== null"
          data-testid="harga-paginasi"
          class="mt-4 flex items-center justify-between"
          aria-label="Paginasi Harga"
        >
          <NuxtLink
            v-if="halamanAktif > 1"
            :to="tautanHarga(halamanAktif - 1, ukuranAktif)"
            class="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            ← Sebelumnya
          </NuxtLink>
          <span v-else />
          <span class="text-sm text-muted-foreground tabular-nums">Halaman {{ halamanAktif }}</span>
          <NuxtLink
            v-if="nextPage !== null"
            :to="tautanHarga(nextPage, ukuranAktif)"
            class="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            Berikutnya →
          </NuxtLink>
          <span v-else />
        </nav>
      </template>
    </section>

    <!-- Dialog Koreksi Harga (COO only) -->
    <Dialog v-model:open="dialogTerbuka">
      <DialogContent class="max-w-md" data-testid="koreksi-dialog">
        <DialogHeader>
          <DialogTitle>Koreksi Harga</DialogTitle>
          <DialogDescription>
            Ubah nilai harga pada tanggal efektif yang sama. Tipe dan tanggal efektif tidak dapat diubah.
          </DialogDescription>
        </DialogHeader>

        <template v-if="hargaDikoreksi">
          <!-- Info Harga Saat Ini -->
          <div class="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted-foreground">Tipe</span>
              <span
                class="rounded-full px-2.5 py-1 text-sm font-medium"
                :class="PETA_WARNA_TIPE[hargaDikoreksi.type]"
              >
                {{ PETA_LABEL_TIPE[hargaDikoreksi.type] }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted-foreground">Tanggal Efektif</span>
              <span class="text-sm tabular-nums">{{ formatTanggalSingkat(hargaDikoreksi.effectiveDate) }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted-foreground">Nilai Saat Ini</span>
              <span class="font-medium tabular-nums">{{ formatRupiah(hargaDikoreksi.amount) }}</span>
            </div>
          </div>

          <!-- Error Alert -->
          <Alert v-if="koreksiError" variant="destructive" aria-live="assertive">
            {{ koreksiError }}
          </Alert>

          <!-- Form Koreksi -->
          <form class="flex flex-col gap-4" @submit.prevent="submitKoreksi">
            <!-- Amount Input -->
            <div class="flex flex-col gap-2">
              <label for="koreksi-amount" class="text-sm font-medium">
                Nilai Harga Baru <span class="text-destructive">*</span>
              </label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">Rp</span>
                <input
                  id="koreksi-amount"
                  v-model="koreksiAmount"
                  type="text"
                  inputmode="decimal"
                  required
                  placeholder="52.000"
                  data-testid="koreksi-amount-input"
                  class="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm tabular-nums ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
              </div>
            </div>

            <!-- MoM Dropdown -->
            <div class="flex flex-col gap-2">
              <label for="koreksi-mom" class="text-sm font-medium">
                MoM Referensi <span class="text-destructive">*</span>
              </label>

              <div v-if="momLoading" class="flex h-10 items-center text-sm text-muted-foreground">
                Memuat daftar MoM...
              </div>

              <div v-else-if="momError" class="flex h-10 items-center text-sm text-destructive">
                {{ momError }}
              </div>

              <div v-else-if="momList.length === 0" class="flex h-10 items-center text-sm text-muted-foreground">
                Tidak ada MoM final tersedia.
              </div>

              <Select v-else v-model="koreksiMomId">
                <SelectTrigger id="koreksi-mom" data-testid="koreksi-mom-select">
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
                Koreksi harga harus tertaut MoM yang sudah difinalkan.
              </p>
            </div>

            <!-- Dialog Footer -->
            <DialogFooter class="pt-2">
              <DialogClose as-child>
                <button
                  type="button"
                  class="flex h-10 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent"
                >
                  Batal
                </button>
              </DialogClose>
              <button
                type="submit"
                :disabled="koreksiSaving || momLoading || momList.length === 0"
                data-testid="koreksi-submit"
                class="flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {{ koreksiSaving ? 'Menyimpan...' : 'Simpan Koreksi' }}
              </button>
            </DialogFooter>
          </form>
        </template>
      </DialogContent>
    </Dialog>
  </main>
</template>
