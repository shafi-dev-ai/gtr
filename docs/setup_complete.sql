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
  favorite_listings_count INTEGER DEFAULT 0,
  favorite_events_count INTEGER DEFAULT 0,
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
  country TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  street_address TEXT,
  location TEXT,
  vin TEXT,
  color TEXT,
  transmission TEXT,
  fuel_type TEXT,
  drive_type TEXT,
  horsepower INTEGER,
  status TEXT DEFAULT 'active',
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(city, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(state, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(country, '')), 'C') ||
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
  parent_comment_id UUID REFERENCES forum_comments(id) ON DELETE CASCADE,
  reply_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
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

-- 18. Listing Favorites Table
CREATE TABLE IF NOT EXISTS listing_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(listing_id, user_id)
);

-- 19. Event Favorites Table
CREATE TABLE IF NOT EXISTS event_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- 20. Comment Likes Table
CREATE TABLE IF NOT EXISTS comment_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID REFERENCES forum_comments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- 21. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 22. User Device Tokens Table
CREATE TABLE IF NOT EXISTS user_device_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  device_token TEXT NOT NULL,
  platform TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, device_token)
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
CREATE INDEX IF NOT EXISTS idx_listings_country ON listings(country);
CREATE INDEX IF NOT EXISTS idx_listings_country_state ON listings(country, state);
CREATE INDEX IF NOT EXISTS idx_listings_country_state_city ON listings(country, state, city) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_listings_search_vector ON listings USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_listings_model_year ON listings(model, year);
CREATE INDEX IF NOT EXISTS idx_listings_status_price ON listings(status, price) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_listings_state_city_model ON listings(state, city, model) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_listings_status_created ON listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_user_status ON listings(user_id, status);

-- Listing images indexes
CREATE INDEX IF NOT EXISTS idx_listing_images_listing_id ON listing_images(listing_id, is_primary);

-- User garage indexes
CREATE INDEX IF NOT EXISTS idx_user_garage_user_id ON user_garage(user_id);

-- Profile indexes
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON profiles(location);

-- Forum posts indexes
CREATE INDEX IF NOT EXISTS idx_forum_posts_model ON forum_posts(model);
CREATE INDEX IF NOT EXISTS idx_forum_posts_user_id ON forum_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_created_at ON forum_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_search ON forum_posts USING GIN(
  to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(content, ''))
);

-- Forum comments indexes
CREATE INDEX IF NOT EXISTS idx_forum_comments_post_id ON forum_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_comments_user_id ON forum_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_comments_parent_comment_id ON forum_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_forum_comments_post_parent ON forum_comments(post_id, parent_comment_id);

-- Post likes indexes
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);

-- Events indexes
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_location ON events(location);
CREATE INDEX IF NOT EXISTS idx_events_upcoming ON events(start_date) WHERE start_date > NOW();

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

