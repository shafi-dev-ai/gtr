-- ============================================================================
-- Create User Stats Function for Profile Screen
-- This returns all user stats in a single query for better performance
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  stats JSON;
BEGIN
  SELECT json_build_object(
    'listings_count', (
      SELECT COUNT(*) 
      FROM listings 
      WHERE user_id = p_user_id AND status = 'active'
    ),
    'events_count', (
      SELECT COUNT(*) 
      FROM events 
      WHERE created_by = p_user_id
    ),
    'posts_count', (
      SELECT COUNT(*) 
      FROM forum_posts 
      WHERE user_id = p_user_id
    ),
    'garage_count', (
      SELECT COUNT(*) 
      FROM user_garage 
      WHERE user_id = p_user_id
    ),
    'liked_listings_count', (
      SELECT COALESCE(favorite_listings_count, 0)
      FROM profiles 
      WHERE id = p_user_id
    ),
    'liked_events_count', (
      SELECT COALESCE(favorite_events_count, 0)
      FROM profiles 
      WHERE id = p_user_id
    )
  ) INTO stats;
  
  RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_stats TO anon;

-- ============================================================================
-- Setup Complete!
-- ============================================================================

