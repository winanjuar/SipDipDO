import { z } from 'zod'
import {
  buildPrincipal,
  createIdentityRepo,
  KEPUTUSAN_COO,
  keputusanCalon,
  PANJANG_MAKS_ALASAN_PENOLAKAN,
} from '../../domain/identity'
import { HTTP_STATUS, sendApiError } from '../../utils/api-error'
import { useDb } from '../../utils/db'
import { getSessionEmail } from '../../utils/session'
import { readBody, setResponseStatus } from 'h3'

/**
 * POST /api/pendaftar/keputusan — keputusan COO atas calon `diajukan`
 * (Story 1.6, AD-8/AD-11): gate COO pola `server/api/audit/index.get.ts`
 * (401 / redirect unlinked / 403); body divalidasi zod
 * `{ id: uuid, keputusan: 'terverifikasi'|'ditolak', alasan? }` — enum
 * keputusan SATU SUMBER dari `KEPUTUSAN_COO` modul identity; alasan dibatasi
 * `PANJANG_MAKS_ALASAN_PENOLAKAN`. Alasan
 * penolakan wajib non-kosong setelah trim (400 `ALASAN_WAJIB`) — gate
 * pertama sebelum service (gate kedua). Route handler TIPIS: transisi CAS,
 * gerbang kelengkapan, hitungan penolakan, dan audit in-tx semuanya di
 * service `keputusanCalon`; handler hanya memetakan kode akhir ke status
 * HTTP envelope seragam.
 */

const SkemaKeputusan = z.object({
  id: z.uuid(),
  keputusan: z.enum(KEPUTUSAN_COO),
  alasan: z.string().max(PANJANG_MAKS_ALASAN_PENOLAKAN).optional(),
})

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
      message: 'Keputusan pendaftar hanya dapat diambil oleh COO yang bertugas.',
      details: {},
    })
  }

  const body = await readBody<unknown>(event).catch(() => undefined)
  const terurai = SkemaKeputusan.safeParse(body)
  if (!terurai.success) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'BAD_REQUEST',
      message: 'Body keputusan harus { id: uuid, keputusan: "terverifikasi"|"ditolak", alasan? }.',
      details: { masalah: terurai.error.issues.map(i => i.message) },
    })
  }
  const input = terurai.data

  // Alasan penolakan wajib non-kosong setelah trim (UX-DR20) — service
  // menegakkan gerbang yang sama (dua lapis, sesuai spec).
  if (input.keputusan === 'ditolak' && (input.alasan ?? '').trim().length === 0) {
    return sendApiError(event, HTTP_STATUS.badRequest, {
      code: 'ALASAN_WAJIB',
      message: 'Alasan penolakan wajib diisi.',
      details: {},
    })
  }

  const hasil = await keputusanCalon(
    {
      emailCoo: email,
      id: input.id,
      keputusan: input.keputusan,
      ...(input.alasan !== undefined ? { alasan: input.alasan } : {}),
    },
    useDb(),
  )

  switch (hasil.akhir) {
    case 'sukses':
      setResponseStatus(event, HTTP_STATUS.ok)
      return { id: hasil.id, email: hasil.email, status: hasil.status }
    case 'tidak-ditemukan':
      return sendApiError(event, HTTP_STATUS.notFound, {
        code: 'TIDAK_DITEMUKAN',
        message: 'Calon pendaftar tidak ditemukan.',
        details: { id: input.id },
      })
    case 'kewenangan-berakhir':
      return sendApiError(event, HTTP_STATUS.forbidden, {
        code: 'FORBIDDEN',
        message: 'Kewenangan COO tidak berlaku pada saat keputusan disimpan.',
        details: {},
      })
    case 'profil-belum-lengkap':
      return sendApiError(event, HTTP_STATUS.badRequest, {
        code: 'PROFILE_INCOMPLETE',
        message: 'Profil calon belum lengkap — verifikasi hanya dapat dilakukan untuk calon dengan Profil lengkap.',
        details: { sisaField: hasil.sisaField },
      })
    case 'alasan-wajib':
      return sendApiError(event, HTTP_STATUS.badRequest, {
        code: 'ALASAN_WAJIB',
        message: 'Alasan penolakan wajib diisi.',
        details: {},
      })
    case 'status-berubah':
      return sendApiError(event, HTTP_STATUS.conflict, {
        code: 'STATUS_BERUBAH',
        message: 'Status pendaftar sudah berubah — muat ulang daftar.',
        details: {},
      })
  }
})
