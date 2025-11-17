-- ============================================================================
-- Add Country and Address Fields to Listings Table
-- This adds structured location data for better filtering
-- ============================================================================

-- Add country field (ISO country code, e.g., 'US', 'CA', 'GB')
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS country TEXT;

-- Add street_address field for custom address input
ALTER TABLE listings 
ADD COLUMN IF NOT EXISTS street_address TEXT;

-- Update search_vector to include country for better search
-- Note: This requires dropping and recreating the generated column
ALTER TABLE listings 
DROP COLUMN IF EXISTS search_vector;

ALTER TABLE listings 
ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(city, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(state, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(country, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(model, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(color, '')), 'D')
) STORED;

-- Add index for country filtering
CREATE INDEX IF NOT EXISTS idx_listings_country ON listings(country);

-- Add composite index for country + state filtering
CREATE INDEX IF NOT EXISTS idx_listings_country_state ON listings(country, state);

-- Add composite index for country + state + city filtering
CREATE INDEX IF NOT EXISTS idx_listings_country_state_city ON listings(country, state, city) WHERE status = 'active';

-- Add comment for documentation
COMMENT ON COLUMN listings.country IS 'ISO country code (e.g., US, CA, GB) for location filtering';
COMMENT ON COLUMN listings.street_address IS 'Custom street address or detailed location';
COMMENT ON COLUMN listings.state IS 'State/Province (dependent on country)';
COMMENT ON COLUMN listings.city IS 'City name';
COMMENT ON COLUMN listings.location IS 'Full location string (kept for backward compatibility)';

-- ============================================================================
-- Migration Complete!
-- ============================================================================
-- New fields:
-- - country: TEXT (ISO country code)
-- - street_address: TEXT (custom address input)
-- 
-- Updated:
-- - search_vector: Now includes country in search
-- - Indexes: Added for country, country+state, country+state+city
-- ============================================================================

