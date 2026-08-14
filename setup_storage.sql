-- SQL Script to set up the "avatars" storage bucket and its security policies.
-- Paste and run this script in your Supabase Dashboard SQL Editor (https://supabase.com/dashboard/project/wyiffaiisryrzqejzxac/sql).

-- 1. Create the public "avatars" bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create Policy: Allow public read access to avatars
DROP POLICY IF EXISTS "Allow public read access to avatars" ON storage.objects;
CREATE POLICY "Allow public read access to avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- 3. Create Policy: Allow authenticated users to upload their own avatar to their folder
DROP POLICY IF EXISTS "Allow authenticated uploads to avatars" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Create Policy: Allow authenticated users to update/replace their own avatar in their folder
DROP POLICY IF EXISTS "Allow authenticated updates to avatars" ON storage.objects;
CREATE POLICY "Allow authenticated updates to avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Create Policy: Allow authenticated users to delete their own avatar from their folder
DROP POLICY IF EXISTS "Allow authenticated deletes from avatars" ON storage.objects;
CREATE POLICY "Allow authenticated deletes from avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
