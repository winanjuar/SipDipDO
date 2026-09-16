// server/utils/access.ts
//
// Guard akses SERVER-OTORITATIF (AD-8) — matriks keterbukaan tiga tingkat §4.8.
//
// Sumber kebenaran: design.md B.7 "Access enforcement (AD-8) — server middleware"
// + Error Handling ("Akses permukaan terkunci → redirect Halaman Personal") +
// FR-15 (§15.1–§15.8) + FR-22 (§22.7/§22.10).
//
// Prinsip:
//   - Keterbukaan §4.8 dienforce di middleware server + TIAP route handler, tidak
//     pernah di klien saja. `v-if` role di komponen hanya kosmetik (task 19.5).
//   - Keputusan keterbukaan dihitung dari fungsi kanonik IDENTITAS atas status +
//     firstEffectiveAt (semantik `identity.aksesPenuh`), BUKAN dari positions.shares
//     live (AD-8). Route layer membangun `Principal` dari sesi + identity + ledger +
//     contribution reads dan memanggil guard ini.
//   - Otoritas COO diautoritaskan pada tenure berjalan (identity.assertCooAt pada
//     `now()`) — route me-resolve `isCooOnDuty` lebih dulu sehingga guard ini tetap
//     sinkron dan bebas I/O (AD-8: cek COO tetap in-tx pada jalur finalisasi).
//
// Guard ini MELEMPAR `AccessError` bertipe agar middleware/route dapat memetakan:
//   - REDIRECT_PERSONAL → redirect Halaman Personal (permukaan terkunci Owner tanpa
//     saham / Keluar, §22.7/§22.10).
//   - FORBIDDEN         → 403 (permukaan COO-only diakses non-COO; Owner finalisasi).
//   - UNAUTHENTICATED   → 401 (tidak ada principal / sesi).

import type { OwnerLifecycle, Uuid } from '../../shared/domain/types'

// ---------------------------------------------------------------------------
// Permukaan terproteksi (§4.8)
// ---------------------------------------------------------------------------

/**
 * Himpunan tertutup permukaan (surface) yang tunduk pada matriks keterbukaan §4.8.
 *
 * Penamaan mengikuti area fungsional pada §4.8 / FR-15:
 *   - dashboard_ownership : tabel/chart kepemilikan SELURUH Owner (terkunci §15.7).
 *   - orders_own          : Profile & Pesanan Pembelian MILIK SENDIRI (§15.4/§22.7).
 *   - queue_coo           : antrian konfirmasi COO (COO-only, §15.2/§15.3).
 *   - rkap_view           : tabel RKAP + progress (terbuka Owner tanpa saham, §15.6).
 *   - price_history       : harga berjalan & riwayat harga (terbuka, §15.6).
 *   - profit_recap        : rekap distribusi laba (terbuka Owner tanpa saham HANYA
 *                           selama masih punya poin Contribution belum ditunaikan,
 *                           §15.6/§16.11).
 *   - contribution        : Contribution (terkunci Owner tanpa saham, §15.7).
 *   - mom                 : Minutes of Meeting (terkunci Owner tanpa saham, §15.7).
 *   - audit_trail         : audit trail (terkunci Owner tanpa saham §15.7; COO-only).
 *   - personal_page       : Halaman Personal milik sendiri (selalu terbuka, §22.7).
 *   - registration        : kelengkapan Profile pendaftaran sendiri (§15.5/§22.7).
 */
export type Surface =
  | 'dashboard_ownership'
  | 'orders_own'
  | 'queue_coo'
  | 'rkap_view'
  | 'price_history'
  | 'profit_recap'
  | 'contribution'
  | 'mom'
  | 'audit_trail'
  | 'personal_page'
  | 'registration'

/** Peran tiga tingkat (§15.1). */
export type Role = 'calon_owner' | 'owner' | 'coo'

/**
 * Permukaan yang TERKUNCI bagi Owner tanpa saham (Terverifikasi belum pernah
 * membeli) atau Keluar (§15.7). Akses ditolak → redirect Halaman Personal
 * (§22.7/§22.10, Error Handling). Terbuka otomatis pasca Pembelian Pertama
 * efektif (§15.8) via `aksesPenuh` (firstEffectiveAt !== null).
 */
export const LOCKED_FOR_NO_SHARES: ReadonlySet<Surface> = new Set<Surface>([
  'dashboard_ownership',
  'contribution',
  'mom',
  'audit_trail',
])

/**
 * Permukaan yang hanya terbuka bagi COO yang BERTUGAS (§15.2/§15.3). Owner biasa
 * yang mencoba mengaksesnya (mis. finalisasi via antrian) ditolak (FORBIDDEN).
 * `audit_trail` bersifat COO-only DAN terkunci bagi Owner tanpa saham.
 */
