/**
 * useSekaliToastMasuk — toast "Masuk berhasil." TEPAT SEKALI di halaman
 * landing pasca-login (permintaan owner 2026-09-18: toast harus terbaca di
 * halaman berikutnya, bukan halaman yang tertimpa redirect).
 *
 * Mekanisme: halaman login menandai `sessionStorage` sebelum signIn (flag
 * selamat melewati redirect OAuth satu tab); halaman landing pertama
 * membaca, menampilkan toast berdurasi panjang, lalu MENGHAPUS flag —
 * refresh/tab lain tidak mengulang konfirmasi.
 *
 * Dipakai: dashboard, personal, antrian-beli, status-pendaftaran.
 * Halaman status memprioritaskan toast daftar (flag `?daftar=berhasil`)
 * bila keduanya hadir — "Masuk berhasil." dilewati.
 */

import { toast } from 'vue-sonner'

/** Durasi toast sukses (ms) — cukup terbaca sebelum menghilang. */
export const DURASI_TOAST_SUKSES_MS = 8_000

/** Kunci flag sessionStorage — kontrak dipakai juga test E2E. */
const KUNCI_FLAG_MASUK = 'snd-dash.toast-masuk-berhasil'

/** Tandai sesi ini baru saja login sukses — dipanggil halaman login. */
export function tandaiMasukBerhasil(): void {
  sessionStorage.setItem(KUNCI_FLAG_MASUK, '1')
}

/** Tampilkan toast masuk sekali di landing pertama (klien-saja). */
export function useSekaliToastMasuk(): void {
  const route = useRoute()
  onMounted(() => {
    if (sessionStorage.getItem(KUNCI_FLAG_MASUK) !== '1') return
    sessionStorage.removeItem(KUNCI_FLAG_MASUK)
    // Halaman status dengan toast daftar menang — jangan ditimpa dua toast.
    if (route.query.daftar !== undefined) return
    toast.success('Masuk berhasil.', { duration: DURASI_TOAST_SUKSES_MS })
  })
}
