-- ============================================================================
-- FIX TRIGGER PERMISSIONS AND ERROR HANDLING
-- Run this script in Supabase SQL Editor to fix trigger permission issues
-- ============================================================================

-- Step 1: Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 2: Drop and recreate the function with proper error handling
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 3: Recreate function with error handling and proper permissions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    -- Insert profile with error handling
    INSERT INTO public.profiles (id, username, full_name, email, avatar_url, phone_number)
    VALUES (
      NEW.id,
      -- Username: NULL for now (users can set it later in profile settings)
      -- For OAuth providers, try to extract username if available
      COALESCE(
        NEW.raw_user_meta_data->>'username',
        NEW.raw_user_meta_data->>'preferred_username',
        NEW.raw_user_meta_data->>'user_name',
        NULL
      ),
      -- Full name: Extract from OAuth providers (Google, Apple, Facebook) or signup form
      COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        CASE 
          WHEN NEW.raw_user_meta_data->>'given_name' IS NOT NULL 
          THEN TRIM(COALESCE(NEW.raw_user_meta_data->>'given_name', '') || ' ' || COALESCE(NEW.raw_user_meta_data->>'family_name', ''))
          ELSE NULL
        END,
        NEW.raw_user_meta_data->>'display_name',
        NEW.app_metadata->>'full_name',
        NEW.app_metadata->>'name',
        ''
      ),
      -- Email: from auth.users.email (works for all providers)
      COALESCE(NEW.email, ''),
      -- Avatar: Extract from OAuth providers
      COALESCE(
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'picture',
        NEW.raw_user_meta_data->>'avatar',
        NEW.app_metadata->>'avatar_url',
        NEW.app_metadata->>'picture',
        NULL
      ),
      -- Phone: from meta data (if provided during signup) or auth.users.phone
      COALESCE(
        NEW.raw_user_meta_data->>'phone_number',
        NEW.phone,
        NULL
      )
    );
  EXCEPTION
    WHEN unique_violation THEN
      -- If profile already exists (shouldn't happen, but handle gracefully)
      RAISE WARNING 'Profile already exists for user %', NEW.id;
    WHEN OTHERS THEN
      -- Log error but don't fail user creation
      -- This allows users to sign up even if profile creation fails
      RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

-- Step 4: Grant execute permission to authenticated role
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Step 5: Recreate trigger with proper configuration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 6: Ensure RLS policy allows the trigger to insert profiles
-- The trigger runs as SECURITY DEFINER, so it should bypass RLS, but let's make sure
-- the policy exists and allows inserts (even though SECURITY DEFINER bypasses it)
DO $$
BEGIN
  -- Check if the insert policy exists, if not create it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users can insert their own profile'
  ) THEN
    CREATE POLICY "Users can insert their own profile" 
    ON profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Step 7: Verify the trigger was created
-- (This will show the trigger if it exists)
SELECT 
  tgname AS trigger_name,
  tgrelid::regclass AS table_name,
  tgenabled AS enabled,
  tgisinternal AS is_internal
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running this script, verify:
-- 1. The function exists: 
--    SELECT proname, prosecdef FROM pg_proc WHERE proname = 'handle_new_user';
--    (prosecdef should be 't' for SECURITY DEFINER)
-- 2. The trigger exists: 
--    SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
-- 3. Check trigger is enabled:
--    SELECT tgenabled FROM pg_trigger WHERE tgname = 'on_auth_user_created';
--    ('O' = origin, 'A' = always, 'D' = disabled)
-- 4. Try creating a test user to verify it works
-- ============================================================================

