// server/domain/migration/index.ts
//
// Pintu lintas-modul SATU-SATUNYA untuk domain migrasi historis (FR-14),
// mengikuti design.md PART A A.4 `MigrationModule`:
//   run(source): Promise<MigrationReport>
//     — memigrasikan seluruh riwayat transaksi (termasuk sheet Evidence) +
//       rekap kepemilikan (§14.1) dan Profile Owner/Calon Owner dari Google Form
//       (§14.2) dalam SATU transaksi atomik (AD-2), memakai
//       `LedgerModule.importHistorical` (aktor 'system'; TANPA gerbang & TANPA
//       penyesuaian instant). Mengembalikan `MigrationReport` dengan Grand Total
//       (Quantity/Shares/Ceil) untuk dicocokkan dengan rekap spreadsheet (§14.3).
//
// Modul lain HANYA boleh mengimpor dari pintu ini (bukan dari service internal).

import * as service from './migration.service'
import type { MigrationReport, MigrationSource } from './events'

/** Kontrak lintas-modul domain migrasi (design.md A.4). */
export interface MigrationModule {
  /**
   * Menjalankan migrasi historis (FR-14) dalam SATU transaksi atomik (AD-2) dan
   * mengembalikan `MigrationReport` dengan Grand Total hasil migrasi.
   */
  run(source: MigrationSource): Promise<MigrationReport>
}

/** Implementasi pintu migrasi — objek tunggal yang memenuhi `MigrationModule`. */
export const migration: MigrationModule = {
  run: service.run,
}

// Re-ekspor tipe kontrak & error agar pemanggil lintas modul cukup mengimpor
// dari pintu ini.
export type {
  MigrationSource,
  MigrationOwner,
  MigrationProfile,
  MigrationTransaction,
  MigrationReport,
  MigrationGrandTotal,
  MigrationErrorCode,
} from './events'
export { MigrationError } from './events'
