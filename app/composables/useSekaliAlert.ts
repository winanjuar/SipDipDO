/**
 * useSekaliAlertMasuk — alert "Masuk berhasil." TEPAT SEKALI di halaman
 * landing pasca-login (permintaan owner 2026-09-18, direvisi 2026-09-18:
 * toast diganti ALERT di BAGIAN ATAS halaman — toast bawah tak terlihat —
 * auto-hilang 3 detik).
 *
 * useSekaliAlertPendaftaran — alert "Pendaftaran berhasil diajukan." SEKALI
 * di halaman status pasca-daftar (keputusan owner 2026-09-21: query param
 * `?daftar=berhasil` DIHAPUS — redirect dari register.vue adalah
 * sisi-klien, sehingga flag sessionStorage cukup; URL tetap polos).
 *
 * Mekanisme keduanya: halaman asal menandai `sessionStorage` SEBELUM
 * navigasi; halaman tujuan membaca, menampilkan alert, lalu MENGHAPUS flag
 * — refresh/tab lain tidak mengulang konfirmasi.
 *
 * Dipakai: dashboard, personal, order-queue, registration-status.
 * Halaman status memprioritaskan alert daftar (flag pendaftaran) bila
 * keduanya hadir — "Masuk berhasil." dilewati.
 *
 * Return: ref pesan (string kosong = tersembunyi) — render sebagai
 * <Alert variant="success"> di atas halaman, aria-live="polite".
 */

/** Durasi alert sukses (ms) — otomatis hilang. */
export const DURASI_ALERT_SUKSES_MS = 3_000

/** Kunci flag sessionStorage — kontrak dipakai juga test E2E. */
const KUNCI_FLAG_MASUK = 'snd-dash.alert-masuk-berhasil'
const KUNCI_FLAG_DAFTAR = 'snd-dash.pendaftaran-berhasil'

/** Tandai sesi ini baru saja login sukses — dipanggil halaman login. */
export function tandaiMasukBerhasil(): void {
  sessionStorage.setItem(KUNCI_FLAG_MASUK, '1')
}

/** Tandai sesi ini baru saja mendaftar sukses — dipanggil halaman register
 *  SEBELUM hard-navigasi ke halaman status (URL tetap polos). */
export function tandaiPendaftaranBerhasil(): void {
  sessionStorage.setItem(KUNCI_FLAG_DAFTAR, '1')
}

/** Sembunyikan pesan setelah durasi — timer dibatalkan bila berganti. */
let timerHilang: ReturnType<typeof setTimeout> | undefined

/** Alert masuk sekali di landing pertama (klien-saja) — return ref pesan. */
export function useSekaliAlertMasuk(): Ref<string> {
  const pesan = ref('')

  onMounted(() => {
    if (sessionStorage.getItem(KUNCI_FLAG_MASUK) !== '1') return
    sessionStorage.removeItem(KUNCI_FLAG_MASUK)
    // Halaman status dengan alert daftar menang — jangan dua alert bertumpuk.
    if (sessionStorage.getItem(KUNCI_FLAG_DAFTAR) === '1') return
    pesan.value = 'Masuk berhasil.'
    if (timerHilang !== undefined) clearTimeout(timerHilang)
    timerHilang = setTimeout(() => {
      pesan.value = ''
    }, DURASI_ALERT_SUKSES_MS)
  })

  return pesan
}

/** Alert pendaftaran sekali di halaman status (klien-saja) — ref pesan. */
export function useSekaliAlertPendaftaran(): Ref<string> {
  const pesan = ref('')

  onMounted(() => {
    if (sessionStorage.getItem(KUNCI_FLAG_DAFTAR) !== '1') return
    sessionStorage.removeItem(KUNCI_FLAG_DAFTAR)
    pesan.value = 'Pendaftaran berhasil diajukan.'
    if (timerHilang !== undefined) clearTimeout(timerHilang)
    timerHilang = setTimeout(() => {
      pesan.value = ''
    }, DURASI_ALERT_SUKSES_MS)
  })

  return pesan
}
