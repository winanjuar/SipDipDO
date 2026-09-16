-- drizzle/seed-data.sql
--
-- Seed data awal agar dashboard tidak kosong saat pertama dijalankan:
--   - 1 MoM final (referensi keputusan harga & fase RKAP)
--   - Harga berjalan: beli 52.000, jual 55.000 (efektif hari ini, zona apa pun)
--   - 1 RKAP phase aktif + 3 Capital Item (Modal Tetap & Modal Bergerak)
--
-- Idempoten: aman diulang. Harga unik per (kind, effective_date); MoM/phase
-- dibuat hanya bila belum ada judul/nama yang sama.
--
-- Batas penyesuaian fase (FR-23 §23.6) = 1% × Σ Initial Requirement + harga 1 saham.
--   Σ Initial = 44.744.000 + 3.500.000 + 20.000.000 = 68.244.000
--   1% × 68.244.000 = 682.440 ; + harga 52.000 = 734.440
--
-- Jalankan via SQL Editor Supabase atau node runner.

BEGIN;

-- 1) MoM final ---------------------------------------------------------------
INSERT INTO moms (title, mom_date, status, body)
SELECT 'MRO Penetapan Awal', CURRENT_DATE, 'final',
       'Penetapan harga saham dan fase RKAP awal.'
WHERE NOT EXISTS (SELECT 1 FROM moms WHERE title = 'MRO Penetapan Awal');

-- 2) Harga berjalan (beli & jual) efektif hari ini ---------------------------
INSERT INTO price_periods (kind, price, effective_date, mom_ref)
SELECT 'beli', 52000.00, CURRENT_DATE, m.id
FROM moms m WHERE m.title = 'MRO Penetapan Awal'
ON CONFLICT ON CONSTRAINT price_periods_kind_effective_date_unique DO NOTHING;

INSERT INTO price_periods (kind, price, effective_date, mom_ref)
SELECT 'jual', 55000.00, CURRENT_DATE, m.id
FROM moms m WHERE m.title = 'MRO Penetapan Awal'
ON CONFLICT ON CONSTRAINT price_periods_kind_effective_date_unique DO NOTHING;

-- 3) RKAP phase aktif --------------------------------------------------------
INSERT INTO rkap_phases (name, instant_adjustment_budget, instant_adjustment_used, is_active, mom_ref)
SELECT 'Fase RKAP 2026', 734440.00, 0, true, m.id
FROM moms m WHERE m.title = 'MRO Penetapan Awal'
  AND NOT EXISTS (SELECT 1 FROM rkap_phases WHERE name = 'Fase RKAP 2026');

-- 4) Capital Item (Final = Initial saat penetapan, FR-23 §23.3) --------------
INSERT INTO capital_items (phase_id, name, capital_type, initial_requirement, final_requirement, fulfillment, utilization)
SELECT p.id, 'Renovasi Gerai', 'Modal Tetap', 44744000.00, 44744000.00, 0, 0
FROM rkap_phases p WHERE p.name = 'Fase RKAP 2026'
  AND NOT EXISTS (SELECT 1 FROM capital_items c WHERE c.phase_id = p.id AND c.name = 'Renovasi Gerai');

INSERT INTO capital_items (phase_id, name, capital_type, initial_requirement, final_requirement, fulfillment, utilization)
SELECT p.id, 'Peralatan Dapur', 'Modal Tetap', 3500000.00, 3500000.00, 0, 0
FROM rkap_phases p WHERE p.name = 'Fase RKAP 2026'
  AND NOT EXISTS (SELECT 1 FROM capital_items c WHERE c.phase_id = p.id AND c.name = 'Peralatan Dapur');

INSERT INTO capital_items (phase_id, name, capital_type, initial_requirement, final_requirement, fulfillment, utilization)
SELECT p.id, 'Stok Bahan Baku', 'Modal Bergerak', 20000000.00, 20000000.00, 0, 0
FROM rkap_phases p WHERE p.name = 'Fase RKAP 2026'
  AND NOT EXISTS (SELECT 1 FROM capital_items c WHERE c.phase_id = p.id AND c.name = 'Stok Bahan Baku');

COMMIT;
