-- ============================================
-- CURSOR-BASED PAGINATION FUNCTIONS
-- Run this in Supabase SQL Editor
-- ============================================

-- Cursor-based pagination function for listings
CREATE OR REPLACE FUNCTION get_listings_cursor(
  p_cursor TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 10,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_min_price NUMERIC DEFAULT NULL,
  p_max_price NUMERIC DEFAULT NULL,
  p_model TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  description TEXT,
  price NUMERIC,
  city TEXT,
  state TEXT,
  model TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  next_cursor TIMESTAMPTZ,
  has_more BOOLEAN
) AS $$
DECLARE
  v_results RECORD;
BEGIN
  RETURN QUERY
  WITH filtered_listings AS (
    SELECT *
    FROM listings
    WHERE status = 'active'
      AND (p_cursor IS NULL OR created_at < p_cursor)
      AND (p_city IS NULL OR city ILIKE '%' || p_city || '%')
      AND (p_state IS NULL OR state = p_state)
      AND (p_min_price IS NULL OR price >= p_min_price)
      AND (p_max_price IS NULL OR price <= p_max_price)
      AND (p_model IS NULL OR model = p_model)
    ORDER BY created_at DESC
    LIMIT p_limit + 1  -- Fetch one extra to check if there's more
  ),
  results AS (
    SELECT * FROM filtered_listings LIMIT p_limit
  )
  SELECT 
    r.id,
    r.user_id,
    r.title,
    r.description,
    r.price,
    r.city,
    r.state,
    r.model,
    r.status,
    r.created_at,
    (SELECT created_at FROM filtered_listings OFFSET p_limit LIMIT 1) as next_cursor,
    (SELECT COUNT(*) > p_limit FROM filtered_listings) as has_more
  FROM results r
  ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_listings_cursor TO authenticated;
GRANT EXECUTE ON FUNCTION get_listings_cursor TO anon;

-- Cursor-based pagination for forum posts
CREATE OR REPLACE FUNCTION get_forum_posts_cursor(
  p_cursor TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 10,
  p_model TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  content TEXT,
  model TEXT,
  created_at TIMESTAMPTZ,
  next_cursor TIMESTAMPTZ,
  has_more BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_posts AS (
    SELECT *
    FROM forum_posts
    WHERE (p_cursor IS NULL OR created_at < p_cursor)
      AND (p_model IS NULL OR model = p_model)
    ORDER BY created_at DESC
    LIMIT p_limit + 1
  ),
  results AS (
    SELECT * FROM filtered_posts LIMIT p_limit
  )
  SELECT 
    r.id,
    r.user_id,
    r.title,
    r.content,
    r.model,
    r.created_at,
    (SELECT created_at FROM filtered_posts OFFSET p_limit LIMIT 1) as next_cursor,
    (SELECT COUNT(*) > p_limit FROM filtered_posts) as has_more
  FROM results r
  ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_forum_posts_cursor TO authenticated;
GRANT EXECUTE ON FUNCTION get_forum_posts_cursor TO anon;

-- Cursor-based pagination for events
CREATE OR REPLACE FUNCTION get_events_cursor(
  p_cursor TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 10,
  p_location TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  created_by UUID,
  title TEXT,
  description TEXT,
  location TEXT,
  start_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  next_cursor TIMESTAMPTZ,
  has_more BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH filtered_events AS (
    SELECT *
    FROM events
    WHERE start_date >= NOW()
      AND (p_cursor IS NULL OR start_date > p_cursor)
      AND (p_location IS NULL OR location ILIKE '%' || p_location || '%')
    ORDER BY start_date ASC
    LIMIT p_limit + 1
  ),
  results AS (
    SELECT * FROM filtered_events LIMIT p_limit
  )
  SELECT 
    r.id,
    r.created_by,
    r.title,
    r.description,
    r.location,
    r.start_date,
    r.created_at,
    (SELECT start_date FROM filtered_events OFFSET p_limit LIMIT 1) as next_cursor,
    (SELECT COUNT(*) > p_limit FROM filtered_events) as has_more
  FROM results r
  ORDER BY r.start_date ASC;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_events_cursor TO authenticated;
GRANT EXECUTE ON FUNCTION get_events_cursor TO anon;

