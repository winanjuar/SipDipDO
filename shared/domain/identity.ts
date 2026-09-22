/**
 * IDENTITY — kontrak murni lintas lapis (AD-6): enum status siklus hidup
 * owner/pendaftar (dipinkan AD-11), role tiga-tingkat untuk landing, peta
 * landing role→route (UX-DR14), predikat akses kanonik + registry
 * permukaan/navigasi (Story 1.7, FR-15 matriks keterbukaan §4.8, AD-8/AD-11).
 * TANPA I/O, tanpa framework — dipakai bersama `server/domain/identity`,
 * route handler, middleware, dan halaman.
 *
 * Role TIDAK PERNAH diturunkan dari `positions.shares` (AD-8/AD-11) —
 * penentuan role kanonik = `resolveRole` di `server/domain/identity`
 * (precedence COO aktif dari `coo_tenures`, "pemegang saham" dari
 * `first_effective_at` terisi). Predikat akses pun TIDAK PERNAH dari
 * `positions.shares` live — hanya dari status siklus hidup +
 * `firstEffectiveAt` (snapshot).
 */

/** Status siklus hidup owner/pendaftaran — himpunan tertutup AD-11. */
export const OWNER_STATUSES = ['diajukan', 'terverifikasi', 'ditolak', 'kedaluwarsa', 'keluar'] as const
export type OwnerStatus = (typeof OWNER_STATUSES)[number]

/** Role akses untuk landing (UX-DR14). */
export const ROLES = ['coo', 'pemegang_saham', 'tanpa_saham', 'calon_owner'] as const
export type Role = (typeof ROLES)[number]

/** Status calon owner — dialandingkan ke halaman status pendaftaran. */
export const CALON_OWNER_STATUSES: readonly OwnerStatus[] = ['diajukan', 'ditolak', 'kedaluwarsa']

/**
 * Batas panjang alasan penolakan COO (Story 1.6, hardening 2026-09-22) —
 * SATU sumber untuk zod `.max` handler keputusan dan `:maxlength` textarea
 * UI penolakan; kolom text + audit details jsonb tidak dimaksudkan menelan
 * payload tanpa batas.
 */
export const PANJANG_MAKS_ALASAN_PENOLAKAN = 500

/** Panjang kode referral owner — alfanumerik (keputusan owner 2026-09-18). */
export const PANJANG_KODE_REFERRAL = 8

/** Himpunan karakter kode referral — alfanumerik lengkap: huruf besar, huruf
 *  kecil, dan digit (keputusan owner 2026-09-18: menerima lowercase juga). */
const KARAKTER_KODE_REFERRAL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/**
 * Buat kode referral MILIK owner — alfanumerik `PANJANG_KODE_REFERRAL`
 * karakter. MURNI: sumber acak disuntikkan (prasyarat nilai ∈ [0,1)) agar
 * teruji deterministik. Kolom `owners.referral_code` UNIQUE — tabrakan
 * ditangani lapis repo dengan retry saat constraint melawan.
 */
export function buatKodeReferral(angkaAcak: () => number = Math.random): string {
  let kode = ''
  for (let i = 0; i < PANJANG_KODE_REFERRAL; i++) {
    kode += KARAKTER_KODE_REFERRAL.charAt(Math.floor(angkaAcak() * KARAKTER_KODE_REFERRAL.length))
  }
  return kode
}

/** Peta landing role→route — ter-pin spec Story 1.2 (UX-DR14). */
export const LANDING_PATH: Record<Role, string> = {
  coo: '/order-queue',
  pemegang_saham: '/dashboard',
  tanpa_saham: '/personal',
  calon_owner: '/registration-status',
}

/**
 * Snapshot owner minimal untuk keputusan role — timestamptz dibaca sebagai
 * string ISO (konvensi spine: mode string, bukan Date lokal).
 */
export interface OwnerAccessSnapshot {
  status: OwnerStatus
  /** Waktu Pembelian Pertama efektif; null bila belum pernah efektif. */
  firstEffectiveAt: string | null
}

/** Referensi owner pada principal — data yang aman diekspos ke lapis halaman. */
export interface PrincipalOwner {
  email: string
  status: OwnerStatus
  /** Alasan penolakan pendaftaran — tampil apa adanya (UX-DR15); null bila bukan ditolak. */
  rejectionReason: string | null
  firstEffectiveAt: string | null
  /** Profil Lampiran A #1–10 lengkap (Story 1.5, FR-22) — prasyarat verifikasi
   *  COO; dihitung `profilLengkap()` per-request, bukan kolom DB. */
  profilLengkap: boolean
}