export const COO_ONLY: ReadonlySet<Surface> = new Set<Surface>([
  'queue_coo',
  'audit_trail',
])

// ---------------------------------------------------------------------------
// Error akses bertipe
// ---------------------------------------------------------------------------

/** Kode hasil guard akses yang dipetakan route/middleware. */
export type AccessErrorCode = 'FORBIDDEN' | 'REDIRECT_PERSONAL' | 'UNAUTHENTICATED'

/**
 * Error akses bertipe. Route/middleware memetakannya:
 *   - REDIRECT_PERSONAL → redirect ke Halaman Personal + pesan pembuka akses.
 *   - FORBIDDEN         → 403.
 *   - UNAUTHENTICATED   → 401 (arahkan login).
 */
export class AccessError extends Error {
  constructor(
    readonly code: AccessErrorCode,
    readonly surface: Surface,
    message?: string,
  ) {
    super(message ?? code)
    this.name = 'AccessError'
  }
}

/** Path Halaman Personal — tujuan redirect permukaan terkunci (§22.7). */
export const PERSONAL_PAGE_PATH = '/personal'

/** Pesan default pembuka akses saat redirect Halaman Personal (design.md B.7). */
export const REDIRECT_PERSONAL_MESSAGE =
  'Transparansi penuh terbuka setelah Pembelian Pertama Anda efektif.'

// ---------------------------------------------------------------------------
// Principal — dibangun route layer dari sesi + identity + ledger + contribution
// ---------------------------------------------------------------------------

/**
 * Principal terautentikasi yang menjadi masukan keputusan akses.
 *
 * Route/middleware membangun ini dari:
 *   - sesi NuxtAuth (ownerId, roles),
 *   - identity.getLifecycle (status + firstEffectiveAt),
 *   - identity.assertCooAt pada `now()` (isCooOnDuty — cegah I/O di guard),
 *   - contribution reads (hasUnredeemedPoints).
 *
 * Semantik `aksesPenuh` (§15.8): terbuka penuh HANYA bila `firstEffectiveAt !==
 * null` DAN status !== 'keluar'. `firstEffectiveAt` disediakan agar guard bebas
 * bergantung pada positions.shares live (AD-8).
 */
export interface Principal {
  ownerId: Uuid
  /** Peran aktif (§15.1). Boleh memuat lebih dari satu (mis. owner + coo). */
  roles: readonly Role[]
  /** Status siklus hidup (shared OwnerLifecycle). */
  status: OwnerLifecycle
  /** Waktu Pembelian Pertama efektif; NULL bila belum pernah efektif (§15.8). */
  firstEffectiveAt: Date | null
  /** true bila principal adalah COO yang bertugas pada `now()` (§15.2/§15.3). */
  isCooOnDuty: boolean
  /**
   * true bila Owner masih memiliki poin Contribution yang BELUM ditunaikan
   * (§15.6/§16.11). Disuntik oleh caller (contribution read) agar util ini tidak
   * ter-couple ke pembacaan contribution.
   */
  hasUnredeemedPoints: boolean
  /**
   * true bila Profile pendaftaran principal sudah lengkap (§15.5). Calon Owner
   * dengan Profile belum lengkap hanya boleh mengakses kelengkapan Profile-nya.
   */
  profileComplete: boolean
}

// ---------------------------------------------------------------------------
// Helper keterbukaan (semantik identity.aksesPenuh — dihitung, bukan I/O)
// ---------------------------------------------------------------------------

/**
 * Keterbukaan penuh (§15.8): TRUE hanya bila Pembelian Pertama telah efektif DAN
 * principal tidak berstatus Keluar. Cermin dari `identity.aksesPenuh(owner)` —
 * didefinisikan lokal agar guard tetap sinkron & bebas impor runtime identity.
 */
export function aksesPenuh(p: Pick<Principal, 'status' | 'firstEffectiveAt'>): boolean {
  return p.firstEffectiveAt !== null && p.status !== 'keluar'
}

/** true bila principal adalah Calon Owner (§15.5): belum terverifikasi. */
export function isCalonOwner(p: Pick<Principal, 'status' | 'roles'>): boolean {
  return p.status === 'diajukan' || p.roles.includes('calon_owner')
}

// ---------------------------------------------------------------------------
// Guard utama
// ---------------------------------------------------------------------------

