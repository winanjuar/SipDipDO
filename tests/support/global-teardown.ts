/**
 * globalTeardown Playwright — sweep baris uji sintetis (`uji.snddash.e2e.*`)
 * sebagai JARING TERAKHIR hygiene DB dev (laporan owner 2026-09-18: baris
 * mint menumpuk lintas run). Berjalan SETEPAH semua worker selesai — tidak
 * mungkin menabrak test berjalan; menutup celah flush per-test/worker yang
 * kalah race terhadap upsert lintas project browser yang paralel.
 *
 * Best-effort: host non-lokal dilewati dengan peringatan (lihat
 * owner-reset.ts); baris nyata/seed dev tidak pernah disentuh (prefix terkunci
 * `uji.snddash.e2e.%`).
 */
import { hapusSemuaOwnerUjiSintetis } from './helpers/owner-reset'

export default async function globalTeardown(): Promise<void> {
  await hapusSemuaOwnerUjiSintetis()
}
