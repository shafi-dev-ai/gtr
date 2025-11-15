-- ============================================================================
-- Fix Realtime Tables for Favorites
-- Run this in Supabase SQL Editor to enable realtime for favorites tables
-- ============================================================================

-- Check current realtime publication status
SELECT 
    schemaname,
    tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- Enable realtime for listing_favorites (if not already enabled)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'listing_favorites'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE listing_favorites;
        RAISE NOTICE 'Enabled realtime for listing_favorites';
    ELSE
        RAISE NOTICE 'Realtime already enabled for listing_favorites';
    END IF;
END $$;

-- Enable realtime for event_favorites (if not already enabled)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'event_favorites'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE event_favorites;
        RAISE NOTICE 'Enabled realtime for event_favorites';
    ELSE
        RAISE NOTICE 'Realtime already enabled for event_favorites';
    END IF;
END $$;

-- Verify all realtime tables
SELECT 
    schemaname,
    tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- ============================================================================
-- Expected Output:
-- You should see listing_favorites and event_favorites in the list
-- ============================================================================

