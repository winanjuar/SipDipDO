import { LANDING_PATH } from '../domain/identity'
import { getSessionEmail } from '../utils/session'

/**
 * Proteksi sesi SSR (AD-8): permintaan dokumen/payload ke halaman terproteksi
 * tanpa sesi sah dialihkan ke `/login` sebelum render. Himpunan halaman
 * terproteksi = nilai `LANDING_PATH` (satu sumber dengan kontrak landing).
 * Route handler tetap wajib auth sendiri (AD-8: middleware + route handler).
 */
const HALAMAN_TERPROTEKSI: ReadonlySet<string> = new Set(Object.values(LANDING_PATH))

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!HALAMAN_TERPROTEKSI.has(path)) return

  const email = await getSessionEmail(event)
  if (!email) return sendRedirect(event, '/login')
})
