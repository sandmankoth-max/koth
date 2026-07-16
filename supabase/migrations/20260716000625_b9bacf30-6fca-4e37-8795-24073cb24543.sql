-- Replace the broad "any authenticated user can read every avatar" policy with
-- a folder-owner scoped one. Cross-user avatar reads now go through a server
-- function that signs URLs with the service role.
DROP POLICY IF EXISTS "koth-avatars readable by auth" ON storage.objects;

CREATE POLICY "koth-avatars owner read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'koth-avatars'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );