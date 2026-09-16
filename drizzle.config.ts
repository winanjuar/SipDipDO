import { defineConfig } from 'drizzle-kit'

/**
 * drizzle-kit (pin 0.31.10) — `npm run db:generate` / `npm run db:migrate`.
 * URL pooler via env DATABASE_URL (local: Supabase CLI Docker default;
 * production: pooler Supabase ap-southeast-1 — AD-9). Fallback di bawah hanya
 * untuk dev lokal agar perintah tetap jalan tanpa env.
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './drizzle/schema.ts',
  out: './drizzle/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  },
  strict: true,
  verbose: true,
})
