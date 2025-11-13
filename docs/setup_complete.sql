-- ============================================================================
-- GT-R Marketplace Complete Database Setup Script
-- Run this entire script in Supabase SQL Editor
-- Order: Tables → Indexes → RLS Policies → Functions → Triggers → Real-time
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE ALL TABLES
-- ============================================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE, -- Optional, can be set later
  full_name TEXT,
  email TEXT, -- Store email from auth.users for easy access
  phone_number TEXT, -- Phone number (private, only visible to user)
  phone_verified BOOLEAN DEFAULT FALSE, -- Phone verification status
  bio TEXT,
  avatar_url TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Listings Table
CREATE TABLE IF NOT EXISTS listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  price DECIMAL(12, 2) NOT NULL,
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
  status TEXT DEFAULT 'active',
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(city, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(state, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(model, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(color, '')), 'D')
  ) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sold_at TIMESTAMP WITH TIME ZONE
);

-- 3. Listing Images Table
CREATE TABLE IF NOT EXISTS listing_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. User Garage Table
CREATE TABLE IF NOT EXISTS user_garage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  nickname TEXT,
  description TEXT,
  cover_image_url TEXT,
  mods TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Forum Posts Table
CREATE TABLE IF NOT EXISTS forum_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  model TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_urls TEXT[],
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Forum Comments Table
CREATE TABLE IF NOT EXISTS forum_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES forum_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Post Likes Table
CREATE TABLE IF NOT EXISTS post_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES forum_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- 8. Events Table
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL,
  location TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  rsvp_count INTEGER DEFAULT 0,
  max_attendees INTEGER,
  cover_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Event RSVPs Table
CREATE TABLE IF NOT EXISTS event_rsvps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'going',
  checked_in BOOLEAN DEFAULT FALSE,
  checked_in_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- 10. Saved Searches Table
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  search_name TEXT NOT NULL,
  search_query TEXT,
  model TEXT,
  min_price DECIMAL(12, 2),
  max_price DECIMAL(12, 2),
  min_year INTEGER,
  max_year INTEGER,
  condition TEXT[],
  city TEXT,
  state TEXT,
  location TEXT,
  transmission TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Parts Listings Table
CREATE TABLE IF NOT EXISTS parts_listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  part_name TEXT NOT NULL,
  part_number TEXT,
  compatible_models TEXT[],
  price DECIMAL(12, 2) NOT NULL,
  condition TEXT,
  description TEXT,
  image_urls TEXT[],
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_preview TEXT,
  user1_unread_count INTEGER DEFAULT 0,
  user2_unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id < user2_id)
);

-- 13. Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. Model Specs Table
CREATE TABLE IF NOT EXISTS model_specs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model TEXT NOT NULL,
  year INTEGER,
  engine TEXT,
  displacement TEXT,
  horsepower INTEGER,
  torque INTEGER,
  transmission TEXT,
  drivetrain TEXT,
  weight INTEGER,
  length DECIMAL(5, 2),
  width DECIMAL(5, 2),
  height DECIMAL(5, 2),
  wheelbase DECIMAL(5, 2),
  fuel_capacity DECIMAL(4, 2),
  mpg_city DECIMAL(4, 1),
  mpg_highway DECIMAL(4, 1),
  acceleration_0_60 DECIMAL(4, 2),
  top_speed INTEGER,
  additional_specs JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. Community Media Table
CREATE TABLE IF NOT EXISTS community_media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  model TEXT,
  title TEXT,
  description TEXT,
  media_type TEXT NOT NULL,
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  storage_path TEXT NOT NULL,
  file_size INTEGER,
  duration INTEGER,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  tags TEXT[],
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 16. Media Likes Table
CREATE TABLE IF NOT EXISTS media_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  media_id UUID REFERENCES community_media(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(media_id, user_id)
);

-- 17. Media Comments Table
CREATE TABLE IF NOT EXISTS media_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  media_id UUID REFERENCES community_media(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: CREATE ALL INDEXES
-- ============================================================================

-- Listings indexes
CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_model ON listings(model);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price);
CREATE INDEX IF NOT EXISTS idx_listings_year ON listings(year);
CREATE INDEX IF NOT EXISTS idx_listings_city ON listings(city);
CREATE INDEX IF NOT EXISTS idx_listings_state ON listings(state);
CREATE INDEX IF NOT EXISTS idx_listings_city_state ON listings(city, state);
CREATE INDEX IF NOT EXISTS idx_listings_search_vector ON listings USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_listings_model_year ON listings(model, year);
CREATE INDEX IF NOT EXISTS idx_listings_status_price ON listings(status, price) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_listings_state_city_model ON listings(state, city, model) WHERE status = 'active';

-- Listing images indexes
CREATE INDEX IF NOT EXISTS idx_listing_images_listing_id ON listing_images(listing_id);

