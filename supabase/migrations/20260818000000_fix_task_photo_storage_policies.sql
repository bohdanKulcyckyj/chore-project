-- Fix task-completion-photos storage policies.
--
-- The original policies (20250817132539) were wrong in two ways:
--   1. DELETE checked `(storage.foldername(name))[4] = auth.uid()`, commented as "4th folder level
--      is user_id". The real path is `householdId/taskId/completionId/file` — three folder levels,
--      no user_id segment. The predicate could never match, so nobody could ever delete a photo.
--   2. INSERT/SELECT only checked `bucket_id`, so any authenticated user could upload into, or read,
--      another household's folder.
--
-- Path convention: householdId/taskId/completionId/file -> first folder is household_id,
-- matching the `receipts` bucket policies.

DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow completion owner to delete photos" ON storage.objects;

CREATE POLICY "Household members can upload task photos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'task-completion-photos'
  AND is_household_member(((storage.foldername(name))[1])::uuid)
);

-- NOTE: the bucket is still `public: true`, and the app stores getPublicUrl() results in
-- task_completions.proof_urls and renders them in <img src>. Public reads bypass RLS, so this
-- SELECT policy only governs authenticated API reads — anyone holding a photo URL can still fetch it.
-- Making the bucket private requires switching those <img> sources to createSignedUrl (as `receipts`
-- already does in src/lib/api/purchases.ts) — otherwise every proof photo 404s.
CREATE POLICY "Household members can view task photos" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'task-completion-photos'
  AND is_household_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Household members can delete task photos" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'task-completion-photos'
  AND is_household_member(((storage.foldername(name))[1])::uuid)
);
