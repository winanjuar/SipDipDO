<script setup lang="ts">
import type { OwnerStatus } from '#shared/domain/identity'
import { LANDING_PATH, PANJANG_MAKS_ALASAN_PENOLAKAN } from '#shared/domain/identity'
import { LABEL_FIELD_PROFIL, type KunciProfil } from '#shared/domain/profil'
import type { LandingRespons } from '~/lib/landing'
import { formatWaktuAudit } from '~/lib/audit'

/**
 * Pendaftar — khusus COO (Story 1.6; hardening 2026-09-22, AD-8): daftar
 * calon `diajukan` (urut `created_at` terlama dulu) + aksi verifikasi/tolak
 * per baris. Permukaan ber-nav (layout `app`) — item Pendaftar tampil via
 * registry nav COO (keputusan owner 2026-09-22; review adv#2/adv#3).
 * Non-COO membuka URL langsung digerbangi middleware (registry
 * PRASYARAT_COO) — calon lewat gerbang calon 1.5 dulu (diajukan
 * belum-lengkap → /profile-completeness; lengkap → /registration-status),
 * non-calon non-COO → landing role-nya (pemegang_saham → /dashboard;
 * tanpa_saham belum-beli → jalur transparansi /personal); penegakan
 * kewenangan di server (/api/pendaftar*) — UI hanya lapisan pertama (AD-8):
 * tombol Verifikasi aktif hanya untuk baris `profilLengkap` (UJ-6) dan
 * server menegakkan gerbang yang sama. Error envelope di-BRANCH per kode
 * (hardening 2026-09-22): 409 STATUS_BERUBAH → pesan + muat ulang; 403
 * kewenangan (permanen, tanpa "coba lagi"); 404 → pesan + muat ulang; 400
 * PROFILE_INCOMPLETE menyebut field kurang; 400 BAD_REQUEST menyebut
 * details.masalah; sisanya → "coba lagi". Info sisaField baris
 * belum-lengkap adalah TEKS TERLIHAT (bukan hover-only — produk
 * touch-first). Guard `sedangMuatUlang` menolak POST kedua selama refresh
 * pasca-keputusan berjalan — pesan sukses tidak tertimpa. Penolakan wajib
 * alasan via Dialog + textarea (UX-DR20), alasan dibatasi konstanta
 * bersama.
 */
definePageMeta({ auth: true, layout: 'app' })

/** Baris wire GET /api/pendaftar (kontrak server/domain/identity). */
interface CalonPendaftar {
  id: string
  email: string
  nama: string
  createdAt: string
  profilLengkap: boolean
  sisaField: string[]
}

interface DaftarCalonRespons {
  data: CalonPendaftar[]
}

/** Peta status → badge — PERSIS registration-status.vue (UX-DR2/DR4). */
const PETA_BADGE: Record<OwnerStatus, { label: string, variant: 'warn' | 'success' | 'destructive' | 'muted' }> = {
  diajukan: { label: 'Diajukan', variant: 'warn' },
  terverifikasi: { label: 'Terverifikasi', variant: 'success' },
  ditolak: { label: 'Ditolak', variant: 'destructive' },
  kedaluwarsa: { label: 'Kedaluwarsa', variant: 'muted' },
  keluar: { label: 'Keluar', variant: 'muted' },
}

const api = useRequestFetch()

const landing = await api<LandingRespons>('/api/landing').catch(() => null)
if (!landing) {
  await navigateTo('/login')
} else if ('unlinked' in landing) {
  await navigateTo('/login?res=unlinked')
} else if (landing.role !== 'coo') {
  // Non-COO membuka URL langsung → landing role-nya (UX-DR14).
  await navigateTo(LANDING_PATH[landing.role])
}

const adalahCoo = landing !== null && !('unlinked' in landing) && landing.role === 'coo'

const hasilAwal = adalahCoo ? await api<DaftarCalonRespons>('/api/pendaftar').catch(() => null) : null

