/**
 * useSekaliAlertMasuk — alert "Masuk berhasil." TEPAT SEKALI di halaman
 * landing pasca-login (permintaan owner 2026-09-18, direvisi 2026-09-18:
 * toast diganti ALERT di BAGIAN ATAS halaman — toast bawah tak terlihat —
 * auto-hilang 3 detik).
 *
 * Mekanisme: halaman login menandai `sessionStorage` sebelum signIn (flag
 * selamat melewati redirect OAuth satu tab); halaman landing pertama
 * membaca, menampilkan alert, lalu MENGHAPUS flag — refresh/tab lain tidak
 * mengulang konfirmasi.
 *
 * Dipakai: dashboard, personal, antrian-beli, status-pendaftaran.
 * Halaman status memprioritaskan alert daftar (flag `?daftar=berhasil`)
 * bila keduanya hadir — "Masuk berhasil." dilewati.
 *
 * Return: ref pesan (string kosong = tersembunyi) — render sebagai
 * <Alert variant="success"> di atas halaman, aria-live="polite".
 */

/** Durasi alert sukses (ms) — otomatis hilang. */
export const DURASI_ALERT_SUKSES_MS = 3_000

/** Kunci flag sessionStorage — kontrak dipakai juga test E2E. */
const KUNCI_FLAG_MASUK = 'snd-dash.alert-masuk-berhasil'

/** Tandai sesi ini baru saja login sukses — dipanggil halaman login. */
export function tandaiMasukBerhasil(): void {
  sessionStorage.setItem(KUNCI_FLAG_MASUK, '1')
}

/** Sembunyikan pesan setelah durasi — timer dibatalkan bila berganti. */
let timerHilang: ReturnType<typeof setTimeout> | undefined

/** Alert masuk sekali di landing pertama (klien-saja) — return ref pesan. */
export function useSekaliAlertMasuk(): Ref<string> {
  const route = useRoute()
  const pesan = ref('')

  onMounted(() => {
    if (sessionStorage.getItem(KUNCI_FLAG_MASUK) !== '1') return
    sessionStorage.removeItem(KUNCI_FLAG_MASUK)
    // Halaman status dengan alert daftar menang — jangan dua alert bertumpuk.
    if (route.query.daftar !== undefined) return
    pesan.value = 'Masuk berhasil.'
    if (timerHilang !== undefined) clearTimeout(timerHilang)
    timerHilang = setTimeout(() => {
      pesan.value = ''
    }, DURASI_ALERT_SUKSES_MS)
  })

  return pesan
}
