// app/composables/useApi.ts
//
// Pembantu klien tipis untuk halaman inti task 19.4 (RKAP, harga/MoM, kontribusi,
// distribusi, audit, pendaftaran, profil). BUKAN otoritas keputusan — server
// tetap satu-satunya otoritas akses (§4.8). Utilitas ini hanya:
//   - memanggil route API `/api/**` (yang sudah menegakkan akses & `no-store`),
//   - menyeragamkan bentuk error `{ code, message, details }`,
//   - memformat NILAI DESIMAL yang datang sebagai STRING (AD-10) TANPA `Number()`/
//     `parseFloat()` atas nilai uang/rasio — money never float.
//
// Semua fungsi di sini aman diimpor SSR + klien (tanpa efek samping global).

/** Bentuk error API seragam (design.md Error Handling). */
export interface ApiErrorShape {
  code: string
  message: string
  details?: Record<string, unknown>
}

/** Hasil pembungkus: sukses membawa `data`, gagal membawa `error`. */
export interface ApiResult<T> {
  data: T | null
  error: ApiErrorShape | null
}

/**
 * Deteksi apakah payload adalah error API seragam (route melempar) alih-alih
 * data sukses `{ data }`. Route sukses selalu mengembalikan `{ data: … }`;
 * route gagal mengembalikan `{ code, message, details? }` (http.ts sendApiError).
 */
function isApiError(payload: unknown): payload is ApiErrorShape {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as { code?: unknown }).code === 'string' &&
    typeof (payload as { message?: unknown }).message === 'string' &&
    !('data' in (payload as Record<string, unknown>))
  )
}

/**
 * Memanggil route API dan menormalkan hasil menjadi `ApiResult<T>`. Tidak pernah
 * melempar untuk error API terkelola — mengembalikan `{ data: null, error }` agar
 * halaman dapat menampilkan pesan (angka basi TIDAK pernah ditampilkan, AD-12).
 */
/**
 * Header yang diteruskan ke `$fetch`. Saat SSR, $fetch internal TIDAK otomatis
 * membawa cookie klien — tanpa ini, route API membalas 401 (buildPrincipal tak
 * menemukan sesi). Meneruskan header 'cookie' dari request SSR memperbaikinya.
 * Di klien, cookie ikut otomatis, jadi cukup Cache-Control saja.
 */
function buildHeaders(): Record<string, string> {
  const base: Record<string, string> = { 'Cache-Control': 'no-store' }
  if (import.meta.server) {
    const cookie = useRequestHeaders(['cookie']).cookie
    if (cookie) base.cookie = cookie
  }
  return base
}

export async function apiGet<T>(
  url: string,
  query?: Record<string, string | number | undefined>,
): Promise<ApiResult<T>> {
  try {
    const payload = await $fetch<unknown>(url, {
      method: 'GET',
      query,
      headers: buildHeaders(),
    })
    if (isApiError(payload)) return { data: null, error: payload }
    const data = (payload as { data?: T }).data
    return { data: (data ?? null) as T | null, error: null }
  } catch (err: unknown) {
    return { data: null, error: normalizeError(err) }
  }
}

/** POST varian dari `apiGet` — body JSON, hasil dinormalkan `ApiResult<T>`. */
export async function apiPost<T>(
  url: string,
  body?: Record<string, unknown>,
): Promise<ApiResult<T>> {
  try {
    const payload = await $fetch<unknown>(url, {
      method: 'POST',
      body,
      headers: buildHeaders(),
    })
    if (isApiError(payload)) return { data: null, error: payload }
    const data = (payload as { data?: T }).data
    return { data: (data ?? null) as T | null, error: null }
  } catch (err: unknown) {
    return { data: null, error: normalizeError(err) }
  }
}

/** Menormalkan error `$fetch` (yang membungkus body pada `data`) → ApiErrorShape. */
function normalizeError(err: unknown): ApiErrorShape {
  const data = (err as { data?: unknown })?.data
  if (isApiError(data)) return data
  const message =
    (err as { message?: string })?.message ?? 'Tidak dapat memuat data.'
  return { code: 'NETWORK', message }
}