const gagalMuat = ref(hasilAwal === null)
const calon = ref<CalonPendaftar[]>(hasilAwal?.data ?? [])

/** Guard muat ulang (hardening 2026-09-22): POST keputusan ditolak selama
 *  refresh pasca-sukses berjalan — pesan sukses tidak tertimpa 409 dan
 *  tidak ada keputusan kedua yang terkirim ke angka basi. */
const sedangMuatUlang = ref(false)

/** Muat ulang daftar — pasca-keputusan maupun pasca-error (angka basi). */
async function muatUlang(): Promise<void> {
  if (sedangMuatUlang.value) return
  sedangMuatUlang.value = true
  try {
    const hasil = await api<DaftarCalonRespons>('/api/pendaftar').catch(() => null)
    if (hasil === null) {
      gagalMuat.value = true
      return
    }
    gagalMuat.value = false
    calon.value = hasil.data
  } finally {
    sedangMuatUlang.value = false
  }
}

/** Pesan status halaman — diumumkan aria-live="polite" (UX-DR4). */
type Pesan = { jenis: 'berhasil' | 'status-berubah' | 'gagal', teks: string }
const pesan = ref<Pesan | null>(null)

const TEKS_STATUS_BERUBAH = 'Status pendaftar sudah berubah — daftar dimuat ulang.'
const TEKS_GAGAL_SIMPAN = 'Tidak dapat menyimpan — coba lagi.'
/** 403 — kewenangan bersifat PERMANEN: tanpa ajakan "coba lagi". */
const TEKS_KEWENANGAN_BERAKHIR = 'Kewenangan COO tidak berlaku lagi — keputusan tidak dapat disimpan.'
/** 404 — baris mungkin sudah tidak ada; daftar dimuat ulang. */
const TEKS_TIDAK_DITEMUKAN = 'Calon pendaftar tidak ditemukan — daftar dimuat ulang.'
/** 400 ALASAN_WAJIB — paritas validasi dialog tolak. */
const TEKS_ALASAN_WAJIB = 'Alasan penolakan wajib diisi.'

/** Kode status kontrak error envelope — dibaca dari error fetch klien. */
const STATUS_FORBIDDEN = 403
const STATUS_NOT_FOUND = 404
const STATUS_KONFLIK = 409

/** Bentuk envelope error server yang terbaca dari FetchError (`data`). */
interface EnvelopeErrorKlien {
  code?: unknown
  details?: { sisaField?: unknown, masalah?: unknown }
}

/** Field kurang (details.sisaField) → teks Indonesia berlabel field —
 *  pemetaan label SATU SUMBER via `labelSisaField` (hardening 2026-09-22). */
function teksProfilBelumLengkap(sisaField: unknown): string {
  const kunci = Array.isArray(sisaField)
    ? sisaField.filter((k): k is string => typeof k === 'string')
    : []
  if (kunci.length === 0) {
    return 'Profil calon belum lengkap — verifikasi tidak dapat dilakukan.'
  }
  return `Profil calon belum lengkap — verifikasi tidak dapat dilakukan. Field kurang: ${labelSisaField(kunci)}.`
}

/** details.masalah (pesan zod) → teks pesan BAD_REQUEST. */
function teksPermintaanTidakSah(masalah: unknown): string {
  const daftar = Array.isArray(masalah)
    ? masalah.filter((m): m is string => typeof m === 'string')
    : []
  return daftar.length > 0 ? `Permintaan tidak sah — ${daftar.join(', ')}` : TEKS_GAGAL_SIMPAN
}

const sedangKirim = ref(false)