-- User garage indexes
CREATE INDEX IF NOT EXISTS idx_user_garage_user_id ON user_garage(user_id);

-- Forum posts indexes
CREATE INDEX IF NOT EXISTS idx_forum_posts_model ON forum_posts(model);
CREATE INDEX IF NOT EXISTS idx_forum_posts_user_id ON forum_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_created_at ON forum_posts(created_at DESC);

-- Forum comments indexes
CREATE INDEX IF NOT EXISTS idx_forum_comments_post_id ON forum_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_comments_user_id ON forum_comments(user_id);

-- Post likes indexes
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);

-- Events indexes
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);

-- Event RSVPs indexes
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_id ON event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user_id ON event_rsvps(user_id);

-- Saved searches indexes
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches(user_id);

-- Parts listings indexes
CREATE INDEX IF NOT EXISTS idx_parts_listings_user_id ON parts_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_parts_listings_status ON parts_listings(status);

-- Conversations indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user1_id ON conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user2_id ON conversations(user2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read) WHERE is_read = FALSE;

-- Model specs indexes
CREATE INDEX IF NOT EXISTS idx_model_specs_model ON model_specs(model);
CREATE INDEX IF NOT EXISTS idx_model_specs_model_year ON model_specs(model, year);

-- Community media indexes
CREATE INDEX IF NOT EXISTS idx_community_media_user_id ON community_media(user_id);
CREATE INDEX IF NOT EXISTS idx_community_media_model ON community_media(model);
CREATE INDEX IF NOT EXISTS idx_community_media_media_type ON community_media(media_type);
CREATE INDEX IF NOT EXISTS idx_community_media_created_at ON community_media(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_media_like_count ON community_media(like_count DESC);

-- Media likes indexes
CREATE INDEX IF NOT EXISTS idx_media_likes_media_id ON media_likes(media_id);
CREATE INDEX IF NOT EXISTS idx_media_likes_user_id ON media_likes(user_id);

-- Media comments indexes
CREATE INDEX IF NOT EXISTS idx_media_comments_media_id ON media_comments(media_id);
CREATE INDEX IF NOT EXISTS idx_media_comments_user_id ON media_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_media_comments_created_at ON media_comments(created_at DESC);

-- ============================================================================
-- STEP 3: ENABLE RLS AND CREATE POLICIES
-- ============================================================================

-- Profiles Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- Everyone can view profiles, but phone_number should be masked in frontend for non-owners
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Listings Policies
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active listings are viewable by everyone" ON listings FOR SELECT USING (status = 'active');
CREATE POLICY "Users can view their own listings" ON listings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create listings" ON listings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own listings" ON listings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own listings" ON listings FOR DELETE USING (auth.uid() = user_id);

-- Listing Images Policies
ALTER TABLE listing_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Listing images are viewable by everyone" ON listing_images FOR SELECT USING (true);
CREATE POLICY "Users can insert images for their listings" ON listing_images FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM listings WHERE listings.id = listing_images.listing_id AND listings.user_id = auth.uid())
);
CREATE POLICY "Users can delete images from their listings" ON listing_images FOR DELETE USING (
  EXISTS (SELECT 1 FROM listings WHERE listings.id = listing_images.listing_id AND listings.user_id = auth.uid())
);

-- User Garage Policies
ALTER TABLE user_garage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User garage is viewable by everyone" ON user_garage FOR SELECT USING (true);
CREATE POLICY "Users can add to their garage" ON user_garage FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their garage" ON user_garage FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete from their garage" ON user_garage FOR DELETE USING (auth.uid() = user_id);

-- Forum Posts Policies
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Forum posts are viewable by everyone" ON forum_posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create forum posts" ON forum_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own forum posts" ON forum_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own forum posts" ON forum_posts FOR DELETE USING (auth.uid() = user_id);

-- Forum Comments Policies
ALTER TABLE forum_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Forum comments are viewable by everyone" ON forum_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create comments" ON forum_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own comments" ON forum_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON forum_comments FOR DELETE USING (auth.uid() = user_id);

-- Post Likes Policies
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Post likes are viewable by everyone" ON post_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like posts" ON post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike posts" ON post_likes FOR DELETE USING (auth.uid() = user_id);

-- Events Policies
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events are viewable by everyone" ON events FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create events" ON events FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Event creators can update their events" ON events FOR UPDATE USING (auth.uid() = created_by);

-- Event RSVPs Policies
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "RSVPs are viewable by everyone" ON event_rsvps FOR SELECT USING (true);
CREATE POLICY "Authenticated users can RSVP" ON event_rsvps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their RSVP" ON event_rsvps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their RSVP" ON event_rsvps FOR DELETE USING (auth.uid() = user_id);

