// server/domain/identity/otp.service.ts
//
// Orkestrasi MFA/OTP email (FR-3, FR-20 §20.2, AD-8).
//
// Tanggung jawab:
//   - requestOtp: invalidasi kode hidup sebelumnya, tegakkan cooldown resend 60s
//     server-side, bangkitkan OTP numerik acak, simpan HANYA hash (SHA-256 HMAC,
//     node:crypto), set expiresAt (now + beberapa menit), enqueue email (hook),
//     dan CATAT permintaan di audit ('otp_requested'). Membuka transaksinya sendiri.
//   - verifyAndConsumeOtp: menerima `tx` (in-tx aksi finalisasi). Temukan kode
//     hidup untuk (actionType, targetRef), verifikasi hash (perbandingan waktu-
//     tetap), tegakkan batas percobaan (blokir setelah 3 percobaan gagal dalam
//     jendela 300s), naikkan attempts saat salah, dan konsumsi single-use via CAS
//     dalam transaksi pemanggil (rollback luar ⟹ OTP tetap TIDAK terkonsumsi).
//
// OTP disimpan sebagai HASH — plaintext tidak pernah menyentuh DB (Security
// Considerations). Perbandingan hash memakai `timingSafeEqual` untuk mengurangi
// kebocoran lewat kanal waktu.

import type { Tx } from '../../utils/db'
import { withTransaction } from '../../utils/db'
import type { MfaActionType, Uuid } from '../../../shared/domain/types'
import * as otpRepo from './otp.repo'
import { enqueueOtpEmail } from './otp.email'
import { IdentityError } from './identity.service'
import { insert as auditInsert } from '../audit/audit.repo'
import type { AuditEntry } from '../audit/events'

// ---------------------------------------------------------------------------
// Parameter kebijakan MFA (FR-3, FR-20 §20.2, Security Considerations)
// ---------------------------------------------------------------------------

/** Panjang kode OTP numerik (digit). */
const OTP_DIGITS = 6

/** Masa hidup OTP sejak dibuat (ms) — beberapa menit (5 menit). */
const OTP_TTL_MS = 5 * 60_000

/** Cooldown resend server-side (ms) — 60 detik (Security Considerations). */
const RESEND_COOLDOWN_MS = 60_000

/** Jendela penghitungan percobaan gagal (ms) — 300 detik (FR-20 §20.2). */
const ATTEMPT_WINDOW_MS = 300_000

/** Batas percobaan gagal berturut-turut dalam jendela sebelum diblokir (FR-20 §20.2). */
const MAX_FAILED_ATTEMPTS = 3

// ---------------------------------------------------------------------------
// Akses node:crypto & Buffer via globalThis — sejalan `readEnv` di utils/db.ts,
// menjaga type-check lolos di tsconfig server terisolasi TANPA `@types/node`.
// Nitro/Node menyediakan `Buffer` global dan modul `node:crypto` saat runtime
// (diakses lewat `process.getBuiltinModule`, sinkron).
// ---------------------------------------------------------------------------

/** Bentuk minimal buffer bytes yang kita perlukan (length + kompatibel crypto). */
interface Bytes {
  readonly length: number
}

/** Bentuk minimal fungsi node:crypto yang dipakai modul ini. */
interface NodeCrypto {
  createHmac(algorithm: string, key: string): {
    update(data: string): { digest(encoding: string): string }
  }
  randomInt(min: number, max: number): number
  timingSafeEqual(a: Bytes, b: Bytes): boolean
}

/** Akses `globalThis` bertipe minimal untuk built-in Node yang dipakai. */
const g = globalThis as unknown as {
  Buffer: { from(input: string, encoding: string): Bytes }
  process?: {
    env?: Record<string, string | undefined>
    getBuiltinModule?: (id: string) => unknown
  }
}

/** Mengambil modul `node:crypto` saat runtime (sinkron) via process.getBuiltinModule. */
function nodeCrypto(): NodeCrypto {
  const mod = g.process?.getBuiltinModule?.('node:crypto')
  if (!mod) {
    throw new Error('node:crypto tidak tersedia pada runtime ini')
  }
  return mod as NodeCrypto
}

