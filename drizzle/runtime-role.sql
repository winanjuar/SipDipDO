-- drizzle/runtime-role.sql
--
-- Role runtime non-superuser `app_runtime` (keputusan spec 1.3, 2026-09-17):
-- koneksi aplikasi (NUXT_DATABASE_URL, dev & produksi) memakai role INI —
-- bukan superuser — supaya grants append-only `audit_logs` (AD-3) di
-- drizzle/grants.sql benar-benar mengikat: REVOKE tidak pernah mengikat
-- superuser/pemilik tabel.
--
-- Jalankan sebagai admin, SATU KALI per database:
--   lokal (Supabase CLI Docker):
--     docker exec -i supabase_db_snd-dash psql -U postgres -d postgres \
--       < drizzle/runtime-role.sql
--   produksi (Supabase → SQL Editor → Run, sebagai postgres).
--
-- PASSWORD: nilai 'app_runtime' di bawah adalah default DEV-ONLY (setara
-- konvensi postgres:postgres lokal — bukan rahasia). SEBELUM produksi:
--   ALTER ROLE app_runtime PASSWORD '<password-kuat>';
-- dan jangan pernah menulis password produksi di repo — hanya via env.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime LOGIN PASSWORD 'app_runtime'
      NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

-- Izin dasar akses schema public (tabel aplikasi semuanya di sini).
GRANT USAGE ON SCHEMA public TO app_runtime;

-- Keanggotaan untuk admin `postgres` — Supabase (lokal & hosted) tidak
-- memberikan superuser sejati kepada `postgres`, sehingga verifikasi
-- `SET ROLE app_runtime; UPDATE audit_logs ...` butuh membership ini
-- (harusnya ERROR permission denied pada UPDATE-nya).
GRANT app_runtime TO postgres;

-- Hak DML tabel aplikasi diatur drizzle/grants.sql (dijalankan SETELAH setiap
-- migrasi yang membuat tabel baru) — satu sumber grants, mudah diaudit.
