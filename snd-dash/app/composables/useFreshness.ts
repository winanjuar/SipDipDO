// app/composables/useFreshness.ts
//
// AD-12 (kesegaran data): seluruh data domain selalu daring — ANGKA BASI TIDAK
// PERNAH DITAMPILKAN. Saat fetch data domain gagal (jaringan/DB), UI menampilkan
// "Tidak dapat memuat data" + tombol "Coba lagi" alih-alih menampilkan nilai lama.
//
// Composable ini membungkus sebuah fungsi fetch async dan mengekspos status
// segar/gagal beserta aksi retry. KETIKA gagal, `data` sengaja DIKOSONGKAN
// (di-null-kan) agar pemanggil tidak mungkin merender angka basi (Error Handling
// design.md: "Fetch data domain gagal → angka basi tidak pernah ditampilkan").

import { ref, shallowRef, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'

/** Pesan gagal muat kanonik (Bahasa Indonesia) — design.md Error Handling. */
export const PESAN_GAGAL_MUAT = 'Tidak dapat memuat data'

export type FreshnessStatus = 'idle' | 'loading' | 'fresh' | 'error'

export interface UseFreshnessOptions {
  /** Jalankan fetch segera saat composable dipakai (default: true). */
  immediate?: boolean
}

export interface UseFreshnessResult<T> {
  /** Data segar terakhir; DI-NULL-kan saat gagal (tidak pernah basi). */
  data: Ref<T | null>
  status: Ref<FreshnessStatus>
  /** Pesan kesalahan yang bisa ditampilkan ('Tidak dapat memuat data'). */
  errorMessage: Ref<string | null>
  isLoading: ComputedRef<boolean>
  isError: ComputedRef<boolean>
  /** true bila data segar & aman ditampilkan. */
  isFresh: ComputedRef<boolean>
  /** Jalankan/ulangi fetch. Dipakai oleh tombol "Coba lagi". */
  refresh: () => Promise<void>
  /** Alias `refresh` untuk kejelasan pada handler tombol retry. */
  retry: () => Promise<void>
}

/**
 * Bungkus fungsi fetch data domain dengan jaminan kesegaran (AD-12).
 *
 * @param fetcher fungsi async yang mengembalikan data domain segar.
 * @param options `immediate` untuk fetch otomatis saat inisialisasi.
 *
 * Kontrak kesegaran:
 * - Saat memuat: `status='loading'`.
 * - Saat sukses: `status='fresh'`, `data` = hasil, `errorMessage=null`.
 * - Saat gagal: `status='error'`, `data=null` (BUKAN nilai lama),
 *   `errorMessage='Tidak dapat memuat data'`. Pemanggil merender pesan + retry.
 */
export function useFreshness<T>(
  fetcher: () => Promise<T>,
  options: UseFreshnessOptions = {},
): UseFreshnessResult<T> {
  const { immediate = true } = options

  const data = shallowRef<T | null>(null)
  const status = ref<FreshnessStatus>('idle')
  const errorMessage = ref<string | null>(null)

  const isLoading = computed(() => status.value === 'loading')
  const isError = computed(() => status.value === 'error')
  const isFresh = computed(() => status.value === 'fresh')

  async function refresh(): Promise<void> {
    status.value = 'loading'
    errorMessage.value = null
    try {
      const result = await fetcher()
      data.value = result
      status.value = 'fresh'
    } catch {
      // AD-12: jangan pernah biarkan angka basi tampil — kosongkan data.
      data.value = null
      status.value = 'error'
      errorMessage.value = PESAN_GAGAL_MUAT
    }
  }

  if (immediate) {
    // Sengaja tidak di-await: pemanggil mereaktif ke `status`/`data`.
    void refresh()
  }

  return {
    data,
    status,
    errorMessage,
    isLoading,
    isError,
    isFresh,
    refresh,
    retry: refresh,
  }
}