/**
 * Menegakkan matriks keterbukaan §4.8 untuk sebuah `surface`. Melempar
 * `AccessError` bila akses ditolak; kembali `void` bila diizinkan.
 *
 * Urutan keputusan:
 *   1. Principal wajib ada (UNAUTHENTICATED).
 *   2. Calon Owner dengan Profile belum lengkap → hanya `registration`/
 *      `personal_page` (§15.5). Lainnya → redirect Halaman Personal.
 *   3. Permukaan COO-only (queue_coo, audit_trail) → wajib COO bertugas
 *      (§15.2/§15.3). Owner mencoba finalisasi → FORBIDDEN (§15.3).
 *   4. Permukaan terkunci Owner tanpa saham/Keluar (§15.7) → redirect bila belum
 *      akses penuh (§15.8).
 *   5. `profit_recap` (§15.6/§16.11): Owner tanpa saham/Keluar hanya boleh selama
 *      masih punya poin Contribution belum ditunaikan; jika tidak → redirect.
 *   6. Sisanya (orders_own, rkap_view, price_history, personal_page, registration)
 *      terbuka bagi principal terautentikasi (§15.6/§22.7); scope kepemilikan
 *      pesanan ditegakkan terpisah via `assertOwnsOrder` (§15.4).
 */
export function assertSurfaceAccess(
  principal: Principal | null | undefined,
  surface: Surface,
): void {
  // (1) Wajib terautentikasi.
  if (!principal) {
    throw new AccessError('UNAUTHENTICATED', surface, 'Sesi tidak ditemukan.')
  }

  // (2) Calon Owner Profile belum lengkap — hanya kelengkapan Profile sendiri (§15.5).
  if (isCalonOwner(principal) && !principal.profileComplete) {
    if (surface === 'registration' || surface === 'personal_page') return
    throw new AccessError(
      'REDIRECT_PERSONAL',
      surface,
      'Lengkapi Profile Anda terlebih dahulu.',
    )
  }

  // (3) Permukaan COO-only (§15.2/§15.3) — wajib COO bertugas pada now().
  if (COO_ONLY.has(surface)) {
    if (!principal.isCooOnDuty || !principal.roles.includes('coo')) {
      throw new AccessError(
        'FORBIDDEN',
        surface,
        'Permukaan ini hanya untuk COO yang bertugas.',
      )
    }
    // COO bertugas boleh mengakses; audit_trail juga tidak dikunci lagi baginya.
    return
  }

  // (4) Permukaan terkunci Owner tanpa saham/Keluar (§15.7) — redirect bila belum penuh.
  if (LOCKED_FOR_NO_SHARES.has(surface) && !aksesPenuh(principal)) {
    throw new AccessError('REDIRECT_PERSONAL', surface, REDIRECT_PERSONAL_MESSAGE)
  }

  // (5) Rekap distribusi laba (§15.6/§16.11) — Owner tanpa saham/Keluar hanya
  //     selama masih memiliki poin Contribution yang belum ditunaikan.
  if (surface === 'profit_recap' && !aksesPenuh(principal)) {
    if (!principal.hasUnredeemedPoints) {
      throw new AccessError('REDIRECT_PERSONAL', surface, REDIRECT_PERSONAL_MESSAGE)
    }
    return
  }

  // (6) Permukaan terbuka bagi principal terautentikasi (§15.6/§22.7).
  //     Scope kepemilikan pesanan ditegakkan terpisah (§15.4) via assertOwnsOrder.
}

/**
 * Menegakkan bahwa principal hanya mengakses/menarik Pesanan Pembelian MILIKNYA
 * (§15.4). Melempar `FORBIDDEN` bila principal mencoba menyentuh pesanan Owner
 * lain. COO memakai jalur `queue_coo` (bukan helper ini) untuk konfirmasi.
 */
export function assertOwnsOrder(principalOwnerId: Uuid, resourceOwnerId: Uuid): void {
  if (principalOwnerId !== resourceOwnerId) {
    throw new AccessError(
      'FORBIDDEN',
      'orders_own',
      'Anda hanya dapat mengakses Pesanan Pembelian milik sendiri.',
    )
  }
}

/**
 * Menolak upaya Owner (non-COO / bukan COO bertugas) memfinalisasi transaksi
 * (§15.3): transaksi menjadi efektif HANYA melalui COO. Route finalisasi
 * memanggil ini sebelum menjalankan konfirmasi/input langsung/kompensasi.
 */
export function assertCanFinalize(
  principal: Pick<Principal, 'roles' | 'isCooOnDuty'> | null | undefined,
): void {
  if (!principal) {
    throw new AccessError('UNAUTHENTICATED', 'queue_coo', 'Sesi tidak ditemukan.')
  }
  if (!principal.isCooOnDuty || !principal.roles.includes('coo')) {
    throw new AccessError(
      'FORBIDDEN',
      'queue_coo',
      'Hanya COO yang bertugas yang dapat memfinalisasi transaksi.',
    )
  }
}