/**
 * Principal hasil `buildPrincipal` (AD-8): sesi Google tanpa baris owner =
 * unlinked; selain itu memuat role kanonik + referensi owner. Role dievaluasi
 * per-request dari DB — tidak pernah disimpan di JWT/session.
 */
export type Principal =
  | { unlinked: true }
  | { unlinked: false, role: Role, owner: PrincipalOwner }

/* ------------------------------------------------------------------ *
 * Story 1.7 — predikat akses kanonik, registry permukaan & navigasi
 * (FR-15 matriks keterbukaan §4.8; AD-8 penegakan batas server;
 * AD-11 predikat atas status siklus hidup, BUKAN `positions.shares`
 * live; UX-DR14 navigasi role-based). Semua MURNI, tanpa I/O.
 * ------------------------------------------------------------------ */

/**
 * Pesan transparensi VERBATIM (spec Story 1.7) — diteruskan Halaman Personal
 * via flash-cookie `KUNCI_COOKIE_INFO_TRANSPARANSI` (keputusan owner
 * 2026-09-21, menggantikan query param), tampil sekali sebagai Alert
 * aria-live="polite".
 */
export const PESAN_TRANSPARANSI
  = 'Transparansi penuh terbuka setelah Pembelian Pertama Anda efektif.'

/**
 * Kunci flash-cookie pesan transparensi (keputusan owner 2026-09-21: query
 * param `?info=transparansi` DIHAPUS — server `sendRedirect` tak bisa menulis
 * sessionStorage, TAPI bisa set cookie): middleware gerbang role set cookie
 * ini (path `/personal`) lalu redirect `/personal` polos; Halaman Personal
 * membaca (SSR ikut — alert tampil di paint pertama), menampilkan alert
 * SEKALI, lalu menghapus cookie saat mount — refresh tidak mengulang.
 */
export const KUNCI_COOKIE_INFO_TRANSPARANSI = 'snd-dash.info-transparency'

/**
 * Jumlah item MAKSIMUM bottom nav mobile (<lg) sebelum overflow masuk
 * Sheet "Lainnya" (UX-DR14) — konstanta bernama, tanpa magic number.
 */
export const MAKS_ITEM_NAV_MOBILE = 4

/**
 * Predikat akses kanonik (AD-8/AD-11, review-adversarial-v3 P8) — SEMANTIK
 * terpin spec Story 1.7, ATAS SNAPSHOT (`status` + `firstEffectiveAt`),
 * tidak pernah dari `positions.shares` live:
 * - `aksesPenuh(s)` = Pembelian Pertama PERNAH efektif — termasuk `keluar`
 *   yang pernah membeli (matriks terbuka otomatis pasca Pembelian Pertama).
 * - `perluReferral(s)` = owner belum-pernah-beli dari status
 *   `terverifikasi`/`keluar` (keluar-belum-beli ikut cakupan AD-11).
 * - `layakPilihanReferral(s)` = pemegang saham (termasuk COO) ATAU owner
 *   belum-pernah-beli yang sah mengajukan referral.
 *
 * Fungsi set-DB `pilihanReferral(tx)` BUKAN bagian modul ini (Epic 3 —
 * butuh query + keputusan MRO cross-referral).
 */

/** Status owner yang TIDAK (belum) jadi calon: diajukan/ditolak/kedaluwarsa
 *  dikecualikan — hanya `terverifikasi`/`keluar` yang masuk cakupan AD-11. */
const STATUS_AKSES_BELUM_BELI: readonly OwnerStatus[] = ['terverifikasi', 'keluar']

/** Pembelian Pertama PERNAH efektif → akses penuh, apa pun status kini. */
export function aksesPenuh(snapshot: OwnerAccessSnapshot): boolean {
  return snapshot.firstEffectiveAt !== null
}

/** Owner sah yang belum-pernah-beli — penerima program referral (AD-11). */
export function perluReferral(snapshot: OwnerAccessSnapshot): boolean {
  return STATUS_AKSES_BELUM_BELI.includes(snapshot.status) && snapshot.firstEffectiveAt === null
}

/** Layak DIPILIH sebagai referral: pemegang saham ATAU owner belum-beli sah. */
export function layakPilihanReferral(snapshot: OwnerAccessSnapshot): boolean {
  return aksesPenuh(snapshot) || STATUS_AKSES_BELUM_BELI.includes(snapshot.status)
}