/**
 * Kirim keputusan COO ke endpoint; error di-BRANCH per kode envelope
 * (hardening 2026-09-22): 409 STATUS_BERUBAH → pesan + muat ulang (matriks
 * I/O spec 1.6); 403 FORBIDDEN → pesan kewenangan permanen; 404
 * TIDAK_DITEMUKAN → pesan + muat ulang; 400 PROFILE_INCOMPLETE → field
 * kurang; 400 ALASAN_WAJIB → wajib beralasan; 400 BAD_REQUEST →
 * details.masalah; sisanya (network/5xx) → "coba lagi". POST kedua ditolak
 * selama keputusan lain berjalan ATAU refresh daftar sedang berjalan.
 * Mengembalikan true bila keputusan tersimpan.
 */
async function kirimKeputusan(id: string, keputusan: 'terverifikasi' | 'ditolak', alasan?: string): Promise<boolean> {
  if (sedangKirim.value || sedangMuatUlang.value) return false
  sedangKirim.value = true
  try {
    await api('/api/pendaftar/keputusan', {
      method: 'POST',
      body: keputusan === 'ditolak' ? { id, keputusan, alasan } : { id, keputusan },
    })
    return true
  } catch (error) {
    const kesalahan = error as { status?: unknown, data?: EnvelopeErrorKlien | undefined }
    const status = kesalahan.status
    const kode = typeof kesalahan.data?.code === 'string' ? kesalahan.data.code : undefined
    if (status === STATUS_KONFLIK || kode === 'STATUS_BERUBAH') {
      pesan.value = { jenis: 'status-berubah', teks: TEKS_STATUS_BERUBAH }
      await muatUlang()
    } else if (status === STATUS_FORBIDDEN || kode === 'FORBIDDEN') {
      pesan.value = { jenis: 'gagal', teks: TEKS_KEWENANGAN_BERAKHIR }
    } else if (status === STATUS_NOT_FOUND || kode === 'TIDAK_DITEMUKAN') {
      pesan.value = { jenis: 'gagal', teks: TEKS_TIDAK_DITEMUKAN }
      await muatUlang()
    } else if (kode === 'PROFILE_INCOMPLETE') {
      pesan.value = { jenis: 'gagal', teks: teksProfilBelumLengkap(kesalahan.data?.details?.sisaField) }
    } else if (kode === 'ALASAN_WAJIB') {
      pesan.value = { jenis: 'gagal', teks: TEKS_ALASAN_WAJIB }
    } else if (kode === 'BAD_REQUEST') {
      pesan.value = { jenis: 'gagal', teks: teksPermintaanTidakSah(kesalahan.data?.details?.masalah) }
    } else {
      pesan.value = { jenis: 'gagal', teks: TEKS_GAGAL_SIMPAN }
    }
    return false
  } finally {
    sedangKirim.value = false
  }
}

/** Verifikasi baris — hanya dipanggil untuk baris `profilLengkap` (UJ-6).
 *  Pesan lama TIDAK dihapus di awal: klik yang ditolak guard (sedangKirim/
 *  sedangMuatUlang) tidak boleh mengosongkan pesan sebelumnya — pesan sukses
 *  tidak tertimpa (matriks #8); jalur sukses/error selalu men-set pesan
 *  baru, sehingga tidak ada pesan basi yang menggantung. */
async function verifikasi(baris: CalonPendaftar): Promise<void> {
  const tersimpan = await kirimKeputusan(baris.id, 'terverifikasi')
  if (tersimpan) {
    pesan.value = { jenis: 'berhasil', teks: 'Pendaftar diverifikasi.' }
    await muatUlang()
  }
}

/**
 * Dialog penolakan (UX-DR20): alasan wajib — tombol kirim tidak aktif selama
 * isian kosong; server menegakkan gerbang yang sama (400 ALASAN_WAJIB).
 */
const calonDitolak = ref<CalonPendaftar | null>(null)
const alasan = ref('')

function bukaDialogTolak(baris: CalonPendaftar): void {
  calonDitolak.value = baris
  alasan.value = ''
  pesan.value = null
}

