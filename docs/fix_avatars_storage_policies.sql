-- ============================================================================
-- Fix Avatars Storage Bucket RLS Policies
-- ============================================================================
-- This script ensures proper RLS policies for the avatars bucket
-- The policies allow users to upload/update/delete files in their own folder
-- ============================================================================

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;

-- Policy 1: Allow authenticated users to upload avatars to their own folder
-- File path must be: {user_id}/filename.jpg
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Allow users to update their own avatars
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 3: Allow users to delete their own avatars
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Allow public read access to avatars
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- ============================================================================
-- Verification
-- ============================================================================
-- After running this script, verify the policies exist:
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%avatar%';
-- ============================================================================

