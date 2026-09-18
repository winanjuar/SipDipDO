import { z } from 'zod'
import {
  FIELD_PROFIL_SIMPAN,
  validasiProfil,
  type KunciFieldProfil,
  type ProfilValues,
} from '#shared/domain/profil'
import { findOwnerByEmail, simpanProfil } from '../../domain/identity'
import { HTTP_STATUS, sendApiError } from '../../utils/api-error'
import { useDb } from '../../utils/db'
import { getSessionEmail } from '../../utils/session'
import { readBody, setResponseStatus } from 'h3'

/**
 * PUT /api/profile — simpan kelengkapan Profile calon owner (Story 1.5,
 * CAP-1/FR-22; Lampiran A #1–10). Handler tipis (pola register/index.post.ts):
 * sesi → 401; selain calon `diajukan` → 403 (CAP-3); body membawa `referral`
 * → 400 (referral hanya saat Pembelian Pertama, Epic 3).
 *
 * Validasi dua lapis dari kontrak murni `shared/domain/profil`
 * (re-negotiasi owner 2026-09-18 — sanitasi, panjang maksimum, pola nomor,
 * enum Bank/Hubungan):
 * - field wajib kosong → 400 `PROFILE_INCOMPLETE` + `details.remainingFields`
 *   (termasuk `otherBankName` bila Bank "Lainnya" tanpa nama bank lain);
 * - format/enum salah → 400 `PROFILE_INVALID` + `details.invalidFields`
 *   `[{ field, kode }]`;
 * keduanya TANPA tulisan DB. Sukses → 200 nilai BERSIH (hasil sanitasi) +
 * `gmail = email sesi, profileComplete: true, remainingFields: []` + audit
 * `profil-kelengkapan` in-tx di service. Gmail TIDAK diterima dari body.
 */

/**
 * Skema bentuk body dari kontrak `shared/domain/profil` (satu sumber kunci):
 * setiap field `string | undefined` — kelongcopan & format dievaluasi
 * `validasiProfil` agar absen/kosong/non-string dilaporkan seragam.
 */
const SkemaIsianProfil = z.object(
  Object.fromEntries(FIELD_PROFIL_SIMPAN.map((kunci) => [kunci, z.string().optional()])),
) as unknown as z.ZodType<Record<KunciFieldProfil, string | undefined>>

export default defineEventHandler(async (event) => {
  const email = await getSessionEmail(event)
  if (!email) {
    return sendApiError(event, HTTP_STATUS.unauthorized, {
      code: 'UNAUTHORIZED',
      message: 'Sesi tidak ditemukan — masuk lewat halaman Login.',
      details: {},
    })
  }

  const owner = await findOwnerByEmail(useDb(), email)
  if (!owner || owner.status !== 'diajukan') {
    return sendApiError(event, HTTP_STATUS.forbidden, {
      code: 'FORBIDDEN',
      message: 'Hanya calon owner berstatus diajukan yang dapat mengisi kelengkapan Profile.',
      details: {},
    })
  }

  const body = (await readBody<Record<string, unknown>>(event).catch(() => undefined)) ?? {}
  if (typeof body === 'object' && body !== null && 'referral' in body) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'Field referral tidak diterima di Profile — referral diminta saat Pembelian Pertama.',
      details: {},
    })
  }

  const terurai = SkemaIsianProfil.safeParse(body)
  const mentah: Partial<Record<KunciFieldProfil, string>> = Object.fromEntries(
    FIELD_PROFIL_SIMPAN.map((kunci) => [kunci, terurai.success ? terurai.data[kunci] : '']),
  )

  const { bersih, sisa, kesalahan } = validasiProfil(mentah)
  if (kesalahan.length > 0) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'PROFILE_INVALID',
      message: 'Isian Profile belum sah — periksa field yang ditandai.',
      details: { invalidFields: kesalahan },
    })
  }
  if (sisa.length > 0) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'PROFILE_INCOMPLETE',
      message: 'Profil belum lengkap — isi seluruh field yang tersisa.',
      details: { remainingFields: sisa },
    })
  }

  const nilaiBersih: ProfilValues = bersih
  await simpanProfil({ email, nilai: nilaiBersih }, useDb())
  setResponseStatus(event, HTTP_STATUS.ok)
  return {
    ...nilaiBersih,
    gmail: email,
    profileComplete: true,
    remainingFields: [],
  }
})
