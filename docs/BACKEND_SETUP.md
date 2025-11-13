# Supabase Backend Setup Guide for GT-R Marketplace App

This guide covers the complete backend setup for your Nissan GT-R marketplace and community app using Supabase.

## Table of Contents

1. [Initial Supabase Project Setup](#initial-supabase-project-setup)
2. [Database Schema Design](#database-schema-design)
3. [Authentication Configuration](#authentication-configuration)
4. [Storage Buckets Setup](#storage-buckets-setup)
5. [Row Level Security (RLS) Policies](#row-level-security-rls-policies)
6. [Database Migrations](#database-migrations)
7. [API Functions & Triggers](#api-functions--triggers)
   - [Search Functions for Listings](#search-functions-for-listings)
8. [Environment Variables](#environment-variables)

---

## Initial Supabase Project Setup

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in to your account
3. Click "New Project"
4. Fill in:
   - **Project Name**: `gtr-marketplace` (or your preferred name)
   - **Database Password**: Generate a strong password (save it securely)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is fine to start
5. Wait for project to initialize (2-3 minutes)

### Step 2: Get Your Project Credentials

1. Go to Project Settings → API
2. Copy and save:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (for client-side access)
   - **service_role key** (keep secret, server-side only)

---

## Database Schema Design

### Overview

Your app will need these main tables:

- `profiles` - User profiles with GT-R ownership info
- `listings` - Marketplace car listings
- `listing_images` - Images for listings
- `parts_listings` - Parts marketplace (future)
- `forum_posts` - Community forum posts
- `forum_comments` - Comments on forum posts
- `events` - Track days and meets
- `event_rsvps` - RSVP tracking
- `user_garage` - User's GT-R collection showcase
- `saved_searches` - Price alerts and saved searches
- `conversations` - Direct messaging conversations
- `messages` - Direct messages between users
- `model_specs` - Technical specifications by model/year
- `common_issues` - Common issues and fixes database
- `maintenance_schedules` - Maintenance schedules by model/year
- `mod_guides` - Modification guides and tutorials
- `community_media` - Photo/video sharing for community

### Table Definitions

#### 1. Profiles Table

Stores user profile information and GT-R ownership.

```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2. Listings Table (Marketplace)

Main table for GT-R car listings with searchable fields.

```sql
CREATE TABLE listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  model TEXT NOT NULL, -- R32, R33, R34, R35, R36
  year INTEGER NOT NULL, -- Actual year (e.g., 2020)
  price DECIMAL(12, 2) NOT NULL,
  mileage INTEGER,
  description TEXT,
  condition TEXT, -- 'excellent', 'good', 'fair', 'needs_work'
  city TEXT, -- City for location-based search
  state TEXT, -- State/Province for location-based search
  zip_code TEXT, -- Optional zip code
  location TEXT, -- Full address or general location (kept for backward compatibility)
  vin TEXT,
  color TEXT,
  transmission TEXT, -- 'manual', 'automatic', 'dct'
  status TEXT DEFAULT 'active', -- 'active', 'sold', 'pending', 'draft'
  -- Full-text search vector (for PostgreSQL full-text search)
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

-- Basic indexes for performance
CREATE INDEX idx_listings_user_id ON listings(user_id);
CREATE INDEX idx_listings_model ON listings(model);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_created_at ON listings(created_at DESC);
CREATE INDEX idx_listings_price ON listings(price);
CREATE INDEX idx_listings_year ON listings(year);

-- Location-based indexes for search
CREATE INDEX idx_listings_city ON listings(city);
CREATE INDEX idx_listings_state ON listings(state);
CREATE INDEX idx_listings_city_state ON listings(city, state);

-- Full-text search index (GIN index for fast text search)
CREATE INDEX idx_listings_search_vector ON listings USING GIN(search_vector);

-- Composite indexes for common search combinations
CREATE INDEX idx_listings_model_year ON listings(model, year);
CREATE INDEX idx_listings_status_price ON listings(status, price) WHERE status = 'active';
CREATE INDEX idx_listings_state_city_model ON listings(state, city, model) WHERE status = 'active';
```

#### 3. Listing Images Table

Stores image references for listings.

```sql
CREATE TABLE listing_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_listing_images_listing_id ON listing_images(listing_id);
```

#### 4. User Garage Table

Users can showcase their GT-R collection.

```sql
CREATE TABLE user_garage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  model TEXT NOT NULL,
  year INTEGER,
  nickname TEXT,
  description TEXT,
  cover_image_url TEXT,
  mods TEXT[], -- Array of modifications
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_garage_user_id ON user_garage(user_id);
```

#### 5. Forum Posts Table

Community forum posts organized by model year.

```sql
CREATE TABLE forum_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  model TEXT NOT NULL, -- R32, R33, R34, R35, R36
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_urls TEXT[],
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_forum_posts_model ON forum_posts(model);
CREATE INDEX idx_forum_posts_user_id ON forum_posts(user_id);
CREATE INDEX idx_forum_posts_created_at ON forum_posts(created_at DESC);
```

#### 6. Forum Comments Table

Comments on forum posts.

```sql
CREATE TABLE forum_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES forum_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_forum_comments_post_id ON forum_comments(post_id);
CREATE INDEX idx_forum_comments_user_id ON forum_comments(user_id);
```

#### 7. Post Likes Table

Track likes on forum posts.

```sql
CREATE TABLE post_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES forum_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX idx_post_likes_user_id ON post_likes(user_id);
```

#### 8. Events Table

Track days, meets, and shows.

```sql
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL, -- 'track_day', 'meet', 'show'
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

CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_event_type ON events(event_type);
```

#### 9. Event RSVPs Table

Track event RSVPs and check-ins.

```sql
CREATE TABLE event_rsvps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'going', -- 'going', 'maybe', 'not_going'
  checked_in BOOLEAN DEFAULT FALSE,
  checked_in_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX idx_event_rsvps_event_id ON event_rsvps(event_id);
CREATE INDEX idx_event_rsvps_user_id ON event_rsvps(user_id);
```

#### 10. Saved Searches Table

Price alerts and saved marketplace searches.

```sql
CREATE TABLE saved_searches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  search_name TEXT NOT NULL,
  search_query TEXT, -- Full-text search query
  model TEXT,
  min_price DECIMAL(12, 2),
  max_price DECIMAL(12, 2),
  min_year INTEGER,
  max_year INTEGER,
  condition TEXT[],
  city TEXT, -- City filter for saved searches
  state TEXT, -- State filter for saved searches
  location TEXT, -- General location (kept for backward compatibility)
  transmission TEXT[], -- Array of transmission types to filter
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_saved_searches_user_id ON saved_searches(user_id);
```

#### 11. Parts Listings Table (Future)

For parts marketplace integration.

```sql
CREATE TABLE parts_listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  part_name TEXT NOT NULL,
  part_number TEXT,
  compatible_models TEXT[], -- ['R32', 'R33', 'R34']
  price DECIMAL(12, 2) NOT NULL,
  condition TEXT,
  description TEXT,
  image_urls TEXT[],
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_parts_listings_user_id ON parts_listings(user_id);
CREATE INDEX idx_parts_listings_status ON parts_listings(status);
```

#### 12. Conversations Table (Direct Messaging)

Stores conversation threads between users.

```sql
CREATE TABLE conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_preview TEXT,
  user1_unread_count INTEGER DEFAULT 0,
  user2_unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure unique conversation between two users
  UNIQUE(user1_id, user2_id),
  -- Ensure user1_id < user2_id for consistency
  CHECK (user1_id < user2_id)
);

CREATE INDEX idx_conversations_user1_id ON conversations(user1_id);
CREATE INDEX idx_conversations_user2_id ON conversations(user2_id);
CREATE INDEX idx_conversations_last_message_at ON conversations(last_message_at DESC);
```

#### 13. Messages Table (Direct Messaging)

Stores individual messages in conversations.

```sql
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT, -- Optional image attachment
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_is_read ON messages(is_read) WHERE is_read = FALSE;
```

#### 14. Model Specs Table (Tech Database)

Technical specifications by model and year.

```sql
CREATE TABLE model_specs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model TEXT NOT NULL, -- R32, R33, R34, R35, R36
  year INTEGER, -- NULL means applies to all years of that model
  engine TEXT, -- e.g., "RB26DETT", "VR38DETT"
  displacement TEXT, -- e.g., "2.6L", "3.8L"
  horsepower INTEGER,
  torque INTEGER, -- lb-ft
  transmission TEXT, -- e.g., "6-speed manual", "6-speed DCT"
  drivetrain TEXT, -- e.g., "AWD"
  weight INTEGER, -- kg
  length DECIMAL(5, 2), -- mm
  width DECIMAL(5, 2), -- mm
  height DECIMAL(5, 2), -- mm
  wheelbase DECIMAL(5, 2), -- mm
  fuel_capacity DECIMAL(4, 2), -- liters
  mpg_city DECIMAL(4, 1),
  mpg_highway DECIMAL(4, 1),
  acceleration_0_60 DECIMAL(4, 2), -- seconds
  top_speed INTEGER, -- km/h
  additional_specs JSONB, -- For flexible additional specifications
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_model_specs_model ON model_specs(model);
CREATE INDEX idx_model_specs_model_year ON model_specs(model, year);
```

#### 15. Common Issues Table (Tech Database)

Common issues and their fixes organized by model.

```sql
CREATE TABLE common_issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model TEXT NOT NULL, -- R32, R33, R34, R35, R36 (NULL = all models)
  year_range TEXT, -- e.g., "2007-2010", NULL = all years
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  symptoms TEXT[], -- Array of symptoms
  severity TEXT, -- 'critical', 'major', 'minor', 'cosmetic'
  affected_systems TEXT[], -- e.g., ['engine', 'transmission', 'electrical']
  solution TEXT NOT NULL,
  parts_needed TEXT[], -- Array of parts that may be needed
  estimated_cost_min DECIMAL(10, 2),
  estimated_cost_max DECIMAL(10, 2),
  difficulty_level TEXT, -- 'easy', 'moderate', 'difficult', 'expert'
  related_issues UUID[], -- Array of related issue IDs
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_common_issues_model ON common_issues(model);
CREATE INDEX idx_common_issues_severity ON common_issues(severity);
CREATE INDEX idx_common_issues_view_count ON common_issues(view_count DESC);
```

#### 16. Maintenance Schedules Table (Tech Database)

Maintenance schedules by model and mileage intervals.

```sql
CREATE TABLE maintenance_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model TEXT NOT NULL, -- R32, R33, R34, R35, R36
  year_range TEXT, -- e.g., "2007-2010", NULL = all years
  service_type TEXT NOT NULL, -- 'routine', 'major', 'inspection'
  mileage_interval INTEGER, -- e.g., 5000, 10000 (NULL = time-based)
  time_interval_months INTEGER, -- e.g., 6, 12 (NULL = mileage-based)
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  tasks TEXT[] NOT NULL, -- Array of tasks to perform
  parts_needed TEXT[], -- Array of parts needed
  estimated_cost DECIMAL(10, 2),
  difficulty_level TEXT, -- 'easy', 'moderate', 'difficult', 'expert'
  is_critical BOOLEAN DEFAULT FALSE, -- Critical for vehicle safety/performance
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_maintenance_schedules_model ON maintenance_schedules(model);
CREATE INDEX idx_maintenance_schedules_mileage_interval ON maintenance_schedules(mileage_interval);
CREATE INDEX idx_maintenance_schedules_is_critical ON maintenance_schedules(is_critical) WHERE is_critical = TRUE;
```

#### 17. Mod Guides Table (Tech Database)

Modification guides and tutorials.

```sql
CREATE TABLE mod_guides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model TEXT NOT NULL, -- R32, R33, R34, R35, R36 (NULL = all models)
  year_range TEXT, -- e.g., "2007-2010", NULL = all years
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- 'engine', 'suspension', 'exhaust', 'interior', 'exterior', 'electronics', 'other'
  difficulty_level TEXT, -- 'beginner', 'intermediate', 'advanced', 'expert'
  estimated_time_hours INTEGER,
  estimated_cost_min DECIMAL(10, 2),
  estimated_cost_max DECIMAL(10, 2),
  horsepower_gain INTEGER, -- Estimated HP gain
  torque_gain INTEGER, -- Estimated torque gain
  content TEXT NOT NULL, -- Full guide content (markdown supported)
  steps JSONB, -- Array of step-by-step instructions
  parts_list JSONB, -- Array of required parts
  tools_needed TEXT[], -- Array of tools needed
  images TEXT[], -- Array of image URLs
  videos TEXT[], -- Array of video URLs
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  rating_average DECIMAL(3, 2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mod_guides_model ON mod_guides(model);
CREATE INDEX idx_mod_guides_category ON mod_guides(category);
CREATE INDEX idx_mod_guides_difficulty ON mod_guides(difficulty_level);
CREATE INDEX idx_mod_guides_view_count ON mod_guides(view_count DESC);
CREATE INDEX idx_mod_guides_rating ON mod_guides(rating_average DESC);
```

#### 18. Community Media Table

Photo/video sharing for community posts (separate from forum posts).

```sql
CREATE TABLE community_media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  model TEXT, -- Associated GT-R model (optional)
  title TEXT,
  description TEXT,
  media_type TEXT NOT NULL, -- 'image', 'video'
  media_url TEXT NOT NULL,
  thumbnail_url TEXT, -- For videos
  storage_path TEXT NOT NULL,
  file_size INTEGER, -- bytes
  duration INTEGER, -- seconds (for videos)
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  tags TEXT[], -- Array of tags
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_community_media_user_id ON community_media(user_id);
CREATE INDEX idx_community_media_model ON community_media(model);
CREATE INDEX idx_community_media_media_type ON community_media(media_type);
CREATE INDEX idx_community_media_created_at ON community_media(created_at DESC);
CREATE INDEX idx_community_media_like_count ON community_media(like_count DESC);
```

#### 19. Media Likes Table

Likes on community media posts.

```sql
CREATE TABLE media_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  media_id UUID REFERENCES community_media(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(media_id, user_id)
);

CREATE INDEX idx_media_likes_media_id ON media_likes(media_id);
CREATE INDEX idx_media_likes_user_id ON media_likes(user_id);
```

#### 20. Media Comments Table

Comments on community media posts.

```sql
CREATE TABLE media_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  media_id UUID REFERENCES community_media(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_media_comments_media_id ON media_comments(media_id);
CREATE INDEX idx_media_comments_user_id ON media_comments(user_id);
CREATE INDEX idx_media_comments_created_at ON media_comments(created_at DESC);
```

---

## Authentication Configuration

### Step 1: Enable Email Authentication

1. Go to Authentication → Providers
2. Enable "Email" provider
3. Configure:
   - **Enable email confirmations**: Toggle ON (recommended for production)
   - **Secure email change**: Toggle ON
   - **Double confirm email changes**: Toggle ON

### Step 2: Configure Email Templates (Optional)

1. Go to Authentication → Email Templates
2. Customize templates for:
   - Confirm signup
   - Magic Link
   - Change Email Address
   - Reset Password

### Step 3: Set Up OAuth Providers (Optional - Future)

- Google OAuth
- Apple Sign In (for iOS)
- GitHub (for developers)

---

## Storage Buckets Setup

### Step 1: Create Storage Buckets

Go to Storage → Create Bucket

#### Bucket 1: `listing-images`

- **Public bucket**: YES (so images can be accessed)
- **File size limit**: 10 MB
- **Allowed MIME types**: `image/jpeg, image/png, image/webp`

#### Bucket 2: `avatars`

- **Public bucket**: YES
- **File size limit**: 2 MB
- **Allowed MIME types**: `image/jpeg, image/png, image/webp`

#### Bucket 3: `forum-images`

- **Public bucket**: YES
- **File size limit**: 5 MB
- **Allowed MIME types**: `image/jpeg, image/png, image/webp`

#### Bucket 4: `garage-images`

- **Public bucket**: YES
- **File size limit**: 10 MB
- **Allowed MIME types**: `image/jpeg, image/png, image/webp`

#### Bucket 5: `event-images`

- **Public bucket**: YES
- **File size limit**: 5 MB
- **Allowed MIME types**: `image/jpeg, image/png, image/webp`

#### Bucket 6: `message-images`

- **Public bucket**: NO (private - only conversation participants can access)
- **File size limit**: 5 MB
- **Allowed MIME types**: `image/jpeg, image/png, image/webp`

#### Bucket 7: `community-media`

- **Public bucket**: YES
- **File size limit**: 50 MB (for videos)
- **Allowed MIME types**: `image/jpeg, image/png, image/webp, video/mp4, video/quicktime`

### Step 2: Storage Policies

Create policies for each bucket (see RLS section below).

---

## Row Level Security (RLS) Policies

Enable RLS on all tables and create policies:

### Profiles Table Policies

```sql
-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
```

### Listings Table Policies

```sql
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

-- Anyone can view active listings
CREATE POLICY "Active listings are viewable by everyone"
  ON listings FOR SELECT
  USING (status = 'active');

-- Users can view their own listings (all statuses)
CREATE POLICY "Users can view their own listings"
  ON listings FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create listings
CREATE POLICY "Users can create listings"
  ON listings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own listings
CREATE POLICY "Users can update their own listings"
  ON listings FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own listings
CREATE POLICY "Users can delete their own listings"
  ON listings FOR DELETE
  USING (auth.uid() = user_id);
```

### Listing Images Policies

```sql
ALTER TABLE listing_images ENABLE ROW LEVEL SECURITY;

-- Anyone can view listing images
CREATE POLICY "Listing images are viewable by everyone"
  ON listing_images FOR SELECT
  USING (true);

-- Users can insert images for their listings
CREATE POLICY "Users can insert images for their listings"
  ON listing_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_images.listing_id
      AND listings.user_id = auth.uid()
    )
  );

-- Users can delete images from their listings
CREATE POLICY "Users can delete images from their listings"
  ON listing_images FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_images.listing_id
      AND listings.user_id = auth.uid()
    )
  );
```

### Storage Bucket Policies

#### listing-images bucket:

```sql
-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload listing images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'listing-images');

-- Allow authenticated users to update their own images
CREATE POLICY "Users can update their own listing images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own images
CREATE POLICY "Users can delete their own listing images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read access
CREATE POLICY "Public can view listing images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'listing-images');
```

#### avatars bucket:

```sql
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
```

### Forum Posts Policies

```sql
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Forum posts are viewable by everyone"
  ON forum_posts FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create forum posts"
  ON forum_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own forum posts"
  ON forum_posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own forum posts"
  ON forum_posts FOR DELETE
  USING (auth.uid() = user_id);
```

### Forum Comments Policies

```sql
ALTER TABLE forum_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Forum comments are viewable by everyone"
  ON forum_comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON forum_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON forum_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON forum_comments FOR DELETE
  USING (auth.uid() = user_id);
```

### Post Likes Policies

```sql
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Post likes are viewable by everyone"
  ON post_likes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can like posts"
  ON post_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts"
  ON post_likes FOR DELETE
  USING (auth.uid() = user_id);
```

### User Garage Policies

```sql
ALTER TABLE user_garage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User garage is viewable by everyone"
  ON user_garage FOR SELECT
  USING (true);

CREATE POLICY "Users can add to their garage"
  ON user_garage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their garage"
  ON user_garage FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete from their garage"
  ON user_garage FOR DELETE
  USING (auth.uid() = user_id);
```

### Events Policies

```sql
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events are viewable by everyone"
  ON events FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Event creators can update their events"
  ON events FOR UPDATE
  USING (auth.uid() = created_by);
```

### Event RSVPs Policies

```sql
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "RSVPs are viewable by everyone"
  ON event_rsvps FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can RSVP"
  ON event_rsvps FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their RSVP"
  ON event_rsvps FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their RSVP"
  ON event_rsvps FOR DELETE
  USING (auth.uid() = user_id);
```

### Saved Searches Policies

```sql
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved searches"
  ON saved_searches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create saved searches"
  ON saved_searches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their saved searches"
  ON saved_searches FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their saved searches"
  ON saved_searches FOR DELETE
  USING (auth.uid() = user_id);
```

### Conversations Policies

```sql
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can update their own conversations"
  ON conversations FOR UPDATE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);
```

### Messages Policies

```sql
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.user1_id = auth.uid() OR conversations.user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.user1_id = auth.uid() OR conversations.user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can update their own sent messages"
  ON messages FOR UPDATE
  USING (auth.uid() = sender_id);

CREATE POLICY "Recipients can mark messages as read"
  ON messages FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);
```

### Model Specs Policies

```sql
ALTER TABLE model_specs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Model specs are viewable by everyone"
  ON model_specs FOR SELECT
  USING (true);

-- Only admins can create/update specs (you'll need to add an admin role check)
-- For now, allow authenticated users
CREATE POLICY "Authenticated users can create specs"
  ON model_specs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update specs"
  ON model_specs FOR UPDATE
  TO authenticated
  USING (true);
```

### Common Issues Policies

```sql
ALTER TABLE common_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Common issues are viewable by everyone"
  ON common_issues FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create issues"
  ON common_issues FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their own issues"
  ON common_issues FOR UPDATE
  USING (auth.uid() = created_by OR created_by IS NULL);

CREATE POLICY "Users can delete their own issues"
  ON common_issues FOR DELETE
  USING (auth.uid() = created_by);
```

### Maintenance Schedules Policies

```sql
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Maintenance schedules are viewable by everyone"
  ON maintenance_schedules FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create schedules"
  ON maintenance_schedules FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update schedules"
  ON maintenance_schedules FOR UPDATE
  TO authenticated
  USING (true);
```

### Mod Guides Policies

```sql
ALTER TABLE mod_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mod guides are viewable by everyone"
  ON mod_guides FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create mod guides"
  ON mod_guides FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own mod guides"
  ON mod_guides FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own mod guides"
  ON mod_guides FOR DELETE
  USING (auth.uid() = created_by);
```

### Community Media Policies

```sql
ALTER TABLE community_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Community media is viewable by everyone"
  ON community_media FOR SELECT
  USING (true);

CREATE POLICY "Users can create media posts"
  ON community_media FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own media posts"
  ON community_media FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own media posts"
  ON community_media FOR DELETE
  USING (auth.uid() = user_id);
```

### Media Likes Policies

```sql
ALTER TABLE media_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Media likes are viewable by everyone"
  ON media_likes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can like media"
  ON media_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike media"
  ON media_likes FOR DELETE
  USING (auth.uid() = user_id);
```

### Media Comments Policies

```sql
ALTER TABLE media_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Media comments are viewable by everyone"
  ON media_comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON media_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON media_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON media_comments FOR DELETE
  USING (auth.uid() = user_id);
```

---

## Database Migrations

### Quick Setup: Use Consolidated Script

**For fastest setup, use the consolidated SQL script: `setup_complete.sql`**

This single file contains all SQL statements in the correct order:

1. All table creations
2. All indexes
3. All RLS policies
4. All functions
5. All triggers
6. Real-time subscriptions

Simply copy the entire `setup_complete.sql` file and paste it into Supabase SQL Editor, then run it.

### Step 1: Create Migration Files (Alternative - Manual Setup)

In Supabase Dashboard:

1. Go to SQL Editor
2. Create a new query
3. Copy all the CREATE TABLE statements from above
4. Copy all the RLS policies
5. Execute them in order

### Step 2: Create Helper Functions

#### Function: Update updated_at timestamp

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_listings_updated_at BEFORE UPDATE ON listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_forum_posts_updated_at BEFORE UPDATE ON forum_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_garage_updated_at BEFORE UPDATE ON user_garage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### Function: Create profile on signup

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

#### Function: Update comment count on forum posts

```sql
CREATE OR REPLACE FUNCTION update_forum_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE forum_posts
    SET comment_count = comment_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE forum_posts
    SET comment_count = comment_count - 1
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_comment_count_on_insert
  AFTER INSERT ON forum_comments
  FOR EACH ROW EXECUTE FUNCTION update_forum_post_comment_count();

CREATE TRIGGER update_comment_count_on_delete
  AFTER DELETE ON forum_comments
  FOR EACH ROW EXECUTE FUNCTION update_forum_post_comment_count();
```

#### Function: Update like count on forum posts

```sql
CREATE OR REPLACE FUNCTION update_forum_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE forum_posts
    SET like_count = like_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE forum_posts
    SET like_count = like_count - 1
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_like_count_on_insert
  AFTER INSERT ON post_likes
  FOR EACH ROW EXECUTE FUNCTION update_forum_post_like_count();

CREATE TRIGGER update_like_count_on_delete
  AFTER DELETE ON post_likes
  FOR EACH ROW EXECUTE FUNCTION update_forum_post_like_count();
```

#### Function: Update RSVP count on events

```sql
CREATE OR REPLACE FUNCTION update_event_rsvp_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE events
    SET rsvp_count = rsvp_count + 1
    WHERE id = NEW.event_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE events
    SET rsvp_count = rsvp_count - 1
    WHERE id = OLD.event_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rsvp_count_on_insert
  AFTER INSERT ON event_rsvps
  FOR EACH ROW EXECUTE FUNCTION update_event_rsvp_count();

CREATE TRIGGER update_rsvp_count_on_delete
  AFTER DELETE ON event_rsvps
  FOR EACH ROW EXECUTE FUNCTION update_event_rsvp_count();
```

#### Function: Update conversation last message and unread counts

```sql
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Update conversation last message info
    UPDATE conversations
    SET
      last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.content, 100),
      user1_unread_count = CASE
        WHEN conversations.user1_id = NEW.recipient_id THEN user1_unread_count + 1
        ELSE user1_unread_count
      END,
      user2_unread_count = CASE
        WHEN conversations.user2_id = NEW.recipient_id THEN user2_unread_count + 1
        ELSE user2_unread_count
      END,
      updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If message is marked as read, decrease unread count
    IF OLD.is_read = FALSE AND NEW.is_read = TRUE THEN
      UPDATE conversations
      SET
        user1_unread_count = CASE
          WHEN user1_id = NEW.recipient_id AND user1_unread_count > 0 THEN user1_unread_count - 1
          ELSE user1_unread_count
        END,
        user2_unread_count = CASE
          WHEN user2_id = NEW.recipient_id AND user2_unread_count > 0 THEN user2_unread_count - 1
          ELSE user2_unread_count
        END
      WHERE id = NEW.conversation_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_on_message_insert
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

CREATE TRIGGER update_conversation_on_message_update
  AFTER UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();
```

#### Function: Update media like count

```sql
CREATE OR REPLACE FUNCTION update_media_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_media
    SET like_count = like_count + 1
    WHERE id = NEW.media_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_media
    SET like_count = like_count - 1
    WHERE id = OLD.media_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_media_like_count_on_insert
  AFTER INSERT ON media_likes
  FOR EACH ROW EXECUTE FUNCTION update_media_like_count();

CREATE TRIGGER update_media_like_count_on_delete
  AFTER DELETE ON media_likes
  FOR EACH ROW EXECUTE FUNCTION update_media_like_count();
```

#### Function: Update media comment count

```sql
CREATE OR REPLACE FUNCTION update_media_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_media
    SET comment_count = comment_count + 1
    WHERE id = NEW.media_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_media
    SET comment_count = comment_count - 1
    WHERE id = OLD.media_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_media_comment_count_on_insert
  AFTER INSERT ON media_comments
  FOR EACH ROW EXECUTE FUNCTION update_media_comment_count();

CREATE TRIGGER update_media_comment_count_on_delete
  AFTER DELETE ON media_comments
  FOR EACH ROW EXECUTE FUNCTION update_media_comment_count();
```

---

## API Functions & Triggers

### Real-time Subscriptions (Optional)

Enable real-time for tables that need live updates:

```sql
-- Enable real-time for listings
ALTER PUBLICATION supabase_realtime ADD TABLE listings;

-- Enable real-time for forum_posts
ALTER PUBLICATION supabase_realtime ADD TABLE forum_posts;

-- Enable real-time for forum_comments
ALTER PUBLICATION supabase_realtime ADD TABLE forum_comments;

-- Enable real-time for events
ALTER PUBLICATION supabase_realtime ADD TABLE events;

-- Enable real-time for direct messaging
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Enable real-time for community media
ALTER PUBLICATION supabase_realtime ADD TABLE community_media;
ALTER PUBLICATION supabase_realtime ADD TABLE media_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE media_comments;
```

### Search Functions for Listings

Create a comprehensive search function that handles multiple search criteria:

```sql
-- Search function for listings with multiple filters
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
  search_rank REAL
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
    CASE
      WHEN search_query IS NOT NULL THEN ts_rank(l.search_vector, plainto_tsquery('english', search_query))
      ELSE 0::REAL
    END as search_rank
  FROM listings l
  WHERE
    l.status = 'active'
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
  ORDER BY
    CASE WHEN search_query IS NOT NULL THEN search_rank ELSE 0 END DESC,
    l.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_listings TO authenticated;
GRANT EXECUTE ON FUNCTION search_listings TO anon;
```

### Search Query Examples

Here are example queries you can use in your frontend:

#### 1. Full-text search (searches title, description, city, state, model, color)

```sql
-- Search for "red R35" - will match listings with "red" in title/description and R35 model
SELECT * FROM search_listings(search_query := 'red R35');
```

#### 2. Search by model and year range

```sql
-- Find R35 models from 2015-2020
SELECT * FROM search_listings(
  model_filter := 'R35',
  year_min := 2015,
  year_max := 2020
);
```

#### 3. Search by price range

```sql
-- Find listings between $50,000 and $100,000
SELECT * FROM search_listings(
  price_min := 50000,
  price_max := 100000
);
```

#### 4. Search by location

```sql
-- Find listings in California
SELECT * FROM search_listings(state_filter := 'California');

-- Find listings in Los Angeles
SELECT * FROM search_listings(city_filter := 'Los Angeles');
```

#### 5. Combined search with multiple filters

```sql
-- Find R35 models in California, priced between $60k-$80k, from 2018-2020
SELECT * FROM search_listings(
  search_query := 'R35',
  model_filter := 'R35',
  year_min := 2018,
  year_max := 2020,
  price_min := 60000,
  price_max := 80000,
  state_filter := 'California'
);
```

#### 6. Using Supabase client (JavaScript/TypeScript example)

```typescript
// In your frontend code, you can call the function like this:
const { data, error } = await supabase.rpc("search_listings", {
  search_query: "red R35",
  model_filter: "R35",
  year_min: 2015,
  year_max: 2020,
  price_min: 50000,
  price_max: 100000,
  city_filter: "Los Angeles",
  state_filter: "California",
  condition_filter: "excellent",
  transmission_filter: "dct",
  limit_count: 20,
  offset_count: 0,
});
```

### Alternative: Direct Supabase Query Approach

If you prefer not to use a function, you can build queries directly:

```typescript
// Example: Search with multiple filters using Supabase client
const buildSearchQuery = (filters: {
  searchText?: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  priceMin?: number;
  priceMax?: number;
  city?: string;
  state?: string;
  condition?: string;
  transmission?: string;
}) => {
  let query = supabase
    .from("listings")
    .select("*, listing_images(*), profiles:user_id(username, avatar_url)")
    .eq("status", "active");

  // Full-text search
  if (filters.searchText) {
    query = query.textSearch("search_vector", filters.searchText, {
      type: "plain",
      config: "english",
    });
  }

  // Model filter
  if (filters.model) {
    query = query.eq("model", filters.model);
  }

  // Year range
  if (filters.yearMin) {
    query = query.gte("year", filters.yearMin);
  }
  if (filters.yearMax) {
    query = query.lte("year", filters.yearMax);
  }

  // Price range
  if (filters.priceMin) {
    query = query.gte("price", filters.priceMin);
  }
  if (filters.priceMax) {
    query = query.lte("price", filters.priceMax);
  }

  // Location filters
  if (filters.city) {
    query = query.ilike("city", `%${filters.city}%`);
  }
  if (filters.state) {
    query = query.ilike("state", `%${filters.state}%`);
  }

  // Condition filter
  if (filters.condition) {
    query = query.eq("condition", filters.condition);
  }

  // Transmission filter
  if (filters.transmission) {
    query = query.eq("transmission", filters.transmission);
  }

  return query.order("created_at", { ascending: false });
};
```

### Search Performance Tips

1. **Use indexes**: The indexes we created will speed up searches significantly
2. **Limit results**: Always use LIMIT to prevent large result sets
3. **Pagination**: Use OFFSET for pagination, but consider cursor-based pagination for better performance
4. **Full-text search**: Use the `search_vector` column for text searches - it's much faster than LIKE queries
5. **Combine filters**: Use multiple filters together to narrow results and improve performance

---

## Environment Variables

Create a `.env` file in your Expo project root (you'll do this in the frontend setup):

```env
EXPO_PUBLIC_SUPABASE_URL=your_project_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

**Important**: Never commit your `service_role` key to your client-side code. Only use it in server-side functions or edge functions.

---

## Testing Your Setup

### Test Checklist:

1. ✅ Create a test user via Supabase Auth
2. ✅ Verify profile is auto-created
3. ✅ Create a test listing
4. ✅ Upload an image to storage
5. ✅ Verify RLS policies work (try accessing another user's draft listing)
6. ✅ Test forum post creation
7. ✅ Test comment creation
8. ✅ Test like functionality

### SQL Queries for Testing:

```sql
-- Check if profiles are being created
SELECT * FROM profiles;

-- Check listings
SELECT * FROM listings;

-- Test RLS by checking what a user can see
SET ROLE authenticated;
SET request.jwt.claim.sub = 'user-uuid-here';
SELECT * FROM listings;
```

---

## Next Steps

Once your backend is set up:

1. Test all the policies manually
2. Set up your Expo project (see DAYS_1-3_SETUP.md)
3. Install Supabase client library in Expo
4. Connect your app to Supabase
5. Start building the frontend features

---

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Storage Guide](https://supabase.com/docs/guides/storage)
- [Supabase Realtime Guide](https://supabase.com/docs/guides/realtime)

---

## Notes

- **Security**: Always test your RLS policies thoroughly
- **Performance**: Indexes are already included in the schema
- **Scalability**: Consider adding pagination to your queries
- **Backups**: Enable automatic backups in Supabase dashboard
- **Monitoring**: Set up alerts for database performance in Supabase dashboard
