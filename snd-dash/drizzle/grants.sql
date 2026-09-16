-- drizzle/grants.sql
--
-- Append-only grant untuk audit_logs (AD-3).
--
-- Referensi:
--   - design.md → Security Considerations: "Audit append-only via DB grants
--     (tanpa UPDATE/DELETE) (AD-3)."
--   - Task 4.2: "grant append-only untuk audit_logs (tanpa UPDATE/DELETE)".
--
-- audit_logs adalah tabel append-only: setiap modul MENULIS (INSERT) dan COO
-- MEMBACA (SELECT), tetapi entri TIDAK PERNAH boleh diubah (UPDATE) atau dihapus
-- (DELETE) oleh peran aplikasi. Larangan ini ditegakkan di lapisan database via
-- GRANT/REVOKE sehingga bug/penyalahgunaan di lapisan aplikasi pun tidak dapat
-- memutilasi jejak audit.
--
-- Cara pakai:
--   1. Jalankan migrasi skema lebih dulu (drizzle-kit migrate) agar tabel
--      audit_logs sudah ada.
--   2. Ganti :app_role dengan nama role aplikasi runtime (mis. role yang dipakai
--      DATABASE_URL / user Supabase runtime), lalu jalankan skrip ini sekali.
--
--   psql "$DATABASE_URL" -v app_role=app_runtime -f drizzle/grants.sql
--
-- Catatan: pemilik tabel/superuser tetap dapat memaksa perubahan; role runtime
-- aplikasi HARUS bukan pemilik tabel agar REVOKE di bawah efektif.

BEGIN;

-- Cabut hak default terlebih dulu (jaga-jaga bila pernah diberikan).
REVOKE ALL PRIVILEGES ON TABLE audit_logs FROM :app_role;

-- Append-only: hanya boleh menambah (INSERT) dan membaca (SELECT).
GRANT SELECT, INSERT ON TABLE audit_logs TO :app_role;

-- Tegaskan larangan mutasi/penghapusan baris audit.
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_logs FROM :app_role;

COMMIT;
