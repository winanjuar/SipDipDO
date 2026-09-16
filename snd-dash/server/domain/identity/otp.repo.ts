// server/domain/identity/otp.repo.ts
//
// Lapisan data MFA/OTP (FR-3, FR-20, AD-8): query Drizzle untuk `otp_codes`.
//
// Repo ini murni menerjemahkan operasi ke query; orkestrasi (invalidasi kode
// hidup, cooldown 60s, hashing, batas percobaan, CAS single-use) berada di
// `otp.service.ts`. Penulisan yang berpartisipasi dalam transaksi lintas modul
// menerima handle `tx: Tx` dan TIDAK membuka transaksi sendiri (AD-2).
//
// Kolom `otp_codes` (drizzle/schema.ts): id, cooId, actionType (mfa_action_type
// enum: konfirmasi|input_langsung|kompensasi), targetRef uuid, codeHash text,
// attempts int default 0, consumedAt timestamptz nullable, expiresAt timestamptz,
// createdAt.

import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import type { Tx } from '../../utils/db'
import { schema } from '../../utils/db'
import type { MfaActionType, Uuid } from '../../../shared/domain/types'

const { otpCodes, owners } = schema

/** Pembaca yang menerima instance `db` bound-schema maupun handle `tx`. */
type Reader = Pick<Tx, 'select'>

/** Baris OTP sebagaimana dibaca dari `otp_codes`. */
export interface OtpRow {
  id: Uuid
  cooId: Uuid
  actionType: MfaActionType
  targetRef: Uuid
  codeHash: string
  attempts: number
  consumedAt: Date | null
  expiresAt: Date
  createdAt: Date
}

/** Memetakan baris `otp_codes` ke bentuk domain `OtpRow`. */
function toOtpRow(row: typeof otpCodes.$inferSelect): OtpRow {
  return {
    id: row.id as Uuid,
    cooId: row.cooId as Uuid,
    actionType: row.actionType as MfaActionType,
    targetRef: row.targetRef as Uuid,
    codeHash: row.codeHash,
    attempts: row.attempts,
    consumedAt: row.consumedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  }
}

/**
 * Kode OTP HIDUP terbaru untuk sebuah aksi terlindungi (actionType, targetRef).
 *
 * Hidup = belum dikonsumsi (`consumedAt IS NULL`) DAN belum kedaluwarsa
 * (`expiresAt > at`). Mengembalikan baris paling baru (createdAt desc) atau
 * `null` bila tidak ada. Dipakai `requestOtp` untuk cek cooldown dan
 * `verifyAndConsumeOtp` untuk menemukan kode yang akan diverifikasi.
 */
export async function findLiveByTarget(
  reader: Reader,
  actionType: MfaActionType,
  targetRef: Uuid,
  at: Date,
): Promise<OtpRow | null> {
  const rows = await reader
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.actionType, actionType),
        eq(otpCodes.targetRef, targetRef),
        isNull(otpCodes.consumedAt),
        gt(otpCodes.expiresAt, at),
      ),
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1)
  return rows.length > 0 ? toOtpRow(rows[0]!) : null
}

/**
 * Meng-invalidasi (menandai terkonsumsi) SEMUA kode hidup untuk sebuah aksi
 * terlindungi (cooId, actionType, targetRef). Dipakai `requestOtp` agar hanya
 * ada satu kode hidup per aksi (AD-8). `consumedAt = at` menutup baris tanpa
 * menghapusnya (jejak tetap ada). Mengembalikan jumlah baris terpengaruh.
 */
export async function invalidateLive(
  tx: Tx,
  cooId: Uuid,
  actionType: MfaActionType,
  targetRef: Uuid,
  at: Date,
): Promise<number> {
  const rows = await tx
    .update(otpCodes)
    .set({ consumedAt: at })
    .where(
      and(
        eq(otpCodes.cooId, cooId),
        eq(otpCodes.actionType, actionType),
        eq(otpCodes.targetRef, targetRef),
        isNull(otpCodes.consumedAt),
      ),
    )
    .returning({ id: otpCodes.id })
  return rows.length
}