/**
 * Rahasia HMAC untuk hashing OTP. Dari env `OTP_HMAC_SECRET` bila tersedia;
 * jatuh ke default deterministik agar type-check/build tetap lolos tanpa env.
 * Rahasia produksi WAJIB disuntik via environment.
 */
function otpSecret(): string {
  return g.process?.env?.OTP_HMAC_SECRET ?? 'snd-dash-otp-hmac-dev-secret'
}

/** Meng-hash kode OTP (HMAC-SHA256) untuk disimpan — plaintext tak pernah disimpan. */
function hashCode(code: string): string {
  return nodeCrypto().createHmac('sha256', otpSecret()).update(code).digest('hex')
}

/** Membangkitkan kode OTP numerik acak (kriptografis) sepanjang `OTP_DIGITS`. */
function generateCode(): string {
  const max = 10 ** OTP_DIGITS
  return String(nodeCrypto().randomInt(0, max)).padStart(OTP_DIGITS, '0')
}

/** Perbandingan hash heksadesimal dengan waktu-tetap (anti timing attack). */
function hashEquals(a: string, b: string): boolean {
  const bufA = g.Buffer.from(a, 'utf8')
  const bufB = g.Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return nodeCrypto().timingSafeEqual(bufA, bufB)
}

/** Menulis entri audit in-tx (AD-3). Selaras dengan helper di identity.service. */
async function writeAudit(
  tx: Tx,
  entry: AuditEntry,
): Promise<void> {
  await auditInsert(tx, entry)
}

// ---------------------------------------------------------------------------
// requestOtp — invalidasi kode hidup + cooldown 60s + audit (FR-3 §3.1/§3.4)
// ---------------------------------------------------------------------------

/**
 * Meminta OTP untuk aksi transaksional terlindungi (himpunan tertutup AD-8:
 * konfirmasi | input_langsung | kompensasi). Membuka transaksinya sendiri.
 *
 * Langkah (atomik):
 *   1. Cooldown resend 60s: tolak (`OTP_COOLDOWN`) bila ada kode hidup yang
 *      dibuat < 60 detik lalu (mencegah spam kirim ulang).
 *   2. Invalidasi seluruh kode hidup sebelumnya untuk aksi ini (satu kode hidup
 *      per aksi, AD-8).
 *   3. Bangkitkan OTP numerik acak; simpan HANYA hash; set expiresAt = now + TTL.
 *   4. Enqueue email OTP ke kontak COO (hook; best-effort, tidak hard-fail).
 *   5. Catat permintaan di audit ('otp_requested') — FR-3 §3.4.
 */
export function requestOtp(
  actionType: MfaActionType,
  targetRef: Uuid,
  cooId: Uuid,
): Promise<void> {
  return withTransaction(async (tx) => {
    const now = new Date()

    // 1. Cooldown resend 60s server-side (Security Considerations).
    const live = await otpRepo.findLiveByTarget(tx, actionType, targetRef, now)
    if (live && now.getTime() - live.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      const retryAfterMs =
        RESEND_COOLDOWN_MS - (now.getTime() - live.createdAt.getTime())
      throw new IdentityError('OTP_COOLDOWN', {
        actionType,
        targetRef,
        retryAfterMs,
      })
    }

    // 2. Invalidasi kode hidup sebelumnya — satu kode hidup per aksi (AD-8).
    await otpRepo.invalidateLive(tx, cooId, actionType, targetRef, now)

    // 3. Bangkitkan kode & simpan hanya hash.
    const code = generateCode()
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS)
    await otpRepo.insertCode(tx, {
      cooId,
      actionType,
      targetRef,
      codeHash: hashCode(code),
      expiresAt,
    })

    // 4. Enqueue email OTP ke kontak COO (hook; tidak hard-fail).
    const recipient = await otpRepo.findCooEmail(tx, cooId)
    await enqueueOtpEmail(tx, {
      recipient,
      actionType,
      targetRef,
      code,
      expiresAt,
    })

    // 5. Catat permintaan di audit (FR-3 §3.4).
    await writeAudit(tx, {
      actor: cooId,
      action: 'otp_requested',
      target: targetRef,
      details: { actionType, expiresAt: expiresAt.toISOString() },
    })
  })
}