function tutupDialogTolak(): void {
  calonDitolak.value = null
  alasan.value = ''
}

/** Alasan sah = non-kosong setelah trim — paritas validasi server (spec 1.6). */
const alasanSah = computed(() => alasan.value.trim().length > 0)

/** Kunci field wire English → label Indonesia (kontrak shared/domain/profil)
 *  — teks sisaField baris belum-lengkap berbahasa Indonesia dan TERLIHAT
 *  (bukan hover-only; hardening 2026-09-22, aksesibilitas touch-first). */
function labelSisaField(sisaField: string[]): string {
  return sisaField.map((kunci) => LABEL_FIELD_PROFIL[kunci as KunciProfil] ?? kunci).join(', ')
}

async function kirimPenolakan(): Promise<void> {
  // Satu penulis: keputusan sedang berjalan → klik ganda diabaikan (dialog
  // dibiarkan terbuka sampai POST pertama selesai).
  if (sedangKirim.value) return
  const target = calonDitolak.value
  if (!target || !alasanSah.value) return
  const tersimpan = await kirimKeputusan(target.id, 'ditolak', alasan.value)
  if (tersimpan) {
    tutupDialogTolak()
    pesan.value = { jenis: 'berhasil', teks: 'Pendaftar ditolak.' }
    await muatUlang()
  } else if (pesan.value?.jenis === 'gagal') {
    // Isian dipertahankan (UX-DR19) — dialog tetap terbuka untuk diperbaiki.
  } else {
    // 409: dialog ditutup bersama muat ulang daftar (status sudah berubah).
    tutupDialogTolak()
  }
}

useHead({ title: 'Pendaftar — Sip & Dip' })

/** Penanda hidrasi untuk test E2E (pola profile-completeness.vue) — klik
 *  aksi hanya diasumsikan hidrasi setelah atribut ini 'true'. */
const terhidrasi = ref(false)
onMounted(() => {
  terhidrasi.value = true
})
</script>