/**
 * Menyisipkan baris OTP baru (hanya HASH kode, bukan plaintext) untuk aksi
 * terlindungi. `expiresAt` menetapkan masa hidup kode. Mengembalikan baris.
 */
export async function insertCode(
  tx: Tx,
  input: {
    cooId: Uuid
    actionType: MfaActionType
    targetRef: Uuid
    codeHash: string
    expiresAt: Date
  },
): Promise<OtpRow> {
  const rows = await tx
    .insert(otpCodes)
    .values({
      cooId: input.cooId,
      actionType: input.actionType,
      targetRef: input.targetRef,
      codeHash: input.codeHash,
      expiresAt: input.expiresAt,
    })
    .returning()
  return toOtpRow(rows[0]!)
}

/**
 * Menghitung percobaan gagal (attempts) pada jendela waktu (FR-20 §20.2).
 *
 * Menjumlahkan `attempts` seluruh baris untuk aksi (actionType, targetRef) yang
 * dibuat sejak `since` (createdAt >= since). Dipakai untuk memblokir setelah
 * 3 percobaan gagal berturut-turut dalam jendela 300 detik.
 */
export async function countRecentAttempts(
  reader: Reader,
  actionType: MfaActionType,
  targetRef: Uuid,
  since: Date,
): Promise<number> {
  const rows = await reader
    .select({
      total: sql<number>`coalesce(sum(${otpCodes.attempts}), 0)::int`,
    })
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.actionType, actionType),
        eq(otpCodes.targetRef, targetRef),
        gt(otpCodes.createdAt, since),
      ),
    )
  return rows.length > 0 ? Number(rows[0]!.total) : 0
}

/**
 * Menaikkan penghitung `attempts` sebuah baris OTP (kode salah). In-tx pemanggil;
 * bila transaksi aksi rollback penuh, kenaikan ini ikut hilang — karena itu
 * jalur konfirmasi mencatat percobaan gagal di transaksi terpisah (design §300:
 * "penghitung gagal commit terpisah").
 */
export async function incrementAttempts(tx: Tx, id: Uuid): Promise<void> {
  await tx
    .update(otpCodes)
    .set({ attempts: sql`${otpCodes.attempts} + 1` })
    .where(eq(otpCodes.id, id))
}

/**
 * Konsumsi single-use via compare-and-set (AD-8): menandai `consumedAt = at`
 * HANYA bila baris masih hidup — belum dikonsumsi (`consumedAt IS NULL`) dan
 * belum kedaluwarsa (`expiresAt > at`). Tepat satu pemenang pada balapan
 * konkuren. Mengembalikan jumlah baris terpengaruh (1 = menang, 0 = kalah/basi).
 *
 * Konsumsi berpartisipasi dalam transaksi pemanggil sehingga rollback luar
 * meninggalkan OTP TETAP TIDAK terkonsumsi (design.md B — retry tanpa email baru).
 */
export async function consumeById(
  tx: Tx,
  id: Uuid,
  at: Date,
): Promise<number> {
  const rows = await tx
    .update(otpCodes)
    .set({ consumedAt: at })
    .where(
      and(
        eq(otpCodes.id, id),
        isNull(otpCodes.consumedAt),
        gt(otpCodes.expiresAt, at),
      ),
    )
    .returning({ id: otpCodes.id })
  return rows.length
}

/**
 * Alamat email COO untuk pengiriman OTP (FR-22 §22.4 — kontak Owner untuk OTP).
 * `null` bila Owner tidak ditemukan. Dipakai `requestOtp` untuk mengisi
 * recipient baris `email_outbox` (hook pengiriman OTP).
 */
export async function findCooEmail(
  reader: Reader,
  cooId: Uuid,
): Promise<string | null> {
  const rows = await reader
    .select({ email: owners.email })
    .from(owners)
    .where(eq(owners.id, cooId))
    .limit(1)
  return rows.length > 0 ? rows[0]!.email : null
}
