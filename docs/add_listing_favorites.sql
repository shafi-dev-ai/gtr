-- ============================================================================
-- Add Listing Favorites Table and Integration
-- This adds the ability for users to favorite/save listings
-- ============================================================================

-- 1. Add favorite_count to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS favorite_listings_count INTEGER DEFAULT 0;

-- 2. Create Listing Favorites Table
CREATE TABLE IF NOT EXISTS listing_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(listing_id, user_id)
);

-- 3. Create Indexes
CREATE INDEX IF NOT EXISTS idx_listing_favorites_listing_id ON listing_favorites(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_favorites_user_id ON listing_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_listing_favorites_created_at ON listing_favorites(created_at DESC);

-- 4. Enable RLS
ALTER TABLE listing_favorites ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
CREATE POLICY "Listing favorites are viewable by everyone" 
  ON listing_favorites FOR SELECT USING (true);

CREATE POLICY "Authenticated users can favorite listings" 
  ON listing_favorites FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unfavorite their own favorites" 
  ON listing_favorites FOR DELETE 
  USING (auth.uid() = user_id);

-- 6. Function: Update user's favorite count
CREATE OR REPLACE FUNCTION update_user_favorite_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles 
    SET favorite_listings_count = favorite_listings_count + 1 
    WHERE id = NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles 
    SET favorite_listings_count = GREATEST(favorite_listings_count - 1, 0)
    WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 7. Triggers
CREATE TRIGGER update_user_favorite_count_on_insert 
  AFTER INSERT ON listing_favorites 
  FOR EACH ROW 
  EXECUTE FUNCTION update_user_favorite_count();

CREATE TRIGGER update_user_favorite_count_on_delete 
  AFTER DELETE ON listing_favorites 
  FOR EACH ROW 
  EXECUTE FUNCTION update_user_favorite_count();

-- 8. Initialize favorite count for existing users (optional)
-- This will set the count based on existing favorites if any
UPDATE profiles 
SET favorite_listings_count = (
  SELECT COUNT(*) 
  FROM listing_favorites 
  WHERE listing_favorites.user_id = profiles.id
);

-- 9. Enable Real-time Subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE listing_favorites;

-- ============================================================================
-- Helper Functions for Querying Favorites
-- ============================================================================

-- Function: Get user's favorite listings
CREATE OR REPLACE FUNCTION get_user_favorite_listings(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  model TEXT,
  year INTEGER,
  price DECIMAL,
  mileage INTEGER,
  description TEXT,
  condition TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  location TEXT,
  vin TEXT,
  color TEXT,
  transmission TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  favorited_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.user_id,
    l.title,
    l.model,
    l.year,
    l.price,
    l.mileage,
    l.description,
    l.condition,
    l.city,
    l.state,
    l.zip_code,
    l.location,
    l.vin,
    l.color,
    l.transmission,
    l.status,
    l.created_at,
    l.updated_at,
    lf.created_at as favorited_at
  FROM listing_favorites lf
  INNER JOIN listings l ON lf.listing_id = l.id
  WHERE lf.user_id = p_user_id
    AND l.status = 'active'
  ORDER BY lf.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_favorite_listings TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_favorite_listings TO anon;

-- Function: Check if user has favorited a listing
CREATE OR REPLACE FUNCTION has_user_favorited_listing(
  p_user_id UUID,
  p_listing_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM listing_favorites 
    WHERE user_id = p_user_id 
      AND listing_id = p_listing_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION has_user_favorited_listing TO authenticated;
GRANT EXECUTE ON FUNCTION has_user_favorited_listing TO anon;

-- ============================================================================
-- Setup Complete!
-- ============================================================================

