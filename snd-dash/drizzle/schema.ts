// drizzle/schema.ts
//
// Skema Drizzle untuk seluruh tabel domain Sip & Dip Ownership Dashboard (Phase 1).
// Kepemilikan tabel per modul mengikuti design.md PART A "Data Models":
//   identity     : owners, profiles, roles, coo_tenures, otp_codes
//   orders       : buy_orders
//   ledger       : ledger_transactions, positions
//   rkap         : rkap_phases, capital_items
//   pricing      : price_periods, moms
//   contribution : contribution_items, contribution_entries, contribution_periods
//   distribution : profit_distributions, profit_distribution_lines
//   proofs       : email_outbox
//   audit        : audit_logs
//
// Aturan tipe kolom (AD-10, NFR §4.8):
//   - Uang            : numeric(18,2)
//   - Rasio           : numeric(9,6)
//   - Quantity/Shares/Ceil/plafon/bobot/poin : integer
//   - Waktu efektif   : timestamptz
// Keunikan (AD-7):
//   - owners.email unik
//   - price_periods unik per (kind, effective_date)
// Penarikan pesanan adalah kolom `withdrawn_at`, bukan status (AD-2).

import { sql } from 'drizzle-orm'
import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// Enums — nilai selaras dengan shared/domain/types.ts (kontrak data).
// ---------------------------------------------------------------------------

export const capitalTypeEnum = pgEnum('capital_type', [
  'Modal Tetap',
  'Modal Bergerak',
  'Modal Operasional',
])

export const orderStatusEnum = pgEnum('order_status', [
  'menunggu_konfirmasi',
  'terkonfirmasi',
  'ditolak',
  'kedaluwarsa',
])

export const ownerLifecycleEnum = pgEnum('owner_lifecycle', [
  'diajukan',
  'terverifikasi',
  'ditolak',
  'kedaluwarsa',
  'keluar',
])

export const priceKindEnum = pgEnum('price_kind', ['beli', 'jual'])

export const mfaActionTypeEnum = pgEnum('mfa_action_type', [
  'konfirmasi',
  'input_langsung',
  'kompensasi',
])

export const roleNameEnum = pgEnum('role_name', ['calon_owner', 'owner', 'coo'])

export const ledgerActorEnum = pgEnum('ledger_actor', ['user', 'system'])

export const momStatusEnum = pgEnum('mom_status', ['draft', 'final'])

// ---------------------------------------------------------------------------
// Helper kolom umum
// ---------------------------------------------------------------------------

const money = (name: string) => numeric(name, { precision: 18, scale: 2 })
const ratio = (name: string) => numeric(name, { precision: 9, scale: 6 })
const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

// ---------------------------------------------------------------------------
// identity: owners, profiles, roles, coo_tenures, otp_codes
// ---------------------------------------------------------------------------

export const owners = pgTable('owners', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Unik per email (AD-7) — sumber pencocokan Google OAuth & tujuan email OTP/Bukti.
  email: text('email').notNull().unique(),
  name: text('name'),
  status: ownerLifecycleEnum('status').notNull().default('diajukan'),
  // Event Pembelian Pertama efektif (IdentityModule.markFirstPurchaseEffective).
  firstEffectiveAt: timestamp('first_effective_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  // Stempel pengingat H-3 pendaftar Profile tak lengkap (FR-22 §22.5) — menjaga
  // idempotensi "satu email pengingat": diset sekali via CAS (NULL → now).
  reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .notNull()
    .unique()
    .references(() => owners.id),
  // Field pendaftaran Google Form (Lampiran A) disimpan sebagai JSONB fleksibel.
  data: jsonb('data').notNull().default(sql`'{}'::jsonb`),
  // Kelengkapan Profile = prasyarat verifikasi COO (FR-22).
  isComplete: boolean('is_complete').notNull().default(false),
  waContact: text('wa_contact'),
  emailContact: text('email_contact'),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id),
    role: roleNameEnum('role').notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique('roles_owner_role_unique').on(t.ownerId, t.role)],
)

export const cooTenures = pgTable('coo_tenures', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Owner yang memegang mandat COO pada rentang waktu tenure (AD-8).
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => owners.id),
  startedAt: timestamp('started_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  // Referensi MoM keputusan pergantian COO (FR-17).
  momRef: uuid('mom_ref'),
  createdAt: createdAt(),
})

export const otpCodes = pgTable('otp_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  cooId: uuid('coo_id')
    .notNull()
    .references(() => owners.id),
  actionType: mfaActionTypeEnum('action_type').notNull(),
  // Aksi transaksional yang dilindungi (mis. buy_order.id) — ref generik.
  targetRef: uuid('target_ref').notNull(),
  codeHash: text('code_hash').notNull(),
  attempts: integer('attempts').notNull().default(0),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
})

// ---------------------------------------------------------------------------
// pricing: moms, price_periods
// ---------------------------------------------------------------------------

