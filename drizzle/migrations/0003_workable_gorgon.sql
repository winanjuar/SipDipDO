ALTER TABLE "owners" ADD COLUMN "referral_code" text;--> statement-breakpoint
ALTER TABLE "owners" ADD COLUMN "used_referral_code" text;--> statement-breakpoint
-- Backfill kode referral baris existing (Story 1.4): alfanumerik 8 karakter
-- deterministik-unik per baris dari md5(id) — heksadesimal lowercase (0-9a-f)
-- adalah subset alfanumerik (menerima lowercase, keputusan owner 2026-09-18).
-- Baris baru menyusul dari generator repo (buatKodeReferral), bukan dari SQL ini.
UPDATE "owners" SET "referral_code" = substr(md5("id"::text), 1, 8) WHERE "referral_code" IS NULL;--> statement-breakpoint
ALTER TABLE "owners" ALTER COLUMN "referral_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "owners" ADD CONSTRAINT "owners_referral_code_unique" UNIQUE("referral_code");
