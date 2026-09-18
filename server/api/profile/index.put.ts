import { z } from 'zod'
import {
  FIELD_PROFIL_SIMPAN,
  sisaFieldKosong,
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
 * → 400 (referral hanya saat Pembelian Pertama, Epic 3); field kosong/absen
 * → 400 dengan `details.remainingFields` PERSIS kunci field kosong (CAP-2 di
 * wire) — TANPA tulisan DB. Sukses → 200 `{ ...field, gmail = email sesi,
 * profileComplete: true, remainingFields: [] }` + audit `profil-kelengkapan`
 * in-tx di service. Gmail TIDAK diterima dari body — selalu email sesi.
 */

/**
 * Skema bentuk body dari kontrak `shared/domain/profil` (satu sumber kunci):
 * setiap field `string | undefined` — kelongkopan dievaluasi predikat murni
 * `sisaFieldKosong` agar absen/kosong/non-string dilaporkan seragam.
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
  const isian: ProfilValues = Object.fromEntries(
    FIELD_PROFIL_SIMPAN.map((kunci) => [kunci, (terurai.success ? terurai.data[kunci] : '')?.trim() ?? '']),
  ) as ProfilValues

  const sisa = sisaFieldKosong(isian)
  if (sisa.length > 0) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'PROFILE_INCOMPLETE',
      message: 'Profil belum lengkap — isi seluruh field yang tersisa.',
      details: { remainingFields: sisa },
    })
  }

  await simpanProfil({ email, nilai: isian }, useDb())
  setResponseStatus(event, HTTP_STATUS.ok)
  return {
    ...isian,
    gmail: email,
    profileComplete: true,
    remainingFields: [],
  }
})