export const moms = pgTable('moms', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  // Tanggal MoM MRO/RUPS (FR-7).
  momDate: date('mom_date').notNull(),
  status: momStatusEnum('status').notNull().default('draft'),
  body: text('body'),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const pricePeriods = pgTable(
  'price_periods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: priceKindEnum('kind').notNull(),
    // Nilai harga uang (numeric(18,2)).
    price: money('price').notNull(),
    effectiveDate: date('effective_date').notNull(),
    // Referensi MoM MRO penetap harga (FR-6.1).
    momRef: uuid('mom_ref').references(() => moms.id),
    createdAt: createdAt(),
  },
  // Unik per (kind, effective_date) — resolusi tepat satu baris harga berjalan (AD-7).
  (t) => [
    unique('price_periods_kind_effective_date_unique').on(
      t.kind,
      t.effectiveDate,
    ),
  ],
)

// ---------------------------------------------------------------------------
// rkap: rkap_phases, capital_items
// ---------------------------------------------------------------------------

export const rkapPhases = pgTable('rkap_phases', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  // Batas agregat penyesuaian instant per fase (uang).
  instantAdjustmentBudget: money('instant_adjustment_budget')
    .notNull()
    .default('0'),
  instantAdjustmentUsed: money('instant_adjustment_used')
    .notNull()
    .default('0'),
  isActive: boolean('is_active').notNull().default(true),
  momRef: uuid('mom_ref').references(() => moms.id),
  createdAt: createdAt(),
})

export const capitalItems = pgTable('capital_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  phaseId: uuid('phase_id')
    .notNull()
    .references(() => rkapPhases.id),
  name: text('name').notNull(),
  // Modal Operasional tidak masuk RKAP; hanya Tetap/Bergerak.
  capitalType: capitalTypeEnum('capital_type').notNull(),
  // Nilai rupiah rencana awal, dikunci saat penetapan fase.
  initialRequirement: money('initial_requirement').notNull(),
  // Patokan pemenuhan setelah penyesuaian instant.
  finalRequirement: money('final_requirement').notNull(),
  // Akumulasi pembelian efektif teralokasi (Fulfillment).
  fulfillment: money('fulfillment').notNull().default('0'),
  // Realisasi penggunaan modal (Utilization) diinput COO.
  utilization: money('utilization').notNull().default('0'),
  createdAt: createdAt(),
})

// ---------------------------------------------------------------------------
// orders: buy_orders
// ---------------------------------------------------------------------------

export const buyOrders = pgTable('buy_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => owners.id),
  capitalType: capitalTypeEnum('capital_type').notNull(),
  // Quantity adalah bilangan bulat (integer).
  quantity: integer('quantity').notNull(),
  // Harga Terkunci disimpan sebagai NILAI (AD-7), plus ref baris asal.
  lockedPrice: money('locked_price').notNull(),
  lockedPriceRef: uuid('locked_price_ref')
    .notNull()
    .references(() => pricePeriods.id),
  // Referral wajib s.d. Pembelian Pertama efektif (FR-22).
  referralOwnerId: uuid('referral_owner_id').references(() => owners.id),
  status: orderStatusEnum('status').notNull().default('menunggu_konfirmasi'),
  // Penarikan = kolom, bukan status (AD-2). Pending kanonik:
  //   status = 'menunggu_konfirmasi' AND withdrawn_at IS NULL.
  withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
  submittedAt: timestamp('submitted_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// ---------------------------------------------------------------------------
// ledger: ledger_transactions (append-only, AD-1), positions (proyeksi AD-4)
// ---------------------------------------------------------------------------

export const ledgerTransactions = pgTable('ledger_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => owners.id),
  capitalType: capitalTypeEnum('capital_type').notNull(),
  // Quantity/Shares/Ceil integer (Shares = qty × bobot, Ceil = qty × plafon).
  quantity: integer('quantity').notNull(),
  shares: integer('shares').notNull(),
  ceil: integer('ceil').notNull(),
  // Harga final ter-snapshot sebagai nilai (bukan FK-resolve) + ref baris asal (AD-7).
  finalPrice: money('final_price').notNull(),
  finalPriceRef: uuid('final_price_ref')
    .notNull()
    .references(() => pricePeriods.id),
  // Dana riil disetor (Actual).
  actualAmount: money('actual_amount').notNull(),
  // NULL untuk input langsung / migrasi.
  buyOrderId: uuid('buy_order_id').references(() => buyOrders.id),
  // Plotting (Tetap/Bergerak); NULL Operasional.
  capitalItemId: uuid('capital_item_id').references(() => capitalItems.id),
  paymentDate: date('payment_date').notNull(),
  // 'migrasi' bila historis tak diketahui.
  paymentMethod: text('payment_method').notNull(),
  // Entry kompensasi menunjuk baris asal (AD-1).
  compensationOfId: uuid('compensation_of_id'),
  actor: ledgerActorEnum('actor').notNull().default('user'),
  // Waktu efektif (timestamptz UTC).
  effectiveAt: timestamp('effective_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const positions = pgTable(
  'positions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => owners.id),
    capitalType: capitalTypeEnum('capital_type').notNull(),
    // Agregat per (owner, capital_type) — dipelihara in-tx saat append ledger.
    quantity: integer('quantity').notNull().default(0),
    shares: integer('shares').notNull().default(0),
    ceil: integer('ceil').notNull().default(0),
    actualAmount: money('actual_amount').notNull().default('0'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('positions_owner_capital_type_unique').on(t.ownerId, t.capitalType),
  ],
)

// ---------------------------------------------------------------------------
// contribution: contribution_items, contribution_periods, contribution_entries
// ---------------------------------------------------------------------------

export const contributionPeriods = pgTable('contribution_periods', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  startDate: date('start_date').notNull(),
  cutOffDate: date('cut_off_date'),
  // Difinalkan saat cut-off (FR-10) — snapshot beku imutabel.
  isFinalized: boolean('is_finalized').notNull().default(false),
  finalizedAt: timestamp('finalized_at', { withTimezone: true }),
  createdAt: createdAt(),
})

export const contributionItems = pgTable('contribution_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  // Poin kuantitatif (integer).
  points: integer('points').notNull(),
  periodId: uuid('period_id').references(() => contributionPeriods.id),
  // Tautan MoM penetapan (FR-8).
  momRef: uuid('mom_ref').references(() => moms.id),
  createdAt: createdAt(),
})

export const contributionEntries = pgTable('contribution_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => owners.id),
  itemId: uuid('item_id')
    .notNull()
    .references(() => contributionItems.id),
  periodId: uuid('period_id')
    .notNull()
    .references(() => contributionPeriods.id),
  // Poin realisasi (integer) — biasanya = item.points saat pencatatan.
  points: integer('points').notNull(),
  // Identitas pencatat + tanggal (FR-9).
  recordedBy: uuid('recorded_by')
    .notNull()
    .references(() => owners.id),
  recordedDate: date('recorded_date').notNull(),
  // Sudah diberi insentif pada cut-off (FR-10) — tidak muncul lagi periode berikutnya.
  redeemed: boolean('redeemed').notNull().default(false),
  createdAt: createdAt(),
})