/* ------------------------------------------------------------------ *
 * Registry permukaan terkunci (FR-15 §4.8) — path → prasyarat akses.
 * Epic 2–4 menambah permukaan lewat registry INI tanpa mengubah logika
 * middleware (data-driven; satu sumber kebenaran keterbukaan).
 * ------------------------------------------------------------------ */

/** Prasyarat permukaan khusus COO (Antrian Beli, Audit Trail, Pendaftar). */
export const PRASYARAT_COO = 'coo' as const
/** Prasyarat permukaan yang terbuka bila `aksesPenuh` — atau role di atasnya. */
export const PRASYARAT_AKSES_PENUH = 'akses-penuh-atau-lebih' as const
/** Prasyarat permukaan milik owner tanpa saham/Keluar (Halaman Personal). */
export const PRASYARAT_TANPA_SAHAM = 'tanpa-saham' as const
/** Prasyarat permukaan milik SEMUA owner terautentikasi (keputusan owner
 *  2026-09-21: Halaman Personal read-only dibuka untuk COO & pemegang saham
 *  juga — semua orang perlu melihat data profil dirinya; mutasi tetap via
 *  COO/FR-13). */
export const PRASYARAT_OWNER = 'owner' as const

export type PrasyaratPermukaan
  = typeof PRASYARAT_COO
    | typeof PRASYARAT_AKSES_PENUH
    | typeof PRASYARAT_TANPA_SAHAM
    | typeof PRASYARAT_OWNER

/**
 * Registry permukaan terkunci — kunci path PERSIS rute halaman, plus ATURAN
 * PREFIX: kunci berakhiran `/` mencakup SELURUH path berawalan tersebut
 * (Story 2.1b: `/mom/` menangkap `/mom/<uuid>` — permukaan dinamis tanpa
 * mendaftar tiap id). Lookup via `prasyaratPermukaan()`: exact-match SELALU
 * didahulukan prefix sehingga `/mom/baru` (COO saja, lebih ketat) menang
 * atas `/mom/` (akses penuh).
 * `/dashboard` = `akses-penuh-atau-lebih`: tanpa_saham belum-pernah-beli
 * dikunci, keluar-pernah-beli (`aksesPenuh`) lolos; COO/pemegang saham
 * selalu lolos (role lebih tinggi). `/mom` mengikuti matriks §4.8 — MoM
 * terkunci bagi tanpa_saham belum-pernah-beli, terbuka otomatis pasca
 * Pembelian Pertama (keputusan owner 2026-09-22, Story 2.1b).
 * `/pendaftar` = COO saja — permukaan verifikasi Story 1.6 terdaftar di
 * registry agar digerbangi di batas server (keputusan owner 2026-09-22;
 * review adv#2/adv#3).
 */
export const PERMUKAAN_PERAN: Readonly<Record<string, PrasyaratPermukaan>> = {
  '/dashboard': PRASYARAT_AKSES_PENUH,
  '/order-queue': PRASYARAT_COO,
  '/audit-trail': PRASYARAT_COO,
  '/pendaftar': PRASYARAT_COO,
  '/personal': PRASYARAT_OWNER,
  '/mom': PRASYARAT_AKSES_PENUH,
  '/mom/baru': PRASYARAT_COO,
  '/mom/': PRASYARAT_AKSES_PENUH,
}

/**
 * Prasyarat SATU permukaan — exact-match didahulukan aturan prefix (lihat
 * `PERMUKAAN_PERAN`); undefined bila path di luar registry. MURNI — dipakai
 * `permukaanDibolehkan` dan middleware (keanggotaan halaman terproteksi).
 * ASUMSI: kunci prefix HANYA SATU per awalan — loop mengembalikan kecocokan
 * PERTAMA, bukan prefix terpanjang; bila kelak ada prefix bersarang (mis.
 * `/mom/arsip/` di bawah `/mom/`), urutan iterasi harus diganti
 * longest-prefix sebelum menambah kunci kedua.
 */
export function prasyaratPermukaan(path: string): PrasyaratPermukaan | undefined {
  const persis = PERMUKAAN_PERAN[path]
  if (persis !== undefined) return persis
  for (const [kunci, prasyarat] of Object.entries(PERMUKAAN_PERAN)) {
    if (kunci.endsWith('/') && path.startsWith(kunci)) return prasyarat
  }
  return undefined
}

