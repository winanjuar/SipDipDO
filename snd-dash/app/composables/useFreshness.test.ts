// app/composables/useFreshness.test.ts
//
// Unit test composable useFreshness (task 19.1, AD-12). Fokus: angka basi TIDAK
// PERNAH ditampilkan — saat fetch gagal, `data` dikosongkan dan pesan "Tidak
// dapat memuat data" + aksi retry tersedia.

import { describe, it, expect, vi } from 'vitest'
import { nextTick } from 'vue'
import { useFreshness, PESAN_GAGAL_MUAT } from './useFreshness'

// Bantu menunggu microtask fetch selesai.
const flush = async () => {
  await Promise.resolve()
  await nextTick()
}

describe('useFreshness (AD-12)', () => {
  it('sukses: status fresh + data terisi', async () => {
    const f = useFreshness(async () => ({ n: 42 }))
    expect(f.isLoading.value).toBe(true)
    await flush()
    expect(f.isFresh.value).toBe(true)
    expect(f.data.value).toEqual({ n: 42 })
    expect(f.errorMessage.value).toBeNull()
  })

  it('gagal: data dikosongkan (tidak basi) + pesan + status error', async () => {
    const f = useFreshness(async () => {
      throw new Error('network down')
    })
    await flush()
    expect(f.isError.value).toBe(true)
    expect(f.data.value).toBeNull()
    expect(f.errorMessage.value).toBe(PESAN_GAGAL_MUAT)
  })

  it('retry: gagal lalu berhasil → data segar, error hilang', async () => {
    const fetcher = vi
      .fn<() => Promise<{ v: string }>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ v: 'ok' })

    const f = useFreshness(fetcher)
    await flush()
    expect(f.isError.value).toBe(true)
    expect(f.data.value).toBeNull()

    await f.retry()
    expect(f.isFresh.value).toBe(true)
    expect(f.data.value).toEqual({ v: 'ok' })
    expect(f.errorMessage.value).toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('sukses lalu gagal saat refresh → data lama TIDAK dipertahankan (AD-12)', async () => {
    const fetcher = vi
      .fn<() => Promise<{ v: number }>>()
      .mockResolvedValueOnce({ v: 1 })
      .mockRejectedValueOnce(new Error('lost'))

    const f = useFreshness(fetcher)
    await flush()
    expect(f.data.value).toEqual({ v: 1 })

    await f.refresh()
    expect(f.isError.value).toBe(true)
    expect(f.data.value).toBeNull() // angka basi tidak boleh tampil
  })

  it('immediate=false: tidak fetch sampai refresh dipanggil', async () => {
    const fetcher = vi.fn(async () => ({ v: 9 }))
    const f = useFreshness(fetcher, { immediate: false })
    expect(f.status.value).toBe('idle')
    expect(fetcher).not.toHaveBeenCalled()
    await f.refresh()
    expect(f.isFresh.value).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