// ---------------------------------------------------------------------------
// distribution: profit_distributions, profit_distribution_lines
// ---------------------------------------------------------------------------

export const profitDistributions = pgTable('profit_distributions', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Snapshot imutabel rekap RUPS (FR-16).
  auditedProfit: money('audited_profit').notNull(),
  retainedProfit: money('retained_profit').notNull(),
  distributableProfit: money('distributable_profit').notNull(),
  // Ratio komponen — numeric(9,6).
  charityRatio: ratio('charity_ratio').notNull(),
  dividendRatio: ratio('dividend_ratio').notNull(),
  incentiveRatio: ratio('incentive_ratio').notNull(),
  // Budget pool per komponen (uang).
  charityPool: money('charity_pool').notNull(),
  dividendPool: money('dividend_pool').notNull(),
  incentivePool: money('incentive_pool').notNull(),
  momRef: uuid('mom_ref').references(() => moms.id),
  createdAt: createdAt(),
})

export const profitDistributionLines = pgTable('profit_distribution_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  distributionId: uuid('distribution_id')
    .notNull()
    .references(() => profitDistributions.id),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => owners.id),
  // Portion owner saat rekap — numeric(9,6).
  portion: ratio('portion').notNull(),
  contributionPoints: integer('contribution_points').notNull().default(0),
  // Bagian per owner (uang).
  dividendAmount: money('dividend_amount').notNull(),
  incentiveAmount: money('incentive_amount').notNull(),
  totalAmount: money('total_amount').notNull(),
  createdAt: createdAt(),
})

// ---------------------------------------------------------------------------
// proofs: email_outbox (post-commit outbox, AD-5)
// ---------------------------------------------------------------------------

export const emailOutbox = pgTable('email_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipient: text('recipient').notNull(),
  subject: text('subject').notNull(),
  body: text('body'),
  // Ref ledger transaction untuk Bukti Transaksi (regenerate-on-demand); NULL untuk notifikasi.
  ledgerTxId: uuid('ledger_tx_id').references(() => ledgerTransactions.id),
  payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
  attempts: integer('attempts').notNull().default(0),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  lastError: text('last_error'),
  createdAt: createdAt(),
})

// ---------------------------------------------------------------------------
// audit: audit_logs (append-only, AD-3 — tanpa UPDATE/DELETE via DB grants)
// ---------------------------------------------------------------------------

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Aktor: owner id COO/pengguna, atau NULL untuk aktor 'system' (migrasi).
  actor: uuid('actor').references(() => owners.id),
  // Aksi dari enum registry (disimpan sebagai text untuk fleksibilitas registry).
  action: text('action').notNull(),
  target: text('target'),
  // Detail aksi (mis. alasan & hitungan penolakan) sebagai JSONB.
  details: jsonb('details').notNull().default(sql`'{}'::jsonb`),
  createdAt: createdAt(),
})