-- Saved Searches Policies
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own saved searches" ON saved_searches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create saved searches" ON saved_searches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their saved searches" ON saved_searches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their saved searches" ON saved_searches FOR DELETE USING (auth.uid() = user_id);

-- Conversations Policies
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own conversations" ON conversations FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users can create conversations" ON conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users can update their own conversations" ON conversations FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Messages Policies
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view messages in their conversations" ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND (conversations.user1_id = auth.uid() OR conversations.user2_id = auth.uid()))
);
CREATE POLICY "Users can send messages" ON messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id AND EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND (conversations.user1_id = auth.uid() OR conversations.user2_id = auth.uid()))
);
CREATE POLICY "Users can update their own sent messages" ON messages FOR UPDATE USING (auth.uid() = sender_id);
CREATE POLICY "Recipients can mark messages as read" ON messages FOR UPDATE USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);

-- Model Specs Policies
ALTER TABLE model_specs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Model specs are viewable by everyone" ON model_specs FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create specs" ON model_specs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update specs" ON model_specs FOR UPDATE TO authenticated USING (true);

-- Community Media Policies
ALTER TABLE community_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Community media is viewable by everyone" ON community_media FOR SELECT USING (true);
CREATE POLICY "Users can create media posts" ON community_media FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own media posts" ON community_media FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own media posts" ON community_media FOR DELETE USING (auth.uid() = user_id);

-- Media Likes Policies
ALTER TABLE media_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Media likes are viewable by everyone" ON media_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like media" ON media_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike media" ON media_likes FOR DELETE USING (auth.uid() = user_id);

-- Media Comments Policies
ALTER TABLE media_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Media comments are viewable by everyone" ON media_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create comments" ON media_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own comments" ON media_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON media_comments FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 4: CREATE FUNCTIONS
-- ============================================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function: Create profile on signup (handles email, OAuth: Google/Apple/Facebook, and phone)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
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
    -- Google: 'name' or 'given_name' + 'family_name'
    -- Apple: 'full_name' or 'given_name' + 'family_name'
    -- Facebook: 'name'
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
    -- Google: 'picture'
    -- Facebook: 'picture' (from Graph API)
    -- Apple: Usually NULL (no avatar)
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update comment count on forum posts
CREATE OR REPLACE FUNCTION update_forum_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE forum_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE forum_posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: Update like count on forum posts
CREATE OR REPLACE FUNCTION update_forum_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE forum_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE forum_posts SET like_count = like_count - 1 WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: Update RSVP count on events
CREATE OR REPLACE FUNCTION update_event_rsvp_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE events SET rsvp_count = rsvp_count + 1 WHERE id = NEW.event_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE events SET rsvp_count = rsvp_count - 1 WHERE id = OLD.event_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: Update conversation on message
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE conversations SET 
      last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.content, 100),
      user1_unread_count = CASE WHEN user1_id = NEW.recipient_id THEN user1_unread_count + 1 ELSE user1_unread_count END,
      user2_unread_count = CASE WHEN user2_id = NEW.recipient_id THEN user2_unread_count + 1 ELSE user2_unread_count END,
      updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_read = FALSE AND NEW.is_read = TRUE THEN
      UPDATE conversations SET 
        user1_unread_count = CASE WHEN user1_id = NEW.recipient_id AND user1_unread_count > 0 THEN user1_unread_count - 1 ELSE user1_unread_count END,
        user2_unread_count = CASE WHEN user2_id = NEW.recipient_id AND user2_unread_count > 0 THEN user2_unread_count - 1 ELSE user2_unread_count END
      WHERE id = NEW.conversation_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: Update media like count
