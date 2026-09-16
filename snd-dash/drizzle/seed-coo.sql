-- drizzle/seed-coo.sql
--
-- Seed COO pertama agar login Google bisa dipakai.
--
-- Handler signIn (server/api/auth/[...].ts) MENOLAK email yang tidak ada di
-- tabel `owners`. Skrip ini membuat satu Owner terverifikasi + role 'coo' +
-- tenure COO aktif, sehingga akun Google dengan email berikut dapat login dan
-- langsung punya mandat COO.
--
-- Cara pakai (Supabase → SQL Editor → tempel → Run), atau via psql:
--   psql "$DATABASE_URL" -f drizzle/seed-coo.sql
--
-- Idempoten: aman dijalankan berulang (ON CONFLICT / WHERE NOT EXISTS).

BEGIN;

-- 1) Owner (email = identitas Google). Status 'terverifikasi' = akses penuh.
INSERT INTO owners (email, name, status)
VALUES ('lerzack@gmail.com', 'Lerzack (COO)', 'terverifikasi')
ON CONFLICT (email) DO UPDATE
  SET status = 'terverifikasi',
      name = COALESCE(owners.name, EXCLUDED.name),
      updated_at = now();

-- 2) Profile lengkap (prasyarat verifikasi).
INSERT INTO profiles (owner_id, is_complete, email_contact, data)
SELECT o.id, true, o.email, '{}'::jsonb
FROM owners o
WHERE o.email = 'lerzack@gmail.com'
ON CONFLICT (owner_id) DO UPDATE
  SET is_complete = true,
      updated_at = now();

-- 3) Role 'coo' (unik per owner+role).
INSERT INTO roles (owner_id, role)
SELECT o.id, 'coo'
FROM owners o
WHERE o.email = 'lerzack@gmail.com'
ON CONFLICT ON CONSTRAINT roles_owner_role_unique DO NOTHING;

-- (opsional) Role 'owner' juga, agar tampil sebagai Owner biasa selain COO.
INSERT INTO roles (owner_id, role)
SELECT o.id, 'owner'
FROM owners o
WHERE o.email = 'lerzack@gmail.com'
ON CONFLICT ON CONSTRAINT roles_owner_role_unique DO NOTHING;

-- 4) Tenure COO aktif (ended_at IS NULL = sedang menjabat). Hanya buat bila
--    belum ada tenure aktif untuk owner ini (assertCooAt cek ended_at IS NULL).
INSERT INTO coo_tenures (owner_id, started_at)
SELECT o.id, now()
FROM owners o
WHERE o.email = 'lerzack@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM coo_tenures ct
    WHERE ct.owner_id = o.id AND ct.ended_at IS NULL
  );

COMMIT;

-- Verifikasi cepat:
--   SELECT o.email, o.status, array_agg(r.role) AS roles,
--          (SELECT count(*) FROM coo_tenures ct WHERE ct.owner_id = o.id AND ct.ended_at IS NULL) AS tenure_aktif
--   FROM owners o LEFT JOIN roles r ON r.owner_id = o.id
--   WHERE o.email = 'lerzack@gmail.com'
--   GROUP BY o.id;
