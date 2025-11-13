-- ============================================================================
-- Add Event Favorites Table and Integration
-- This adds the ability for users to favorite/save events
-- ============================================================================

-- 1. Add favorite_count to profiles table (if not already exists from listing favorites)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS favorite_events_count INTEGER DEFAULT 0;

-- 2. Create Event Favorites Table
CREATE TABLE IF NOT EXISTS event_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- 3. Create Indexes
CREATE INDEX IF NOT EXISTS idx_event_favorites_event_id ON event_favorites(event_id);
CREATE INDEX IF NOT EXISTS idx_event_favorites_user_id ON event_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_event_favorites_created_at ON event_favorites(created_at DESC);

-- 4. Enable RLS
ALTER TABLE event_favorites ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
CREATE POLICY "Event favorites are viewable by everyone" 
  ON event_favorites FOR SELECT USING (true);

CREATE POLICY "Authenticated users can favorite events" 
  ON event_favorites FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unfavorite their own favorites" 
  ON event_favorites FOR DELETE 
  USING (auth.uid() = user_id);

-- 6. Function: Update user's favorite events count
CREATE OR REPLACE FUNCTION update_user_favorite_events_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles 
    SET favorite_events_count = favorite_events_count + 1 
    WHERE id = NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles 
    SET favorite_events_count = GREATEST(favorite_events_count - 1, 0)
    WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 7. Triggers
CREATE TRIGGER update_user_favorite_events_count_on_insert 
  AFTER INSERT ON event_favorites 
  FOR EACH ROW 
  EXECUTE FUNCTION update_user_favorite_events_count();

CREATE TRIGGER update_user_favorite_events_count_on_delete 
  AFTER DELETE ON event_favorites 
  FOR EACH ROW 
  EXECUTE FUNCTION update_user_favorite_events_count();

-- 8. Initialize favorite count for existing users (optional)
-- This will set the count based on existing favorites if any
UPDATE profiles 
SET favorite_events_count = (
  SELECT COUNT(*) 
  FROM event_favorites 
  WHERE event_favorites.user_id = profiles.id
);

-- 9. Enable Real-time Subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE event_favorites;

-- ============================================================================
-- Helper Functions for Querying Favorites
-- ============================================================================

-- Function: Get user's favorite events
CREATE OR REPLACE FUNCTION get_user_favorite_events(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  created_by UUID,
  title TEXT,
  description TEXT,
  event_type TEXT,
  location TEXT,
  latitude DECIMAL,
  longitude DECIMAL,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  rsvp_count INTEGER,
  max_attendees INTEGER,
  cover_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  favorited_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.created_by,
    e.title,
    e.description,
    e.event_type,
    e.location,
    e.latitude,
    e.longitude,
    e.start_date,
    e.end_date,
    e.rsvp_count,
    e.max_attendees,
    e.cover_image_url,
    e.created_at,
    e.updated_at,
    ef.created_at as favorited_at
  FROM event_favorites ef
  INNER JOIN events e ON ef.event_id = e.id
  WHERE ef.user_id = p_user_id
  ORDER BY ef.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_favorite_events TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_favorite_events TO anon;

-- Function: Check if user has favorited an event
CREATE OR REPLACE FUNCTION has_user_favorited_event(
  p_user_id UUID,
  p_event_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM event_favorites 
    WHERE user_id = p_user_id 
      AND event_id = p_event_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION has_user_favorited_event TO authenticated;
GRANT EXECUTE ON FUNCTION has_user_favorited_event TO anon;

-- ============================================================================
-- Setup Complete!
-- ============================================================================