CREATE OR REPLACE FUNCTION update_media_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_media SET like_count = like_count + 1 WHERE id = NEW.media_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_media SET like_count = like_count - 1 WHERE id = OLD.media_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: Update media comment count
CREATE OR REPLACE FUNCTION update_media_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_media SET comment_count = comment_count + 1 WHERE id = NEW.media_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_media SET comment_count = comment_count - 1 WHERE id = OLD.media_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: Search listings
CREATE OR REPLACE FUNCTION search_listings(
  search_query TEXT DEFAULT NULL,
  model_filter TEXT DEFAULT NULL,
  year_min INTEGER DEFAULT NULL,
  year_max INTEGER DEFAULT NULL,
  price_min DECIMAL DEFAULT NULL,
  price_max DECIMAL DEFAULT NULL,
  city_filter TEXT DEFAULT NULL,
  state_filter TEXT DEFAULT NULL,
  condition_filter TEXT DEFAULT NULL,
  transmission_filter TEXT DEFAULT NULL,
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID, user_id UUID, title TEXT, model TEXT, year INTEGER, price DECIMAL,
  mileage INTEGER, description TEXT, condition TEXT, city TEXT, state TEXT,
  zip_code TEXT, location TEXT, vin TEXT, color TEXT, transmission TEXT,
  status TEXT, created_at TIMESTAMP WITH TIME ZONE, updated_at TIMESTAMP WITH TIME ZONE,
  search_rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT l.id, l.user_id, l.title, l.model, l.year, l.price, l.mileage,
    l.description, l.condition, l.city, l.state, l.zip_code, l.location,
    l.vin, l.color, l.transmission, l.status, l.created_at, l.updated_at,
    CASE WHEN search_query IS NOT NULL THEN ts_rank(l.search_vector, plainto_tsquery('english', search_query)) ELSE 0::REAL END as search_rank
  FROM listings l
  WHERE l.status = 'active'
    AND (search_query IS NULL OR l.search_vector @@ plainto_tsquery('english', search_query))
    AND (model_filter IS NULL OR l.model = model_filter)
    AND (year_min IS NULL OR l.year >= year_min)
    AND (year_max IS NULL OR l.year <= year_max)
    AND (price_min IS NULL OR l.price >= price_min)
    AND (price_max IS NULL OR l.price <= price_max)
    AND (city_filter IS NULL OR LOWER(l.city) LIKE LOWER('%' || city_filter || '%'))
    AND (state_filter IS NULL OR LOWER(l.state) LIKE LOWER('%' || state_filter || '%'))
    AND (condition_filter IS NULL OR l.condition = condition_filter)
    AND (transmission_filter IS NULL OR l.transmission = transmission_filter)
  ORDER BY CASE WHEN search_query IS NOT NULL THEN search_rank ELSE 0 END DESC, l.created_at DESC
  LIMIT limit_count OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION search_listings TO authenticated;
GRANT EXECUTE ON FUNCTION search_listings TO anon;

-- ============================================================================
-- STEP 5: CREATE TRIGGERS
-- ============================================================================

-- Updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_listings_updated_at BEFORE UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_forum_posts_updated_at BEFORE UPDATE ON forum_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_garage_updated_at BEFORE UPDATE ON user_garage FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Profile creation trigger
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Forum comment count triggers
CREATE TRIGGER update_comment_count_on_insert AFTER INSERT ON forum_comments FOR EACH ROW EXECUTE FUNCTION update_forum_post_comment_count();
CREATE TRIGGER update_comment_count_on_delete AFTER DELETE ON forum_comments FOR EACH ROW EXECUTE FUNCTION update_forum_post_comment_count();

-- Forum like count triggers
CREATE TRIGGER update_like_count_on_insert AFTER INSERT ON post_likes FOR EACH ROW EXECUTE FUNCTION update_forum_post_like_count();
CREATE TRIGGER update_like_count_on_delete AFTER DELETE ON post_likes FOR EACH ROW EXECUTE FUNCTION update_forum_post_like_count();

-- Event RSVP count triggers
CREATE TRIGGER update_rsvp_count_on_insert AFTER INSERT ON event_rsvps FOR EACH ROW EXECUTE FUNCTION update_event_rsvp_count();
CREATE TRIGGER update_rsvp_count_on_delete AFTER DELETE ON event_rsvps FOR EACH ROW EXECUTE FUNCTION update_event_rsvp_count();

-- Conversation/message triggers
CREATE TRIGGER update_conversation_on_message_insert AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();
CREATE TRIGGER update_conversation_on_message_update AFTER UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- Media like count triggers
CREATE TRIGGER update_media_like_count_on_insert AFTER INSERT ON media_likes FOR EACH ROW EXECUTE FUNCTION update_media_like_count();
CREATE TRIGGER update_media_like_count_on_delete AFTER DELETE ON media_likes FOR EACH ROW EXECUTE FUNCTION update_media_like_count();

-- Media comment count triggers
CREATE TRIGGER update_media_comment_count_on_insert AFTER INSERT ON media_comments FOR EACH ROW EXECUTE FUNCTION update_media_comment_count();
CREATE TRIGGER update_media_comment_count_on_delete AFTER DELETE ON media_comments FOR EACH ROW EXECUTE FUNCTION update_media_comment_count();

-- ============================================================================
-- STEP 6: ENABLE REAL-TIME SUBSCRIPTIONS
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE listings;
ALTER PUBLICATION supabase_realtime ADD TABLE forum_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE forum_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE community_media;
ALTER PUBLICATION supabase_realtime ADD TABLE media_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE media_comments;

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================
-- Next steps:
-- 1. Create storage buckets in Supabase Dashboard (Storage → Create Bucket):
--    - listing-images (public, 10MB)
--    - avatars (public, 2MB)
--    - forum-images (public, 5MB)
--    - garage-images (public, 10MB)
--    - event-images (public, 5MB)
--    - message-images (private, 5MB)
--    - community-media (public, 50MB)
-- 2. Configure authentication providers in Authentication → Providers
-- 3. Test your setup by creating a test user
-- ============================================================================