-- Listing favorites indexes
CREATE INDEX IF NOT EXISTS idx_listing_favorites_listing_id ON listing_favorites(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_favorites_user_id ON listing_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_listing_favorites_created_at ON listing_favorites(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_favorites_user_listing ON listing_favorites(user_id, listing_id);

-- Event favorites indexes
CREATE INDEX IF NOT EXISTS idx_event_favorites_event_id ON event_favorites(event_id);
CREATE INDEX IF NOT EXISTS idx_event_favorites_user_id ON event_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_event_favorites_created_at ON event_favorites(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_favorites_user_event ON event_favorites(user_id, event_id);

-- Comment likes indexes
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON comment_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_created_at ON comment_likes(created_at DESC);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- User device tokens indexes
CREATE INDEX IF NOT EXISTS idx_user_device_tokens_user_id ON user_device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_device_tokens_token ON user_device_tokens(device_token);

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

-- Listing Favorites Policies
ALTER TABLE listing_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Listing favorites are viewable by everyone" ON listing_favorites FOR SELECT USING (true);
CREATE POLICY "Authenticated users can favorite listings" ON listing_favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unfavorite their own listings" ON listing_favorites FOR DELETE USING (auth.uid() = user_id);

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

-- Comment Likes Policies
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comment likes are viewable by everyone" ON comment_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like comments" ON comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike their comment likes" ON comment_likes FOR DELETE USING (auth.uid() = user_id);

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

-- Event Favorites Policies
ALTER TABLE event_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Event favorites are viewable by everyone" ON event_favorites FOR SELECT USING (true);
CREATE POLICY "Authenticated users can favorite events" ON event_favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unfavorite events" ON event_favorites FOR DELETE USING (auth.uid() = user_id);

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

-- Notifications Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notifications" ON notifications FOR DELETE USING (auth.uid() = user_id);

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

-- User Device Tokens Policies
ALTER TABLE user_device_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own device tokens" ON user_device_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own device tokens" ON user_device_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own device tokens" ON user_device_tokens FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own device tokens" ON user_device_tokens FOR DELETE USING (auth.uid() = user_id);

-- Storage Bucket Policies for Avatars
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;

CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Storage Bucket Policies for Listing Images
DROP POLICY IF EXISTS "Owners can upload listing images" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update listing images" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete listing images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view listing images" ON storage.objects;

CREATE POLICY "Owners can upload listing images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'listing-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners can update listing images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'listing-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners can delete listing images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'listing-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public can view listing images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'listing-images');

-- Storage Bucket Policies for Forum Images
DROP POLICY IF EXISTS "Owners can upload forum images" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update forum images" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete forum images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view forum images" ON storage.objects;

CREATE POLICY "Owners can upload forum images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'forum-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners can update forum images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'forum-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners can delete forum images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'forum-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public can view forum images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'forum-images');

-- Storage Bucket Policies for Garage Images
DROP POLICY IF EXISTS "Owners can upload garage images" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update garage images" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete garage images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view garage images" ON storage.objects;

CREATE POLICY "Owners can upload garage images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'garage-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners can update garage images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'garage-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners can delete garage images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'garage-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public can view garage images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'garage-images');

-- Storage Bucket Policies for Event Images
DROP POLICY IF EXISTS "Owners can upload event images" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update event images" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete event images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view event images" ON storage.objects;

CREATE POLICY "Owners can upload event images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'event-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners can update event images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'event-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners can delete event images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'event-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public can view event images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'event-images');

-- Storage Bucket Policies for Message Images
DROP POLICY IF EXISTS "Owners can upload message images" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update message images" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete message images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view message images" ON storage.objects;

CREATE POLICY "Owners can upload message images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'message-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners can update message images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'message-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners can delete message images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'message-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public can view message images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'message-images');

-- Storage Bucket Policies for Community Media
DROP POLICY IF EXISTS "Owners can upload community media" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update community media" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete community media" ON storage.objects;
DROP POLICY IF EXISTS "Public can view community media" ON storage.objects;

CREATE POLICY "Owners can upload community media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'community-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners can update community media"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'community-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners can delete community media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'community-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Public can view community media"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'community-media');

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

-- Function: Create profile on signup with robust error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, username, full_name, email, avatar_url, phone_number)
    VALUES (
      NEW.id,
      COALESCE(
        NEW.raw_user_meta_data->>'username',
        NEW.raw_user_meta_data->>'preferred_username',
        NEW.raw_user_meta_data->>'user_name',
        NULL
      ),
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
      COALESCE(NEW.email, ''),
      COALESCE(
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'picture',
        NEW.raw_user_meta_data->>'avatar',
        NEW.app_metadata->>'avatar_url',
        NEW.app_metadata->>'picture',
        NULL
      ),
      COALESCE(
        NEW.raw_user_meta_data->>'phone_number',
        NEW.phone,
        NULL
      )
    );
  EXCEPTION
    WHEN unique_violation THEN
      RAISE WARNING 'Profile already exists for user %', NEW.id;
    WHEN OTHERS THEN
      RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

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

-- Function: Update user favorite listings count
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

-- Function: Update user favorite events count
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

-- Function: Get user favorite listings
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
    lf.created_at AS favorited_at
  FROM listing_favorites lf
  INNER JOIN listings l ON lf.listing_id = l.id
  WHERE lf.user_id = p_user_id
  ORDER BY lf.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_favorite_listings(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_favorite_listings(UUID, INTEGER, INTEGER) TO anon;

-- Function: Check if user has favorited listing
CREATE OR REPLACE FUNCTION has_user_favorited_listing(
  p_user_id UUID,
  p_listing_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM listing_favorites
    WHERE user_id = p_user_id AND listing_id = p_listing_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION has_user_favorited_listing(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION has_user_favorited_listing(UUID, UUID) TO anon;

-- Function: Get user favorite events
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
    ef.created_at AS favorited_at
  FROM event_favorites ef
  INNER JOIN events e ON ef.event_id = e.id
  WHERE ef.user_id = p_user_id
  ORDER BY ef.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_favorite_events(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_favorite_events(UUID, INTEGER, INTEGER) TO anon;

-- Function: Check if user has favorited event
CREATE OR REPLACE FUNCTION has_user_favorited_event(
  p_user_id UUID,
  p_event_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM event_favorites
    WHERE user_id = p_user_id AND event_id = p_event_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION has_user_favorited_event(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION has_user_favorited_event(UUID, UUID) TO anon;

-- Function: Update comment reply count
CREATE OR REPLACE FUNCTION update_comment_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.parent_comment_id IS NOT NULL THEN
      UPDATE forum_comments
      SET reply_count = reply_count + 1
      WHERE id = NEW.parent_comment_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.parent_comment_id IS NOT NULL THEN
      UPDATE forum_comments
      SET reply_count = GREATEST(reply_count - 1, 0)
      WHERE id = OLD.parent_comment_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: Update comment like count
CREATE OR REPLACE FUNCTION update_comment_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE forum_comments
    SET like_count = like_count + 1
    WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE forum_comments
    SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function: Get comment replies
CREATE OR REPLACE FUNCTION get_comment_replies(
  p_comment_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  post_id UUID,
  user_id UUID,
  content TEXT,
  parent_comment_id UUID,
  reply_count INTEGER,
  like_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.post_id,
    c.user_id,
    c.content,
    c.parent_comment_id,
    c.reply_count,
    c.like_count,
    c.created_at,
    c.updated_at
  FROM forum_comments c
  WHERE c.parent_comment_id = p_comment_id
  ORDER BY c.created_at ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_comment_replies(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_comment_replies(UUID, INTEGER, INTEGER) TO anon;

-- Function: Get nested post comments
CREATE OR REPLACE FUNCTION get_post_comments_nested(
  p_post_id UUID,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  post_id UUID,
  user_id UUID,
  content TEXT,
  parent_comment_id UUID,
  reply_count INTEGER,
  like_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  depth INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE comment_tree AS (
    SELECT
      c.id,
      c.post_id,
      c.user_id,
      c.content,
      c.parent_comment_id,
      c.reply_count,
      c.like_count,
      c.created_at,
      c.updated_at,
      0 AS depth
    FROM forum_comments c
    WHERE c.post_id = p_post_id
      AND c.parent_comment_id IS NULL

    UNION ALL

    SELECT
      c.id,
      c.post_id,
      c.user_id,
      c.content,
      c.parent_comment_id,
      c.reply_count,
      c.like_count,
      c.created_at,
      c.updated_at,
      ct.depth + 1
    FROM forum_comments c
    INNER JOIN comment_tree ct ON c.parent_comment_id = ct.id
    WHERE ct.depth < 5
  )
  SELECT * FROM comment_tree
  ORDER BY created_at ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_post_comments_nested(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_post_comments_nested(UUID, INTEGER, INTEGER) TO anon;

-- Function: Check if user liked a comment
CREATE OR REPLACE FUNCTION has_user_liked_comment(
  p_user_id UUID,
  p_comment_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM comment_likes
    WHERE user_id = p_user_id AND comment_id = p_comment_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION has_user_liked_comment(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION has_user_liked_comment(UUID, UUID) TO anon;

-- Function: Get user stats
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  stats JSON;
BEGIN
  SELECT json_build_object(
    'listings_count', (
      SELECT COUNT(*) FROM listings WHERE user_id = p_user_id AND status = 'active'
    ),
    'events_count', (
      SELECT COUNT(*) FROM events WHERE created_by = p_user_id
    ),
    'posts_count', (
      SELECT COUNT(*) FROM forum_posts WHERE user_id = p_user_id
    ),
    'garage_count', (
      SELECT COUNT(*) FROM user_garage WHERE user_id = p_user_id
    ),
    'liked_listings_count', (
      SELECT COALESCE(favorite_listings_count, 0) FROM profiles WHERE id = p_user_id
    ),
    'liked_events_count', (
      SELECT COALESCE(favorite_events_count, 0) FROM profiles WHERE id = p_user_id
    )
  ) INTO stats;
  RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_stats(UUID) TO anon;

-- Device token updated_at helper
CREATE OR REPLACE FUNCTION update_device_token_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Notifications helper functions
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (p_user_id, p_type, p_title, p_body, p_data)
  RETURNING id INTO v_notification_id;
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS void AS $$
BEGIN
  UPDATE notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE user_id = auth.uid() AND is_read = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_unread_notification_count()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM notifications
  WHERE user_id = auth.uid() AND is_read = FALSE;
  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_notification_count() TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_notification_count() TO anon;

-- Notification trigger helpers
CREATE OR REPLACE FUNCTION notify_listing_favorited()
RETURNS TRIGGER AS $$
DECLARE
  v_listing_title TEXT;
  v_favoriter_name TEXT;
  v_listing_owner_id UUID;
BEGIN
  SELECT user_id, title INTO v_listing_owner_id, v_listing_title
  FROM listings WHERE id = NEW.listing_id;

  IF v_listing_owner_id IS NULL OR v_listing_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, username, 'Someone') INTO v_favoriter_name
  FROM profiles WHERE id = NEW.user_id;

  PERFORM create_notification(
    v_listing_owner_id,
    'listing_favorited',
    'Your listing was favorited!',
    v_favoriter_name || ' favorited your listing: ' || COALESCE(v_listing_title, 'GT-R'),
    jsonb_build_object(
      'listing_id', NEW.listing_id,
      'user_id', NEW.user_id,
      'favorite_id', NEW.id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_event_rsvp()
RETURNS TRIGGER AS $$
DECLARE
  v_event_title TEXT;
  v_rsvper_name TEXT;
  v_event_creator_id UUID;
BEGIN
  SELECT created_by, title INTO v_event_creator_id, v_event_title
  FROM events WHERE id = NEW.event_id;

  IF v_event_creator_id IS NULL OR v_event_creator_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, username, 'Someone') INTO v_rsvper_name
  FROM profiles WHERE id = NEW.user_id;

  PERFORM create_notification(
    v_event_creator_id,
    'event_rsvp',
    'New RSVP to your event!',
    v_rsvper_name || ' is going to: ' || COALESCE(v_event_title, 'your event'),
    jsonb_build_object(
      'event_id', NEW.event_id,
      'user_id', NEW.user_id,
      'rsvp_id', NEW.id,
      'status', NEW.status
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_event_favorited()
RETURNS TRIGGER AS $$
DECLARE
  v_event_title TEXT;
  v_favoriter_name TEXT;
  v_event_creator_id UUID;
BEGIN
  SELECT created_by, title INTO v_event_creator_id, v_event_title
  FROM events WHERE id = NEW.event_id;

  IF v_event_creator_id IS NULL OR v_event_creator_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, username, 'Someone') INTO v_favoriter_name
  FROM profiles WHERE id = NEW.user_id;

  PERFORM create_notification(
    v_event_creator_id,
    'event_favorited',
    'Your event was favorited!',
    v_favoriter_name || ' favorited your event: ' || COALESCE(v_event_title, 'Event'),
    jsonb_build_object(
      'event_id', NEW.event_id,
      'user_id', NEW.user_id,
      'favorite_id', NEW.id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_forum_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_post_title TEXT;
  v_commenter_name TEXT;
  v_post_owner_id UUID;
BEGIN
  IF NEW.parent_comment_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id, title INTO v_post_owner_id, v_post_title
  FROM forum_posts WHERE id = NEW.post_id;

  IF v_post_owner_id IS NULL OR v_post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, username, 'Someone') INTO v_commenter_name
  FROM profiles WHERE id = NEW.user_id;

  PERFORM create_notification(
    v_post_owner_id,
    'forum_comment',
    'New comment on your post!',
    v_commenter_name || ' commented on: ' || COALESCE(v_post_title, 'your post'),
    jsonb_build_object(
      'post_id', NEW.post_id,
      'comment_id', NEW.id,
      'user_id', NEW.user_id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_forum_reply()
RETURNS TRIGGER AS $$
DECLARE
  v_post_title TEXT;
  v_replier_name TEXT;
  v_comment_owner_id UUID;
BEGIN
  IF NEW.parent_comment_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT title INTO v_post_title FROM forum_posts WHERE id = NEW.post_id;
  SELECT COALESCE(full_name, username, 'Someone') INTO v_replier_name FROM profiles WHERE id = NEW.user_id;
  SELECT user_id INTO v_comment_owner_id FROM forum_comments WHERE id = NEW.parent_comment_id;

  IF v_comment_owner_id IS NOT NULL AND v_comment_owner_id <> NEW.user_id THEN
    PERFORM create_notification(
      v_comment_owner_id,
      'forum_reply',
      'New reply to your comment!',
      v_replier_name || ' replied to your comment on: ' || COALESCE(v_post_title, 'a post'),
      jsonb_build_object(
        'post_id', NEW.post_id,
        'comment_id', NEW.id,
        'parent_comment_id', NEW.parent_comment_id,
        'user_id', NEW.user_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_forum_like()
RETURNS TRIGGER AS $$
DECLARE
  v_post_title TEXT;
  v_liker_name TEXT;
  v_post_owner_id UUID;
BEGIN
  SELECT user_id, title INTO v_post_owner_id, v_post_title
  FROM forum_posts WHERE id = NEW.post_id;

  IF v_post_owner_id IS NULL OR v_post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, username, 'Someone') INTO v_liker_name
  FROM profiles WHERE id = NEW.user_id;

  PERFORM create_notification(
    v_post_owner_id,
    'forum_like',
    'Your post was liked!',
    v_liker_name || ' liked your post: ' || COALESCE(v_post_title, 'Post'),
    jsonb_build_object(
      'post_id', NEW.post_id,
      'user_id', NEW.user_id,
      'like_id', NEW.id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
  v_sender_name TEXT;
  v_message_preview TEXT;
BEGIN
  SELECT COALESCE(full_name, username, 'Someone') INTO v_sender_name
  FROM profiles WHERE id = NEW.sender_id;

  v_message_preview := LEFT(NEW.content, 50);
  IF LENGTH(NEW.content) > 50 THEN
    v_message_preview := v_message_preview || '...';
  END IF;

  PERFORM create_notification(
    NEW.recipient_id,
    'message',
    'New message from ' || v_sender_name,
    v_message_preview,
    jsonb_build_object(
      'conversation_id', NEW.conversation_id,
      'message_id', NEW.id,
      'sender_id', NEW.sender_id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cursor-based pagination for listings
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
    LIMIT p_limit + 1
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
    (SELECT created_at FROM filtered_listings OFFSET p_limit LIMIT 1) AS next_cursor,
    (SELECT COUNT(*) > p_limit FROM filtered_listings) AS has_more
  FROM results r
  ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_listings_cursor(TIMESTAMPTZ, INTEGER, TEXT, TEXT, NUMERIC, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_listings_cursor(TIMESTAMPTZ, INTEGER, TEXT, TEXT, NUMERIC, NUMERIC, TEXT) TO anon;

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
    (SELECT created_at FROM filtered_posts OFFSET p_limit LIMIT 1) AS next_cursor,
    (SELECT COUNT(*) > p_limit FROM filtered_posts) AS has_more
  FROM results r
  ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_forum_posts_cursor(TIMESTAMPTZ, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_forum_posts_cursor(TIMESTAMPTZ, INTEGER, TEXT) TO anon;

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
    (SELECT start_date FROM filtered_events OFFSET p_limit LIMIT 1) AS next_cursor,
    (SELECT COUNT(*) > p_limit FROM filtered_events) AS has_more
  FROM results r
  ORDER BY r.start_date ASC;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_events_cursor(TIMESTAMPTZ, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_events_cursor(TIMESTAMPTZ, INTEGER, TEXT) TO anon;

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
CREATE TRIGGER update_reply_count_on_insert AFTER INSERT ON forum_comments FOR EACH ROW EXECUTE FUNCTION update_comment_reply_count();
CREATE TRIGGER update_reply_count_on_delete AFTER DELETE ON forum_comments FOR EACH ROW EXECUTE FUNCTION update_comment_reply_count();

-- Forum like count triggers
CREATE TRIGGER update_like_count_on_insert AFTER INSERT ON post_likes FOR EACH ROW EXECUTE FUNCTION update_forum_post_like_count();
CREATE TRIGGER update_like_count_on_delete AFTER DELETE ON post_likes FOR EACH ROW EXECUTE FUNCTION update_forum_post_like_count();
CREATE TRIGGER update_comment_like_count_on_insert AFTER INSERT ON comment_likes FOR EACH ROW EXECUTE FUNCTION update_comment_like_count();
CREATE TRIGGER update_comment_like_count_on_delete AFTER DELETE ON comment_likes FOR EACH ROW EXECUTE FUNCTION update_comment_like_count();

-- Event RSVP count triggers
CREATE TRIGGER update_rsvp_count_on_insert AFTER INSERT ON event_rsvps FOR EACH ROW EXECUTE FUNCTION update_event_rsvp_count();
CREATE TRIGGER update_rsvp_count_on_delete AFTER DELETE ON event_rsvps FOR EACH ROW EXECUTE FUNCTION update_event_rsvp_count();

-- Conversation/message triggers
CREATE TRIGGER update_conversation_on_message_insert AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();
CREATE TRIGGER update_conversation_on_message_update AFTER UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- Favorite count triggers
CREATE TRIGGER update_user_favorite_count_on_insert AFTER INSERT ON listing_favorites FOR EACH ROW EXECUTE FUNCTION update_user_favorite_count();
CREATE TRIGGER update_user_favorite_count_on_delete AFTER DELETE ON listing_favorites FOR EACH ROW EXECUTE FUNCTION update_user_favorite_count();
CREATE TRIGGER update_user_favorite_events_count_on_insert AFTER INSERT ON event_favorites FOR EACH ROW EXECUTE FUNCTION update_user_favorite_events_count();
CREATE TRIGGER update_user_favorite_events_count_on_delete AFTER DELETE ON event_favorites FOR EACH ROW EXECUTE FUNCTION update_user_favorite_events_count();

-- Media like count triggers
CREATE TRIGGER update_media_like_count_on_insert AFTER INSERT ON media_likes FOR EACH ROW EXECUTE FUNCTION update_media_like_count();
CREATE TRIGGER update_media_like_count_on_delete AFTER DELETE ON media_likes FOR EACH ROW EXECUTE FUNCTION update_media_like_count();

-- Media comment count triggers
CREATE TRIGGER update_media_comment_count_on_insert AFTER INSERT ON media_comments FOR EACH ROW EXECUTE FUNCTION update_media_comment_count();
CREATE TRIGGER update_media_comment_count_on_delete AFTER DELETE ON media_comments FOR EACH ROW EXECUTE FUNCTION update_media_comment_count();

-- Device token triggers
CREATE TRIGGER update_device_token_updated_at BEFORE UPDATE ON user_device_tokens FOR EACH ROW EXECUTE FUNCTION update_device_token_updated_at();

-- Notification triggers
CREATE TRIGGER trigger_listing_favorited AFTER INSERT ON listing_favorites FOR EACH ROW EXECUTE FUNCTION notify_listing_favorited();
CREATE TRIGGER trigger_event_rsvp AFTER INSERT ON event_rsvps FOR EACH ROW EXECUTE FUNCTION notify_event_rsvp();
CREATE TRIGGER trigger_event_favorited AFTER INSERT ON event_favorites FOR EACH ROW EXECUTE FUNCTION notify_event_favorited();
CREATE TRIGGER trigger_forum_comment AFTER INSERT ON forum_comments FOR EACH ROW EXECUTE FUNCTION notify_forum_comment();
CREATE TRIGGER trigger_forum_reply AFTER INSERT ON forum_comments FOR EACH ROW EXECUTE FUNCTION notify_forum_reply();
CREATE TRIGGER trigger_forum_like AFTER INSERT ON post_likes FOR EACH ROW EXECUTE FUNCTION notify_forum_like();
-- CREATE TRIGGER trigger_new_message AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION notify_new_message();

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
ALTER PUBLICATION supabase_realtime ADD TABLE listing_favorites;
ALTER PUBLICATION supabase_realtime ADD TABLE event_favorites;
ALTER PUBLICATION supabase_realtime ADD TABLE comment_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

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
