/**
 * Resolusi email sesi NuxtAuth di sisi server (AD-8) — pemakaian per-request;
 * role/principal TIDAK pernah disimpan di JWT/session (dievaluasi dari DB oleh
 * modul identity). Sesi JWT default berisi email Google saja (tanpa adapter).
 */
import { getServerSession } from '#auth'
import type { H3Event } from 'h3'

/** Email akun Google dari sesi; null bila tidak ada sesi yang sah. */
export async function getSessionEmail(event: H3Event): Promise<string | null> {
  const session = await getServerSession(event)
  return session?.user?.email ?? null
}

/**
 * Nama tampilan akun Google dari sesi (Story 1.5: prefill awal field Nama di
 * halaman Kelengkapan Profile — tidak menimpa data tersimpan); null bila sesi
 * tidak membawa nama.
 */
export async function getSessionNama(event: H3Event): Promise<string | null> {
  const session = await getServerSession(event)
  return session?.user?.name ?? null
}
