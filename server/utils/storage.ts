/**
 * Supabase Storage client untuk upload dan akses file privat (AR-13).
 *
 * Bucket `mom-pdfs` dikonfigurasi sebagai private — akses hanya melalui
 * Signed URL yang di-generate server. Koneksi menggunakan Service Role Key
 * untuk bypass RLS (server-side upload).
 *
 * Constraint:
 * - Supabase URL dan Service Key wajib ada di runtimeConfig (env NUXT_SUPABASE_URL, NUXT_SUPABASE_SERVICE_KEY)
 * - Bucket harus dibuat terlebih dahulu via SQL atau Supabase Dashboard
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | undefined

/**
 * Singleton Supabase client dengan Service Role Key.
 * Service Role Key digunakan untuk operasi server-side yang bypass RLS.
 */
export function useSupabaseStorage(): SupabaseClient {
  if (_supabase) return _supabase

  const config = useRuntimeConfig()
  const url = config.supabaseUrl
  const serviceKey = config.supabaseServiceKey

  if (!url || !serviceKey) {
    throw new Error(
      'NUXT_SUPABASE_URL dan NUXT_SUPABASE_SERVICE_KEY wajib dikonfigurasi — '
      + 'isi .env dari template (AR-13).',
    )
  }

  _supabase = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return _supabase
}
