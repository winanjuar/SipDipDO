-- drizzle/storage-bucket.sql
--
-- Supabase Storage bucket configuration for MoM PDF files (AR-13, Req-1, Req-2).
-- Bucket `mom-pdfs` is PRIVATE — access only through server-generated Signed URLs
-- with 15-minute expiry; no public URL exposure.
--
-- This script configures the storage bucket using Supabase's storage API tables.
-- Supabase Storage buckets are managed via the `storage.buckets` table.
--
-- Jalankan SEKALI saat setup proyek atau setelah reset database:
--   lokal:
--     docker exec -i supabase_db_snd-dash psql -U postgres -d postgres \
--       < drizzle/storage-bucket.sql
--   produksi: Supabase → SQL Editor → Run.
--
-- Verifikasi bucket terbuat:
--   SELECT * FROM storage.buckets WHERE id = 'mom-pdfs';
-- Verifikasi bucket privat (public = false):
--   SELECT id, public FROM storage.buckets WHERE id = 'mom-pdfs';
--
-- MANUAL ALTERNATIVE (Supabase Dashboard):
--   1. Go to Storage section in Supabase Dashboard
--   2. Click "New bucket"
--   3. Name: mom-pdfs
--   4. Public bucket: OFF (unchecked)
--   5. File size limit: 10485760 (10MB in bytes)
--   6. Allowed MIME types: application/pdf
--   7. Click "Create bucket"

BEGIN;

-- Create the storage bucket for MoM PDFs if it doesn't exist.
-- Configuration:
--   - id: 'mom-pdfs' (bucket name used in upload/download paths)
--   - name: 'mom-pdfs' (display name)
--   - public: false (PRIVATE — AR-13: access only through Signed URLs)
--   - file_size_limit: 10485760 (10MB in bytes — Req-1 AC6)
--   - allowed_mime_types: ['application/pdf'] (Req-1 AC6: validate PDF MIME type)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mom-pdfs',
  'mom-pdfs',
  false,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMIT;

-- =============================================================================
-- RLS (Row Level Security) Policies for storage.objects
-- =============================================================================
-- Since the bucket is private, we rely on server-side Signed URLs for access.
-- No RLS policies are needed for direct client access — all access goes through
-- server API routes that generate Signed URLs after authentication check.
--
-- If you need RLS policies for service_role access (server-side operations),
-- they are typically already enabled by default for service_role in Supabase.
--
-- The following policies are optional and provided for reference:
-- =============================================================================

-- Policy for server-side upload (service_role can INSERT)
-- This is typically already allowed for service_role, but explicit for clarity.
-- Uncomment if needed:
--
-- CREATE POLICY "Server can upload MoM PDFs"
-- ON storage.objects FOR INSERT
-- TO service_role
-- WITH CHECK (bucket_id = 'mom-pdfs');

-- Policy for server-side read (service_role can SELECT for Signed URL generation)
-- This is typically already allowed for service_role, but explicit for clarity.
-- Uncomment if needed:
--
-- CREATE POLICY "Server can read MoM PDFs"
-- ON storage.objects FOR SELECT
-- TO service_role
-- USING (bucket_id = 'mom-pdfs');

-- Policy for server-side delete (service_role can DELETE when MoM draft is deleted)
-- This is typically already allowed for service_role, but explicit for clarity.
-- Uncomment if needed:
--
-- CREATE POLICY "Server can delete MoM PDFs"
-- ON storage.objects FOR DELETE
-- TO service_role
-- USING (bucket_id = 'mom-pdfs');
