-- drizzle/runtime-role.sql
--
-- Membuat ROLE RUNTIME terbatas untuk aplikasi (dipakai di DATABASE_URL runtime),
-- terpisah dari superuser `postgres` yang dipakai untuk migrasi/admin.
--
-- Kenapa: grant append-only audit_logs (AD-3) TIDAK efektif terhadap superuser.
-- Aplikasi harus login sebagai role NON-superuser & NON-owner tabel agar REVOKE
-- UPDATE/DELETE pada audit_logs benar-benar mengikat.
--
-- Jalankan sebagai `postgres` (Supabase → SQL Editor → Run), SATU KALI.
-- GANTI password di bawah dengan password kuat milikmu.

-- 1) Buat role login. Ganti 'GANTI_PASSWORD_KUAT' dengan password rahasia.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime LOGIN PASSWORD 'GANTI_PASSWORD_KUAT';
  END IF;
END
$$;

-- 2) Izin dasar akses schema public.
GRANT USAGE ON SCHEMA public TO app_runtime;

-- 3) Hak DML penuh pada SEMUA tabel yang ada (data biasa perlu SELECT/INSERT/UPDATE/DELETE).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;

-- 4) Sequence (bila ada) untuk default/serial.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;

-- 5) Default privileges: tabel/sequence yang DIBUAT NANTI oleh `postgres`
--    otomatis memberi hak ke app_runtime (supaya migrasi berikutnya tidak
--    mengunci akses runtime).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_runtime;

-- 6) AUDIT append-only (AD-3): cabut mutasi, sisakan INSERT + SELECT saja.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_logs FROM app_runtime;
-- (SELECT + INSERT sudah diberikan di langkah 3; pastikan tetap ada.)
GRANT SELECT, INSERT ON TABLE audit_logs TO app_runtime;

-- Verifikasi hak audit_logs untuk app_runtime:
--   SELECT privilege_type FROM information_schema.role_table_grants
--   WHERE grantee = 'app_runtime' AND table_name = 'audit_logs';
--   -> harus hanya INSERT dan SELECT.

-- Setelah ini, ganti DATABASE_URL runtime memakai user app_runtime, mis:
--   postgresql://app_runtime.<project-ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres
-- (via pooler, username = 'app_runtime.<project-ref>').
