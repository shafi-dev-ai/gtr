-- ============================================
-- DATABASE INDEXES FOR PERFORMANCE
-- Run this in Supabase SQL Editor
-- ============================================

-- Listings Indexes
CREATE INDEX IF NOT EXISTS idx_listings_status_created 
ON listings(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_listings_location 
ON listings(city, state);

CREATE INDEX IF NOT EXISTS idx_listings_user_status 
ON listings(user_id, status);

CREATE INDEX IF NOT EXISTS idx_listings_model 
ON listings(model);

CREATE INDEX IF NOT EXISTS idx_listings_price 
ON listings(price);

-- Full-text search index for listings
CREATE INDEX IF NOT EXISTS idx_listings_search 
ON listings USING GIN(to_tsvector('english', 
  COALESCE(title, '') || ' ' || 
  COALESCE(description, '') || ' ' || 
  COALESCE(model, '')
));

-- Forum Posts Indexes
CREATE INDEX IF NOT EXISTS idx_forum_posts_created 
ON forum_posts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_forum_posts_user 
ON forum_posts(user_id);

CREATE INDEX IF NOT EXISTS idx_forum_posts_model 
ON forum_posts(model);

CREATE INDEX IF NOT EXISTS idx_forum_posts_search 
ON forum_posts USING GIN(to_tsvector('english', 
  COALESCE(title, '') || ' ' || 
  COALESCE(content, '')
));

-- Events Indexes
CREATE INDEX IF NOT EXISTS idx_events_start_date 
ON events(start_date);

CREATE INDEX IF NOT EXISTS idx_events_created_by 
ON events(created_by);

CREATE INDEX IF NOT EXISTS idx_events_location 
ON events(location);

-- Index for upcoming events (partial index)
CREATE INDEX IF NOT EXISTS idx_events_upcoming 
ON events(start_date) 
WHERE start_date > NOW();

-- Favorites Indexes
CREATE INDEX IF NOT EXISTS idx_listing_favorites_user 
ON listing_favorites(user_id);

CREATE INDEX IF NOT EXISTS idx_listing_favorites_listing 
ON listing_favorites(listing_id);

-- Composite index for faster lookups
CREATE INDEX IF NOT EXISTS idx_listing_favorites_user_listing 
ON listing_favorites(user_id, listing_id);

CREATE INDEX IF NOT EXISTS idx_event_favorites_user 
ON event_favorites(user_id);

CREATE INDEX IF NOT EXISTS idx_event_favorites_event 
ON event_favorites(event_id);

CREATE INDEX IF NOT EXISTS idx_event_favorites_user_event 
ON event_favorites(user_id, event_id);

-- Comments Indexes
CREATE INDEX IF NOT EXISTS idx_forum_comments_post 
ON forum_comments(post_id, created_at);

CREATE INDEX IF NOT EXISTS idx_forum_comments_user 
ON forum_comments(user_id);

-- Messages/Conversations Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user1 
ON conversations(user1_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_user2 
ON conversations(user2_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation 
ON messages(conversation_id, created_at DESC);

-- Listing Images Indexes
CREATE INDEX IF NOT EXISTS idx_listing_images_listing 
ON listing_images(listing_id, is_primary);

-- Garage Indexes
CREATE INDEX IF NOT EXISTS idx_garage_user 
ON garage(user_id);

CREATE INDEX IF NOT EXISTS idx_garage_model 
ON garage(model);

-- Profiles Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_username 
ON profiles(username);

CREATE INDEX IF NOT EXISTS idx_profiles_location 
ON profiles(location);

