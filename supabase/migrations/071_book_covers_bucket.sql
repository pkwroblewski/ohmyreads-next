-- ============================================
-- BOOK COVERS BUCKET
-- One server-side-verified JPEG per book, written only by the cover pipeline
-- (service role: scripts/process-covers.ts, importers, importAndAddToShelf).
-- Public read so next/image and the OG routes can fetch covers.
-- No INSERT/UPDATE/DELETE policy on purpose: the service role bypasses RLS,
-- every other role is denied.
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('book-covers', 'book-covers', true, 5242880, ARRAY['image/jpeg'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view book covers" ON storage.objects;
CREATE POLICY "Public can view book covers"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'book-covers');

SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'book-covers';
