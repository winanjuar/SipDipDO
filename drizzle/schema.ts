/**
 * Skema Drizzle (drizzle/ — Structural Seed).
 *
 * Konvensi (spine — Consistency Conventions):
 * - ID `uuid`; tabel snake_case jamak; tanggal `timestamptz` (disimpan UTC,
 *   dibaca sebagai string ISO — bukan Date lokal).
 * - Uang `numeric(18,2)` dan ratio `numeric(9,6)` SELALU sebagai string
 *   desimal berskala tetap (AD-10) — tidak pernah number/float.
 * - Kepemilikan tabel mutlak per modul (AD-5): setiap tabel di bawah
 *   diberi label modul pemiliknya; modul tetangga menulis hanya lewat API
 *   publik modul pemilik (index.ts).
 */
import { sql } from 'drizzle-orm'
import { check, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { OWNER_STATUSES } from '../shared/domain/identity'
import { MOM_STATUSES } from '../shared/domain/mom'

/**
 * PROOFS — outbox email (AD-5, AR-6): baris ditulis DI DALAM transaksi aksi
 * terkait (menjamin tidak ada email hilang saat crash); pengiriman async
 * dengan retry oleh modul proofs (`server/domain/proofs/outbox.service.ts`).
 *
 * Tabel ini adalah migrasi awal scaffold — smoke `drizzle-kit migrate`.
 */
export const outboxEmails = pgTable(
  'outbox_emails',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Jenis template — registry tervalidasi di proofs service ('otp' | 'bukti_transaksi' | 'notifikasi'). */
    kind: text('kind').notNull(),
    toAddress: text('to_address').notNull(),
    /** Snapshot data template — imutabel sejak ditulis. */
    payload: jsonb('payload').notNull(),
    /** 'pending' | 'sent' | 'exhausted' (retry habis — harus terlihat, R-009). */
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    /** Jadwal kirim berikutnya (backoff retry). */
    sendAfter: timestamp('send_after', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [index('outbox_emails_status_send_after_idx').on(t.status, t.sendAfter)],
)

export type OutboxEmail = typeof outboxEmails.$inferSelect
export type NewOutboxEmail = typeof outboxEmails.$inferInsert

/**
 * Enum siklus hidup owner/pendaftaran — dipinkan AD-11 (himpunan tertutup).
 * Hanya modul identity yang MENULIS kolom ini; setiap transisi = compare-and-set
 * atas status sebelumnya dalam satu transaksi (AD-11) — implementasi menyusul
 * Story 1.4/1.6.
 */
export const ownerStatus = pgEnum('owner_status', OWNER_STATUSES)

/**
 * IDENTITY — owners (AD-5/AD-11): satu baris per email (UNIQUE — re-daftar =
 * baris yang sama, bukan baris baru). Normalisasi owner 2026-09-18 (Epic 1,
 * struktur fix): kolom English, hanya atribut milik owner sendiri +
 * lifecycle; kontak darurat & rekening bank dipisah ke tabel anak 1:1
 * (`owner_emergency_contacts`, `owner_bank_accounts`) — tiap tabel
 * mendeskripsikan tepat satu entitas (3NF). Kolom `used_referral_code`
 * TETAP text (keputusan owner 2026-09-18 — bukan FK; dormant sampai Epic 3).
 */
export const owners = pgTable('owners', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Lampiran A #1. */
  fullName: text('full_name'),
  /** Lampiran A #2. */
  alias: text('alias'),
  /** Email akun Google — kunci pencocokan sesi → owner (AD-8, migrasi);
   *  sekaligus field #3 Gmail (tanpa kolom profil terpisah). */
  email: text('email').notNull().unique(),
  /** Lampiran A #4. */
  phoneNumber: text('phone_number'),
  status: ownerStatus('status').notNull().default('diajukan'),
  /** Wajib terisi bila status 'ditolak' — tampil apa adanya kepada pendaftar. */
  rejectionReason: text('rejection_reason'),
  /** Di-set HANYA oleh event Pembelian Pertama efektif (AD-11). */
  firstEffectiveAt: timestamp('first_effective_at', { withTimezone: true, mode: 'string' }),
  /** Kode referral MILIK owner — alfanumerik 8 karakter, dibuat saat baris
   *  owner dibuat (dipakai Epic 3); UNIQUE. */
  referralCode: text('referral_code').notNull().unique(),
  /** Kode referral yang DIPAKAI pendaftar saat mendaftar — DORMANT sampai
   *  Epic 3 mengimplementasikan param link ?ref= (keputusan owner
   *  2026-09-18); null = mendaftar tanpa referral. */
  usedReferralCode: text('used_referral_code'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => [
  /**
   * Penolakan wajib beralasan (Story 1.6, FR-22): status `ditolak` TANPA
   * `rejection_reason` non-kosong (setelah btrim) ditolak di level DB —
   * divalidasi handler/service dan ditegakkan sekali lagi di sini.
   */
  check(
    'owners_ditolak_wajib_rejection_reason',
    sql`(${t.status} <> 'ditolak' OR (${t.rejectionReason} IS NOT NULL AND btrim(${t.rejectionReason}) <> ''))`,
  ),
])

/**
 * IDENTITY — owner_emergency_contacts (normalisasi owner 2026-09-18): entitas
 * ORANG kontak darurat (Lampiran A #5–7), 1:1 dengan owner — PK `owner_id`
 * menegakkan maksimum satu baris per owner + integritas FK. Tanpa kolom
 * timestamp: perubahan selalu satu tx dengan `owners.updated_at`.
 */
export const ownerEmergencyContacts = pgTable('owner_emergency_contacts', {
  ownerId: uuid('owner_id')
    .primaryKey()
    .references(() => owners.id),
  /** Lampiran A #5 — nama orang kontak darurat. */
  name: text('name'),
  /** Lampiran A #6. */
  phoneNumber: text('phone_number'),
  /** Lampiran A #7 — enum `DAFTAR_HUBUNGAN` (nilai Indonesia, shared/domain/profil). */
  relationship: text('relationship'),
})

/**
 * IDENTITY — owner_bank_accounts (normalisasi owner 2026-09-18): entitas
 * REKENING bank pencairan (Lampiran A #8–10), 1:1 dengan owner — PK
 * `owner_id` menegakkan maksimum satu baris per owner. `bank_name` menyimpan
 * SATU nilai: nama bank dari combobox (enum 7 bank) ATAU teks bebas dari
 * input "Bank Lainnya" (derivation `namaBankKeTersimpan`/`namaBankKeWire`
 * shared/domain/profil — tanpa kolom other-bank bersyarat).
 */
export const ownerBankAccounts = pgTable('owner_bank_accounts', {
  ownerId: uuid('owner_id')
    .primaryKey()
    .references(() => owners.id),
  /** Lampiran A #8 — nilai enum bank ATAU teks bebas "Bank Lainnya". */
  bankName: text('bank_name'),
  /** Lampiran A #9 — bisa berbeda dari nama owner. */
  accountHolderName: text('account_holder_name'),
  /** Lampiran A #10 — string digit/tanda minus (AD-10), bukan number. */
  accountNumber: text('account_number'),
})

/**
 * IDENTITY — coo_tenures (AD-5): riwayat jabatan COO (FR-17). Tenure berlaku =
 * started_at <= now() AND (ended_at IS NULL OR ended_at > now()) — kewenangan
 * COO diautoritaskan dari sini, per-request (AD-8).
 */
export const cooTenures = pgTable(
  'coo_tenures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    /** Null = tenure masih berjalan. */
    endedAt: timestamp('ended_at', { withTimezone: true, mode: 'string' }),
  },
  (t) => [index('coo_tenures_owner_started_idx').on(t.ownerId, t.startedAt)],
)

export type Owner = typeof owners.$inferSelect
export type NewOwner = typeof owners.$inferInsert
export type OwnerEmergencyContact = typeof ownerEmergencyContacts.$inferSelect
export type NewOwnerEmergencyContact = typeof ownerEmergencyContacts.$inferInsert
export type OwnerBankAccount = typeof ownerBankAccounts.$inferSelect
export type NewOwnerBankAccount = typeof ownerBankAccounts.$inferInsert
export type CooTenure = typeof cooTenures.$inferSelect

/**
 * AUDIT — audit_logs (AD-3/AD-5): trail aksi append-only ber-envelope
 * `{ actor, action, target, details }`. Aktor `user` = owner/COO via
 * `owner_id`; null = `system` (cron/migrasi) — penentu aktor ada di pemanggil
 * (AD-8: aktor audit pejabat saat commit). Kolom `action` bertipe `text`:
 * keanggotaan registry divalidasi service (`shared/domain/audit.ts`) sehingga
 * registry tumbuh tanpa migrasi enum DB.
 *
 * TANPA jalur UPDATE/DELETE — repo hanya INSERT/SELECT, diperkuat DB grants
 * role `app_runtime` (drizzle/runtime-role.sql + drizzle/grants.sql, keputusan
 * spec 1.3 2026-09-17). Modul lain menulis/membaca HANYA lewat
 * `server/domain/audit/index.ts` (AD-5).
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Null = aktor system — envelope AD-3 dipenuhi satu kolom. */
    actorOwnerId: uuid('actor_owner_id').references(() => owners.id),
    /** Nama aksi dari registry terpusat `shared/domain/audit.ts` (text, bukan enum). */
    action: text('action').notNull(),
    /** Referensi target berformat `<tabel>:<id>`; null bila aksi tanpa target. */
    target: text('target'),
    /** Payload jsonb — imutabel sejak ditulis dalam transaksi aksinya. */
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (t) => [index('audit_logs_created_at_idx').on(t.createdAt)],
)

export type AuditLogRow = typeof auditLogs.$inferSelect
export type NewAuditLogRow = typeof auditLogs.$inferInsert


/**
 * Enum status MoM — dipinkan FR-7/Story 2.1 (himpunan tertutup).
 * `draft` dapat diedit/dihapus; `final` imutabel.
 */
export const momStatus = pgEnum('mom_status', MOM_STATUSES)

/**
 * Enum jenis harga — dipinkan Req-3/Story 2.3 (himpunan tertutup).
 * `beli` = harga pembelian saham; `jual` = harga penjualan saham.
 * Dipakai oleh tabel `price_periods` (Task 2.2).
 */
export const priceType = pgEnum('price_type', ['beli', 'jual'])

/**
 * Enum status fase RKAP — dipinkan Req-5/Story 2.4 (himpunan tertutup).
 * `berjalan` = fase aktif, dapat menerima penyesuaian dan transaksi.
 * `arsip` = fase ditutup, hanya dapat dilihat (read-only).
 * Dipakai oleh tabel `rkap_phases` (Task 3.2).
 */
export const rkapPhaseStatus = pgEnum('rkap_phase_status', ['berjalan', 'arsip'])

/**
 * Enum jenis modal Capital Item — dipinkan Req-5 AC2/Story 2.4 (himpunan tertutup).
 * `tetap` = modal tetap (fixed capital); `bergerak` = modal bergerak (movable capital).
 * Rebalancing hanya dapat dilakukan antar item dengan jenis modal sama (Req-13).
 * Dipakai oleh tabel `capital_items` (Task 3.3).
 */
export const capitalType = pgEnum('capital_type', ['tetap', 'bergerak'])

/**
 * PRICING — moms (AD-5/FR-7): notulen MRO/RUPS. Status `draft` dapat
 * diedit/dihapus; `final` imutabel. Tanggal `held_at` WAJIB (FR-7: "MoM
 * tersimpan dengan tanggal"). Modus tulis langsung = `content_text` terisi,
 * `pdf_path` NULL (Story 2.1); upload PDF = `pdf_path` terisi (Story 2.2).
 *
 * Hanya modul PRICING yang MENULIS tabel ini (AD-5); modul lain membaca
 * lewat API publik `server/domain/pricing/index.ts`. Entry audit ditulis
 * dalam transaksi yang sama dengan aksinya (AD-3).
 */
export const moms = pgTable(
  'moms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    /** Tanggal meeting diadakan — WAJIB; timestamptz UTC, zona Jakarta saat tampil. */
    heldAt: timestamp('held_at', { withTimezone: true, mode: 'string' }).notNull(),
    status: momStatus('status').notNull().default('draft'),
    /** Konten teks modus tulis langsung; NULL bila upload PDF (Story 2.2). */
    contentText: text('content_text'),
    /** Path PDF di storage; NULL untuk modus tulis langsung (Story 2.1). */
    pdfPath: text('pdf_path'),
    /** Waktu finalisasi; di-set saat status berubah draft → final. */
    finalizedAt: timestamp('finalized_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (t) => [
    index('moms_held_at_idx').on(t.heldAt),
    index('moms_status_idx').on(t.status),
  ],
)

export type Mom = typeof moms.$inferSelect
export type NewMom = typeof moms.$inferInsert

/**
 * PRICING — price_periods (AD-5/Req-3): harga beli/jual saham dengan tanggal
 * efektif. Setiap harga WAJIB tertaut MoM sebagai referensi keputusan MRO
 * (Req-14). Uang disimpan `numeric(18,2)` dan di-pass sebagai string desimal
 * (AD-10). Resolusi harga (AD-7): untuk setiap (type, date) harus tepat satu
 * baris — unique index pada (type, effectiveDate) ditambah Task 2.3.
 *
 * Koreksi harga = update baris existing (bukan insert baru) dengan audit
 * `price-corrected`; snapshot Harga_Terkunci pada pesanan tidak terpengaruh.
 */
export const pricePeriods = pgTable(
  'price_periods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Jenis harga: 'beli' atau 'jual'. */
    type: priceType('type').notNull(),
    /** Tanggal efektif harga — timestamptz UTC, zona Jakarta saat tampil. */
    effectiveDate: timestamp('effective_date', { withTimezone: true, mode: 'string' }).notNull(),
    /** Nilai harga — numeric(18,2), selalu string desimal via API (AD-10). */
    amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
    /** Referensi MoM keputusan — WAJIB (Req-14). */
    momId: uuid('mom_id').notNull().references(() => moms.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (t) => [
    /** Unique index (AD-7/Req-3 AC3): hanya satu harga per (type, effectiveDate).
     *  Menolak duplikasi dengan pesan unique constraint violation. */
    uniqueIndex('price_periods_type_effective_date_idx').on(t.type, t.effectiveDate),
    /** Index untuk query berdasarkan effectiveDate (Req-4 riwayat harga). */
    index('price_periods_effective_date_idx').on(t.effectiveDate),
  ],
)

export type PricePeriod = typeof pricePeriods.$inferSelect
export type NewPricePeriod = typeof pricePeriods.$inferInsert

/**
 * RKAP — rkap_phases (AD-5/Req-5): fase RKAP yang wajib tertaut MoM.
 * Status `berjalan` = fase aktif, dapat menerima penyesuaian dan transaksi.
 * Status `arsip` = fase ditutup, hanya dapat dilihat (read-only).
 *
 * Setiap fase WAJIB memiliki referensi MoM sebagai bukti keputusan MRO (Req-14):
 * `momId` NOT NULL. Status awal selalu 'berjalan' (Req-5 AC1).
 *
 * Hanya modul RKAP yang MENULIS tabel ini (AD-5); modul lain membaca
 * lewat API publik `server/domain/rkap/index.ts`. Entry audit ditulis
 * dalam transaksi yang sama dengan aksinya (AD-3).
 */
export const rkapPhases = pgTable(
  'rkap_phases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Nama fase — deskriptif, ditampilkan di selector dan tabel. */
    name: text('name').notNull(),
    /** Status fase: 'berjalan' (default) atau 'arsip'. */
    status: rkapPhaseStatus('status').notNull().default('berjalan'),
    /** Referensi MoM keputusan — WAJIB (Req-14: fase RKAP baru WAJIB memilih MoM). */
    momId: uuid('mom_id').notNull().references(() => moms.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (t) => [
    /** Index untuk filtering berdasarkan status (Req-5 AC6: selector fase berjalan vs arsip). */
    index('rkap_phases_status_idx').on(t.status),
  ],
)

export type RkapPhase = typeof rkapPhases.$inferSelect
export type NewRkapPhase = typeof rkapPhases.$inferInsert

/**
 * RKAP — capital_items (AD-5/Req-5): item kebutuhan pemodalan dalam fase RKAP.
 * Setiap item memiliki jenis modal (tetap/bergerak) dan dua nilai kebutuhan:
 * - `initialRequirement`: nilai awal yang dikunci saat fase aktif (Req-5 AC3)
 * - `finalRequirement`: nilai setelah penyesuaian (dapat diubah COO, Req-7)
 *
 * Fulfillment dan Achievement/Held dihitung derived di service layer dari
 * data transaksi (Req-12) — tidak disimpan sebagai kolom (AD-10: kalkulasi
 * di shared/domain, bukan denormalisasi).
 *
 * Utilization diinput COO sebagai realisasi penggunaan modal (Req-11).
 * Nilai uang disimpan `numeric(18,2)` dan di-pass sebagai string desimal (AD-10).
 *
 * Rebalancing hanya antar item dengan jenis modal sama (Req-13 AC1).
 */
export const capitalItems = pgTable(
  'capital_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Referensi fase RKAP — WAJIB; item selalu milik satu fase. */
    phaseId: uuid('phase_id').notNull().references(() => rkapPhases.id),
    /** Nama item — deskriptif, ditampilkan di tabel RKAP. */
    name: text('name').notNull(),
    /** Jenis modal: 'tetap' atau 'bergerak' (Req-5 AC2). */
    capitalType: capitalType('capital_type').notNull(),
    /** Nilai kebutuhan awal — dikunci setelah fase aktif (Req-5 AC3).
     *  Untuk item baru di fase berjalan, nilai = 0 (Req-8 AC1). */
    initialRequirement: numeric('initial_requirement', { precision: 18, scale: 2 }).notNull(),
    /** Nilai kebutuhan final — dapat disesuaikan COO (Req-7).
     *  Berangkat dari initialRequirement, berubah via penyesuaian. */
    finalRequirement: numeric('final_requirement', { precision: 18, scale: 2 }).notNull(),
    /** Realisasi penggunaan modal — diinput COO (Req-11).
     *  Independen dari Fulfillment; default 0 (belum ada input). */
    utilization: numeric('utilization', { precision: 18, scale: 2 }).notNull().default('0'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (t) => [
    /** Index untuk query items berdasarkan fase (Req-5 AC4: tabel RKAP per fase). */
    index('capital_items_phase_idx').on(t.phaseId),
    /** Index untuk filtering berdasarkan jenis modal (Req-5 AC5: agregat per jenis). */
    index('capital_items_capital_type_idx').on(t.capitalType),
  ],
)

export type CapitalItem = typeof capitalItems.$inferSelect
export type NewCapitalItem = typeof capitalItems.$inferInsert

/**
 * RKAP — rkap_adjustments (AD-5/Req-7,8,9,13): pelacakan perubahan kebutuhan
 * dalam fase RKAP. Setiap penyesuaian dicatat dengan jenis dan jumlah untuk
 * validasi batas agregat (Req-9) dan audit trail.
 *
 * Jenis penyesuaian (adjustmentType):
 * - `manual_increase`: kenaikan Final Requirement item eksisting (Req-7)
 * - `new_item`: penambahan Capital Item baru ke fase berjalan (Req-8)
 * - `overshoot`: kelebihan transaksi yang melampaui kebutuhan (derived, Epic 3)
 * - `rebalance_out`: pengurangan dari item sumber saat rebalancing (Req-13)
 * - `rebalance_in`: penambahan ke item tujuan saat rebalancing (Req-13)
 *
 * Relasi:
 * - `phaseId`: fase RKAP terkait — WAJIB (untuk agregasi batas penyesuaian)
 * - `itemId`: item Capital yang disesuaikan — nullable (null untuk new_item sebelum
 *   item dibuat, atau untuk penyesuaian fase-level)
 * - `momId`: referensi MoM — nullable, WAJIB untuk rebalancing (Req-13 AC3)
 *
 * Nilai uang disimpan `numeric(18,2)` dan di-pass sebagai string desimal (AD-10).
 * Validasi batas agregat (Req-9) dilakukan dalam transaksi DB (AD-2).
 */
export const rkapAdjustments = pgTable(
  'rkap_adjustments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Referensi fase RKAP — WAJIB; semua penyesuaian diakumulasi per fase untuk validasi batas. */
    phaseId: uuid('phase_id').notNull().references(() => rkapPhases.id),
    /** Referensi Capital Item yang disesuaikan — nullable:
     *  - null untuk penyesuaian sebelum item dibuat (new_item pre-creation)
     *  - terisi untuk manual_increase, overshoot, rebalance_in/out */
    itemId: uuid('item_id').references(() => capitalItems.id),
    /** Jenis penyesuaian: manual_increase | new_item | overshoot | rebalance_out | rebalance_in */
    adjustmentType: text('adjustment_type').notNull(),
    /** Jumlah penyesuaian — numeric(18,2), selalu string desimal via API (AD-10).
     *  Positif untuk penambahan, negatif untuk pengurangan (rebalance_out). */
    amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
    /** Referensi MoM — nullable, WAJIB untuk rebalancing sebagai bukti keputusan MRO (Req-13 AC3).
     *  Null untuk penyesuaian non-rebalancing (manual_increase, new_item, overshoot). */
    momId: uuid('mom_id').references(() => moms.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  },
  (t) => [
    /** Index untuk query penyesuaian berdasarkan fase (Req-9: agregasi batas penyesuaian). */
    index('rkap_adjustments_phase_idx').on(t.phaseId),
  ],
)

export type RkapAdjustment = typeof rkapAdjustments.$inferSelect
export type NewRkapAdjustment = typeof rkapAdjustments.$inferInsert