<template>
  <main data-testid="pendaftar-halaman" :data-terhidrasi="terhidrasi ? 'true' : 'false'" class="mx-auto flex min-h-dvh max-w-7xl flex-col gap-6 px-4 py-8">
    <header>
      <h1 class="text-2xl font-semibold">Pendaftar</h1>
      <p class="text-sm text-muted-foreground">Calon owner berstatus diajukan — hanya untuk COO.</p>
    </header>

    <!-- Region pengumuman perubahan status (aria-live, pola Status Badge).
         testid pada kontainer Alert (bukan teks di dalamnya — sel grid
         pertama Alert tanpa ikon berlebar nol sehingga teks dianggap hidden
         oleh Playwright meski terlihat). -->
    <div aria-live="polite">
      <Alert
        v-if="pesan"
        :variant="pesan.jenis === 'berhasil' ? 'success' : pesan.jenis === 'gagal' ? 'destructive' : 'default'"
        :data-testid="pesan.jenis === 'status-berubah' ? 'pendaftar-pesan-status-berubah' : undefined"
      >
        {{ pesan.teks }}
      </Alert>
    </div>

    <section
      v-if="gagalMuat"
      class="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center"
    >
      <p class="text-sm text-muted-foreground">Daftar pendaftar gagal dimuat.</p>
      <!-- Anchor biasa (bukan NuxtLink): muat ulang dokumen penuh agar SSR
           fetch berjalan lagi — pola audit-trail.vue. -->
      <a href="/pendaftar" class="text-sm font-medium underline underline-offset-4">
        Coba lagi
      </a>
    </section>

    <section
      v-else-if="calon.length === 0"
      data-testid="pendaftar-kosong"
      class="flex flex-1 items-center justify-center rounded-lg border border-dashed p-10 text-center"
    >
      <p class="text-sm text-muted-foreground">Belum ada calon pendaftar yang menunggu verifikasi.</p>
    </section>

    <template v-else>
      <Table data-testid="pendaftar-tabel">
        <TableHeader>
          <TableRow>
            <TableHead class="max-lg:sticky max-lg:left-0 max-lg:z-10 max-lg:bg-background">Pendaftar</TableHead>
            <TableHead>Diajukan</TableHead>
            <TableHead>Profil</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="baris in calon"
            :key="baris.id"
            data-testid="pendaftar-baris"
          >
            <TableCell class="max-lg:sticky max-lg:left-0 max-lg:z-10 max-lg:bg-background">
              <p class="text-sm font-medium"> {{ ` ${baris.nama === '' ? '(Nama belum diisi)' : baris.nama} ` }}</p>
              <p class="text-xs text-muted-foreground">{{ baris.email }}</p>
            </TableCell>
            <TableCell class="whitespace-nowrap tabular-nums">
              {{ formatWaktuAudit(baris.createdAt) }}
            </TableCell>
            <TableCell>
              <div class="flex flex-col items-start gap-1">
                <Badge :variant="baris.profilLengkap ? 'success' : 'warn'" class="rounded-full">
                  {{ baris.profilLengkap ? 'Lengkap' : 'Belum lengkap' }}
                </Badge>
                <!-- Hint TERLIHAT (bukan hover-only): field kurang calon belum
                     lengkap, berlabel Indonesia (aksesibilitas touch-first). -->
                <p v-if="!baris.profilLengkap" class="text-xs text-muted-foreground">
                  Field belum lengkap: {{ labelSisaField(baris.sisaField) }}
                </p>
              </div>
            </TableCell>
            <TableCell>
              <Badge :variant="PETA_BADGE.diajukan.variant" class="rounded-full">
                {{ PETA_BADGE.diajukan.label }}
              </Badge>
            </TableCell>
            <TableCell>
              <div class="flex flex-wrap items-center gap-2">
                <Button
                  data-testid="pendaftar-aksi-verifikasi"
                  :disabled="!baris.profilLengkap || sedangKirim"
                  size="sm"
                  class="min-h-11"
                  @click="verifikasi(baris)"
                >
                  Verifikasi
                </Button>
                <Button
                  data-testid="pendaftar-aksi-tolak"
                  variant="outline"
                  :disabled="sedangKirim"
                  size="sm"
                  class="min-h-11"
                  @click="bukaDialogTolak(baris)"
                >
                  Tolak
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <Dialog :open="calonDitolak !== null" @update:open="nilai => nilai || tutupDialogTolak()">
        <DialogContent class="max-w-md" data-testid="pendaftar-dialog-tolak">
          <DialogHeader>
            <DialogTitle>Tolak Pendaftaran</DialogTitle>
          </DialogHeader>
          <p class="text-sm text-muted-foreground">
            Alasan penolakan wajib diisi dan tampil apa adanya kepada pendaftar.
          </p>
          <label class="flex flex-col gap-2 text-sm font-medium">
            Alasan penolakan
            <!-- maxlength dibatasi konstanta bersama (hardening 2026-09-22):
                 input >PANJANG_MAKS_ALASAN_PENOLAKAN tidak pernah terkirim. -->
            <textarea
              v-model="alasan"
              data-testid="pendaftar-input-alasan"
              rows="4"
              :maxlength="PANJANG_MAKS_ALASAN_PENOLAKAN"
              class="min-h-24 rounded-md border bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3"
              placeholder="Tulis alasan penolakan"
            />
          </label>
          <DialogFooter class="gap-2 sm:justify-end">
            <Button variant="outline" data-testid="pendaftar-batal-tolakan" @click="tutupDialogTolak">
              Batal
            </Button>
            <Button
              variant="destructive"
              data-testid="pendaftar-kirim-tolakan"
              :disabled="!alasanSah || sedangKirim"
              @click="kirimPenolakan"
            >
              Tolak Pendaftar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </main>
</template>
