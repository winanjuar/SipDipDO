import { z } from 'zod'
import { profilLengkap, sisaFieldKosong } from '#shared/domain/profil'
import {
  buildPrincipal,
  createIdentityRepo,
  findOwnerById,
} from '../../domain/identity'
import { HTTP_STATUS, sendApiError } from '../../utils/api-error'
import { useDb } from '../../utils/db'
import { getSessionEmail } from '../../utils/session'
import { getRouterParam } from 'h3'

/**
 * GET /api/pendaftar/:id — detail data pendaftar `diajukan` khusus COO
 * (penyempurnaan 2026-09-23, AD-8): seluruh isian Lampiran A untuk diperiksa
 * COO sebelum verifikasi. Bentuk field PERSIS wire `GET /api/profile`
 * (kunci English; `bankName` enum ATAU 'Lainnya' + `otherBankName` teks
 * bebasnya — diurai repo via `namaBankKeWire`). Gate COO pola
 * `audit/index.get.ts` (401 / redirect unlinked / 403); id tak sah → 400;
 * bukan calon `diajukan` / tidak ada → 404 TIDAK_DITEMUKAN. Route handler
 * TIPIS — baca via `findOwnerById`, tanpa menulis apa pun.
 */
export default defineEventHandler(async (event) => {
  const email = await getSessionEmail(event)
  if (!email) {
    return sendApiError(event, HTTP_STATUS.unauthorized, {
      code: 'UNAUTHORIZED',
      message: 'Sesi tidak ditemukan — masuk lewat halaman Login.',
      details: {},
    })
  }

  const principal = await buildPrincipal(createIdentityRepo(useDb()), email)
  if (principal.unlinked) return sendRedirect(event, '/login?res=unlinked')
  if (principal.role !== 'coo') {
    return sendApiError(event, HTTP_STATUS.forbidden, {
      code: 'FORBIDDEN',
      message: 'Detail pendaftar hanya dapat dibuka oleh COO yang bertugas.',
      details: {},
    })
  }

  const id = getRouterParam(event, 'id')
  const terurai = z.uuid().safeParse(id)
  if (!terurai.success) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'Parameter id harus uuid.',
      details: { masalah: terurai.error.issues.map(i => i.message) },
    })
  }

  const calon = await findOwnerById(useDb(), terurai.data)
  if (!calon || calon.status !== 'diajukan') {
    return sendApiError(event, HTTP_STATUS.notFound, {
      code: 'TIDAK_DITEMUKAN',
      message: 'Calon pendaftar tidak ditemukan.',
      details: { id: terurai.data },
    })
  }

  return {
    id: calon.id,
    email: calon.email,
    status: calon.status,
    fullName: calon.fullName ?? '',
    alias: calon.alias ?? '',
    phoneNumber: calon.phoneNumber ?? '',
    emergencyContactName: calon.emergencyContactName ?? '',
    emergencyContactPhoneNumber: calon.emergencyContactPhoneNumber ?? '',
    emergencyContactRelationship: calon.emergencyContactRelationship ?? '',
    bankName: calon.bankName ?? '',
    otherBankName: calon.otherBankName ?? '',
    accountHolderName: calon.accountHolderName ?? '',
    accountNumber: calon.accountNumber ?? '',
    profilLengkap: profilLengkap(calon),
    sisaField: sisaFieldKosong(calon),
  }
})