// ---------------------------------------------------------------------------
// Format tampilan nilai desimal berskala tetap (STRING → STRING) — AD-10
// ---------------------------------------------------------------------------

/**
 * Memformat MoneyString (mis. '44744000.00') menjadi tampilan berkelompok ribuan
 * Indonesia (mis. '44.744.000,00') TANPA `Number()`/`parseFloat()`. Bekerja pada
 * representasi string agar presisi tak pernah hilang (money never float).
 */
export function formatMoney(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const negative = value.startsWith('-')
  const unsigned = negative ? value.slice(1) : value
  const [intPart, fracPart = ''] = unsigned.split('.')
  const grouped = groupThousands(intPart ?? '0')
  const frac = fracPart.padEnd(2, '0').slice(0, 2)
  return `${negative ? '-' : ''}Rp ${grouped},${frac}`
}

/**
 * Memformat RatioString (fraksi 0..1, mis. '0.666700') menjadi persen half-up 2
 * desimal untuk display (mis. '66,67%'), TANPA `Number()`/`parseFloat()` atas
 * nilai rasio. Half-up dihitung secara string-desimal.
 */
export function formatRatioPercent(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const negative = value.startsWith('-')
  const unsigned = negative ? value.slice(1) : value
  // Persen = rasio × 100 → geser titik desimal dua tempat ke kanan.
  const [intPart, fracRaw = ''] = unsigned.split('.')
  const frac = fracRaw.padEnd(4, '0') // butuh ≥4 desimal untuk half-up 2 desimal persen
  // Bentuk angka persen sebagai string: intPart + 2 digit pertama frac (bagian
  // bulat persen), lalu 2 digit berikut sebagai desimal persen untuk half-up.
  const percentIntDigits = `${intPart}${frac.slice(0, 2)}`.replace(/^0+(?=\d)/, '')
  const percentFracDigits = frac.slice(2, 4)
  const roundDigit = frac.slice(4, 5) || '0'
  const rounded = halfUp(`${percentIntDigits}.${percentFracDigits}`, roundDigit)
  const [ri, rf = '00'] = rounded.split('.')
  const grouped = groupThousands(ri || '0')
  return `${negative ? '-' : ''}${grouped},${rf.padEnd(2, '0').slice(0, 2)}%`
}

/** Half-up pada 2 desimal berdasar digit pembulat (string murni). */
function halfUp(numStr: string, roundDigit: string): string {
  const [intPart, fracPart = ''] = numStr.split('.')
  const frac2 = fracPart.padEnd(2, '0').slice(0, 2)
  if (roundDigit < '5') return `${intPart}.${frac2}`
  // Tambah 1 pada dua desimal (dengan carry) — aritmetika string sederhana.
  let carry = 1
  const digits = `${intPart}${frac2}`.split('')
  for (let i = digits.length - 1; i >= 0 && carry > 0; i--) {
    const sum = (digits[i]!.charCodeAt(0) - 48) + carry
    digits[i] = String.fromCharCode(48 + (sum % 10))
    carry = sum >= 10 ? 1 : 0
  }
  const joined = (carry > 0 ? '1' : '') + digits.join('')
  const newFrac = joined.slice(-2)
  const newInt = joined.slice(0, -2) || '0'
  return `${newInt}.${newFrac}`
}

/** Menyisipkan pemisah ribuan '.' pada string integer non-negatif. */
function groupThousands(intStr: string): string {
  const clean = intStr.replace(/^0+(?=\d)/, '')
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Format tanggal Jakarta 'YYYY-MM-DD' apa adanya (sudah zona Jakarta, AD-9). */
export function formatDate(value: string | null | undefined): string {
  return value ?? '—'
}

/** Format instant (Date/ISO) menjadi tampilan lokal Asia/Jakarta yang ringkas. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d)
}