/**
 * Keputusan keterbukaan SATU sumber (dipakai middleware BATAS SERVER, AD-8):
 * bolehkah `principal` membuka `path`? Permukaan di luar registry tidak
 * digerbangi registry (gerbang sesi/calon tetap urusan middleware). Calon
 * selalu `false` di sini — gerbang calon 1.5 dievaluasi middleware SEBELUM
 * gerbang role (precedence).
 */
export function permukaanDibolehkan(principal: Principal, path: string): boolean {
  const prasyarat = prasyaratPermukaan(path)
  if (prasyarat === undefined) return true
  if (principal.unlinked) return false
  if (principal.role === 'calon_owner') return false
  switch (prasyarat) {
    case PRASYARAT_COO:
      return principal.role === 'coo'
    case PRASYARAT_OWNER:
      return true
    case PRASYARAT_TANPA_SAHAM:
      return principal.role === 'tanpa_saham'
    case PRASYARAT_AKSES_PENUH:
      return principal.role === 'coo'
        || principal.role === 'pemegang_saham'
        || aksesPenuh(principal.owner)
  }
}

/* ------------------------------------------------------------------ *
 * Registry item navigasi (UX-DR14) — item role-based, item terkunci
 * TIDAK PERNAH masuk daftar (absen sama sekali, bukan disembunyikan).
 * ------------------------------------------------------------------ */

/** Satu item navigasi — label Indonesia terpin + path permukaan. */
export interface ItemNavigasi {
  label: string
  path: string
}

/** Katalog item navigasi — label dipin kontrak ATDD (by-role name). */
export const KATALOG_ITEM_NAVIGASI = {
  orderQueue: { label: 'Order', path: '/order-queue' },
  dashboard: { label: 'Dashboard', path: '/dashboard' },
  auditTrail: { label: 'Audit', path: '/audit-trail' },
  personal: { label: 'Personal', path: '/personal' },
  mom: { label: 'MoM', path: '/mom' },
  pendaftar: { label: 'Pendaftar', path: '/pendaftar' },
} as const satisfies Readonly<Record<string, ItemNavigasi>>

/**
 * Item navigasi untuk role — MURNI, registry-driven (UX-DR14):
 * - `coo` = Dashboard, Personal, MoM, Order, Pendaftar, Audit (urutan keputusan owner
 *   2026-09-21; MoM disisip setelah Personal sebelum Order — keputusan owner
 *   2026-09-22, Story 2.1b; Pendaftar disisip setelah Order, Audit tetap
 *   terakhir — keputusan owner 2026-09-22; 6 item → Sheet "Lainnya" mobile
 *   berisi Pendaftar, Audit).
 * - `pemegang_saham` = Dashboard, Personal, MoM (IA #14 — nav pemegang saham).
 * - `tanpa_saham` = Halaman Personal (+ Dashboard + MoM bila `sudahAksesPenuh`
 *   — matriks §4.8 terbuka otomatis pasca Pembelian Pertama, keputusan owner
 *   2026-09-22).
 * - `calon_owner` = TANPA nav (perilaku 1.5 tetap).
 * Personal dibuka untuk SEMUA owner (keputusan owner 2026-09-21 — halaman
 * read-only profil diri). Item "Pesanan Saya" dst. ditambahkan story pemilik
 * permukaannya (Epic 3).
 */
export function itemNavigasi(role: Role, sudahAksesPenuh: boolean): readonly ItemNavigasi[] {
  switch (role) {
    case 'coo':
      return [
        KATALOG_ITEM_NAVIGASI.dashboard,
        KATALOG_ITEM_NAVIGASI.personal,
        KATALOG_ITEM_NAVIGASI.mom,
        KATALOG_ITEM_NAVIGASI.orderQueue,
        KATALOG_ITEM_NAVIGASI.pendaftar,
        KATALOG_ITEM_NAVIGASI.auditTrail,
      ]
    case 'pemegang_saham':
      return [KATALOG_ITEM_NAVIGASI.dashboard, KATALOG_ITEM_NAVIGASI.personal, KATALOG_ITEM_NAVIGASI.mom]
    case 'tanpa_saham':
      return sudahAksesPenuh
        ? [KATALOG_ITEM_NAVIGASI.personal, KATALOG_ITEM_NAVIGASI.dashboard, KATALOG_ITEM_NAVIGASI.mom]
        : [KATALOG_ITEM_NAVIGASI.personal]
    case 'calon_owner':
      return []
  }
}