// ---------------------------------------------------------------------------
// verifyAndConsumeOtp — single-use via CAS, konsumsi in-tx (FR-3 §3.2, FR-20 §20.2)
// ---------------------------------------------------------------------------

/**
 * Memverifikasi & mengonsumsi OTP DI DALAM transaksi aksi pemanggil (AD-8).
 *
 * MUST menerima `tx`: konsumsi berpartisipasi dalam transaksi finalisasi
 * sehingga rollback luar (mis. re-validasi gagal) meninggalkan OTP TETAP TIDAK
 * terkonsumsi — retry tanpa perlu email baru (design §300/§553).
 *
 * Langkah:
 *   1. Batas percobaan (FR-20 §20.2): bila jumlah percobaan gagal dalam jendela
 *      300s sudah >= 3, tolak dengan `OTP_BLOCKED`.
 *   2. Temukan kode HIDUP untuk (actionType, targetRef). Bila tak ada → tentukan
 *      apakah karena tidak pernah ada / kedaluwarsa (`OTP_EXPIRED`).
 *   3. Verifikasi hash (waktu-tetap). Bila salah → naikkan attempts & tolak
 *      (`OTP_INVALID`), atau `OTP_BLOCKED` bila percobaan ini melewati batas.
 *   4. Bila benar → konsumsi single-use via CAS (tepat satu pemenang). Bila CAS
 *      kalah (kode sudah dikonsumsi/kedaluwarsa di antaranya) → `MFA_FAILED`.
 */
export async function verifyAndConsumeOtp(
  tx: Tx,
  actionType: MfaActionType,
  targetRef: Uuid,
  code: string,
): Promise<void> {
  const now = new Date()
  const windowStart = new Date(now.getTime() - ATTEMPT_WINDOW_MS)

  // 1. Blokir bila sudah >= 3 percobaan gagal dalam jendela 300s (FR-20 §20.2).
  const priorFailures = await otpRepo.countRecentAttempts(
    tx,
    actionType,
    targetRef,
    windowStart,
  )
  if (priorFailures >= MAX_FAILED_ATTEMPTS) {
    throw new IdentityError('OTP_BLOCKED', {
      actionType,
      targetRef,
      failures: priorFailures,
      windowSeconds: ATTEMPT_WINDOW_MS / 1000,
    })
  }

  // 2. Temukan kode hidup (belum dikonsumsi & belum kedaluwarsa).
  const live = await otpRepo.findLiveByTarget(tx, actionType, targetRef, now)
  if (!live) {
    // Tidak ada kode hidup: kedaluwarsa atau belum pernah diminta.
    throw new IdentityError('OTP_EXPIRED', { actionType, targetRef })
  }

  // 3. Verifikasi hash (waktu-tetap).
  if (!hashEquals(live.codeHash, hashCode(code))) {
    await otpRepo.incrementAttempts(tx, live.id)
    const failuresNow = priorFailures + 1
    if (failuresNow >= MAX_FAILED_ATTEMPTS) {
      throw new IdentityError('OTP_BLOCKED', {
        actionType,
        targetRef,
        failures: failuresNow,
        windowSeconds: ATTEMPT_WINDOW_MS / 1000,
      })
    }
    throw new IdentityError('OTP_INVALID', {
      actionType,
      targetRef,
      remainingAttempts: MAX_FAILED_ATTEMPTS - failuresNow,
    })
  }

  // 4. Konsumsi single-use via CAS (tepat satu pemenang) — in-tx pemanggil.
  const consumed = await otpRepo.consumeById(tx, live.id, now)
  if (consumed !== 1) {
    // Kode sudah dikonsumsi/kedaluwarsa di antara baca & tulis (balapan).
    throw new IdentityError('MFA_FAILED', { actionType, targetRef })
  }

  // Catat verifikasi MFA berhasil (FR-3 §3.4) — in-tx aksi.
  await writeAudit(tx, {
    actor: live.cooId,
    action: 'mfa_requested',
    target: targetRef,
    details: { actionType, verified: true },
  })
}
