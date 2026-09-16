// server/api/auth/[...].ts
//
// Catch-all NuxtAuth (sidebase, provider `authjs`/next-auth@4) — Google OAuth
// (design.md Security: "Autentikasi NuxtAuth (Google OAuth), dicocokkan email
// saat migrasi (AD-8)"; FR-22 §22.11: "mengautentikasi seluruh akun (Owner
// eksisting & COO) memakai akun Google, dicocokkan lewat email saat migrasi").
//
// Prinsip yang ditegakkan di sini:
//   - Identitas ditautkan lewat EMAIL (AD-8/§22.11): email Google terverifikasi
//     dicocokkan ke `owners.email` (identity door `findByEmail`). Sesi membawa
//     `ownerId` + status siklus hidup sehingga guard akses (server/utils/access)
//     dapat membangun `Principal` tanpa lookup email ulang.
//   - Rahasia TIDAK di-hardcode: client id/secret + AUTH secret dibaca dari
//     `runtimeConfig` (di-back oleh env `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
//     `NUXT_AUTH_SECRET`) — lihat nuxt.config.ts.
//   - Sesi JWT-only (tanpa tabel adapter): identitas domain hidup di `owners`,
//     bukan di tabel sesi NextAuth. Callback `jwt`/`session` menautkan email→owner.
//
// Fallback (design.md): bila smoke-test NuxtAuth gagal, beralih ke
// `nuxt-auth-utils` / OAuth manual. Task ini mengimplementasikan jalur PRIMER.

import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import type { AuthOptions } from 'next-auth'
import { NuxtAuthHandler } from '#auth'
import { db } from '../../utils/db'
import * as identityRepo from '../../domain/identity/identity.repo'

// runtimeConfig di-inject dari nuxt.config.ts (di-back env, tanpa secret literal).
const runtimeConfig = useRuntimeConfig()

/** Membaca env tanpa bergantung pada @types/node (pola sama dengan db.ts/session.ts). */
function readEnv(key: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return proc?.env?.[key]
}

// Provider dev-only: aktif HANYA bila bukan produksi. Memungkinkan login dengan
// email saja (tanpa password, tanpa Google) untuk pengetesan lokal sebelum
// kredensial Google OAuth disiapkan. Email tetap dicocokkan ke `owners` (AD-8),
// jadi hanya email yang sudah di-seed (mis. COO) yang bisa masuk.
const isProduction = readEnv('NODE_ENV') === 'production'

// Provider Google hanya dipasang bila kredensialnya terisi (menghindari error
// "client_id is required" saat env masih kosong).
const googleConfigured =
  !!runtimeConfig.google.clientId && !!runtimeConfig.google.clientSecret

const providers: AuthOptions['providers'] = []

if (googleConfigured) {
  providers.push(
    // @ts-expect-error — interop default export next-auth v4 (CJS/ESM) di Nitro.
    GoogleProvider.default({
      clientId: runtimeConfig.google.clientId,
      clientSecret: runtimeConfig.google.clientSecret,
    }),
  )
}

if (!isProduction) {
  providers.push(
    // @ts-expect-error — interop default export next-auth v4 (CJS/ESM) di Nitro.
    CredentialsProvider.default({
      id: 'dev-email',
      name: 'Dev Email (tanpa Google)',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'lerzack@gmail.com' },
      },
      async authorize(credentials: Record<string, string> | undefined) {
        const email = credentials?.email
        if (!email) return null
        // Cocokkan ke owners (AD-8) — hanya email ter-seed yang boleh masuk.
        const owner = await identityRepo.findByEmail(db, email)
        if (!owner) return null
        return { id: owner.id, email: owner.email, name: owner.name ?? owner.email }
      },
    }),
  )
}

/**
 * Konfigurasi NextAuth (v4) untuk provider Google.
 *
 * `secret` dan kredensial OAuth berasal dari runtimeConfig (env). `session.strategy`
 * = 'jwt' agar tak butuh adapter DB; penautan ke Owner dilakukan di callback.
 */
export const authOptions: AuthOptions = {
  secret: runtimeConfig.authSecret,
  session: {
    strategy: 'jwt',
  },
  providers,
  callbacks: {
    /**
     * Gerbang sign-in (AD-8/§22.11): hanya izinkan email Google yang cocok dengan
     * `owners.email`. Email yang tak terdaftar (Owner/COO belum dimigrasi/didaftar)
     * ditolak — jalur pendaftaran mandiri (FR-22) menangani penambahan Owner baru.
     *
     * Catatan: pendaftaran mandiri Calon Owner (submitRegistration) membuat baris
     * Owner lebih dulu; di sini kita hanya mengizinkan login bila baris Owner ada.
     */
    async signIn({ user }) {
      const email = user?.email
      if (!email) return false
      const owner = await identityRepo.findByEmail(db, email)
      return owner !== null
    },

    /**
     * Menautkan token JWT ke identitas domain (AD-8): resolve `ownerId` + status
     * dari `owners` berdasar email Google. Dilakukan sekali saat token dibuat
     * (saat `user` tersedia) dan disegarkan defensif bila `ownerId` belum ada.
     */
    async jwt({ token, user }) {
      // Saat login pertama (`user` tersedia), simpan email ke token. Untuk
      // CredentialsProvider (dev-email), `token.email` tidak otomatis terisi —
      // tanpa ini getToken() server tidak menemukan email (menyebabkan 401).
      if (user?.email) {
        token.email = user.email
      }
      if (token.email && !token.ownerId) {
        const owner = await identityRepo.findByEmail(db, token.email)
        if (owner) {
          token.ownerId = owner.id
          token.status = owner.status
        }
      }
      return token
    },

    /**
     * Mengekspos `ownerId` + status pada sesi klien/handler. Guard akses server
     * (server/utils/access) memakai `ownerId` untuk membangun `Principal` — bukan
     * mengandalkan email di klien (AD-8: akses server-otoritatif).
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.ownerId = token.ownerId
        session.user.status = token.status
      }
      return session
    },
  },
}

export default NuxtAuthHandler(authOptions)
