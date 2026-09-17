-- drizzle/grants.sql
--
-- Grants aplikasi untuk role runtime `app_runtime` (keputusan spec 1.3,
-- 2026-09-17) — termasuk penegakan append-only `audit_logs` (AD-3) PENUH di DB:
-- aplikasi hanya boleh INSERT + SELECT baris audit; UPDATE/DELETE/TRUNCATE
-- tidak pernah diberikan sehingga bug/penyalahgunaan lapisan aplikasi pun
-- tidak dapat memutilasi jejak audit. Efektif karena koneksi runtime bukan
-- superuser (lihat drizzle/runtime-role.sql).
--
-- Jalankan SETELAH setiap migrasi yang membuat tabel baru (tabel hasil migrasi
-- baru belum bergrants):
--   lokal:
--     docker exec -i supabase_db_snd-dash psql -U postgres -d postgres \
--       < drizzle/grants.sql
--   produksi: Supabase → SQL Editor → Run.
--
-- Verifikasi hak audit_logs (harus hanya INSERT dan SELECT):
--   SELECT privilege_type FROM information_schema.role_table_grants
--   WHERE grantee = 'app_runtime' AND table_name = 'audit_logs';
-- Uji append-only (harus ERROR permission denied):
--   SET ROLE app_runtime; UPDATE audit_logs SET action = 'x';

BEGIN;

-- Mulai dari nol agar grants tepat = daftar di bawah (tidak ada sisa hak lama).
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM app_runtime;

-- Aplikasi membaca dan menulis data biasa (identity/outbox dst).
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_runtime;

-- GUID default (gen_random_uuid) tidak memakai sequence; grant ini noop aman.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;

-- AUDIT append-only (AD-3): hanya INSERT + SELECT — tanpa UPDATE/DELETE/TRUNCATE.
GRANT SELECT, INSERT ON TABLE audit_logs TO app_runtime;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_logs FROM app_runtime;

COMMIT;
