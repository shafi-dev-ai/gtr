


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb" DEFAULT NULL::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (p_user_id, p_type, p_title, p_body, p_data)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;


ALTER FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_event_capacity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  target_event uuid := coalesce(new.event_id, old.event_id);
  max_spots int;
  current_going int;
begin
  select max_attendees into max_spots from events where id = target_event;
  if max_spots is null then
    return new; -- open event
  end if;

  select count(*) into current_going
  from event_rsvps
  where event_id = target_event
    and status = 'going';

  -- If update flips to 'going', account for that change
  if tg_op = 'UPDATE' and old.status != 'going' and new.status = 'going' then
    current_going := current_going + 1;
  elsif tg_op = 'INSERT' and new.status = 'going' then
    current_going := current_going + 1;
  elsif tg_op = 'UPDATE' and old.status = 'going' and new.status != 'going' then
    return new; -- freeing a spot
  elsif tg_op = 'DELETE' then
    return old; -- handled elsewhere
  end if;

  if max_spots is not null and current_going > max_spots then
    raise exception 'Event is full' using errcode = 'P0001';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_event_capacity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_comment_replies"("p_comment_id" "uuid", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "post_id" "uuid", "user_id" "uuid", "content" "text", "parent_comment_id" "uuid", "reply_count" integer, "like_count" integer, "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_comment_replies"("p_comment_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_events_cursor"("p_cursor" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_limit" integer DEFAULT 10, "p_location" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "created_by" "uuid", "title" "text", "description" "text", "location" "text", "start_date" timestamp with time zone, "created_at" timestamp with time zone, "next_cursor" timestamp with time zone, "has_more" boolean)
    LANGUAGE "plpgsql" STABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."get_events_cursor"("p_cursor" timestamp with time zone, "p_limit" integer, "p_location" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_forum_posts_cursor"("p_cursor" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_limit" integer DEFAULT 10, "p_model" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "title" "text", "content" "text", "model" "text", "created_at" timestamp with time zone, "next_cursor" timestamp with time zone, "has_more" boolean)
    LANGUAGE "plpgsql" STABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."get_forum_posts_cursor"("p_cursor" timestamp with time zone, "p_limit" integer, "p_model" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_listings_cursor"("p_cursor" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_limit" integer DEFAULT 10, "p_city" "text" DEFAULT NULL::"text", "p_state" "text" DEFAULT NULL::"text", "p_min_price" numeric DEFAULT NULL::numeric, "p_max_price" numeric DEFAULT NULL::numeric, "p_model" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "title" "text", "description" "text", "price" numeric, "city" "text", "state" "text", "model" "text", "status" "text", "created_at" timestamp with time zone, "next_cursor" timestamp with time zone, "has_more" boolean)
    LANGUAGE "plpgsql" STABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."get_listings_cursor"("p_cursor" timestamp with time zone, "p_limit" integer, "p_city" "text", "p_state" "text", "p_min_price" numeric, "p_max_price" numeric, "p_model" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_post_comments_nested"("p_post_id" "uuid", "p_limit" integer DEFAULT 100, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "post_id" "uuid", "user_id" "uuid", "content" "text", "parent_comment_id" "uuid", "reply_count" integer, "like_count" integer, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "depth" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE comment_tree AS (
    -- Base case: top-level comments (no parent)
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
      0 as depth
    FROM forum_comments c
    WHERE c.post_id = p_post_id 
      AND c.parent_comment_id IS NULL
    
    UNION ALL
    
    -- Recursive case: replies to comments
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
    WHERE ct.depth < 5  -- Limit nesting depth to prevent infinite recursion
  )
  SELECT * FROM comment_tree
  ORDER BY created_at ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."get_post_comments_nested"("p_post_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unread_notification_count"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM notifications
  WHERE user_id = auth.uid() AND is_read = FALSE;
  
  RETURN COALESCE(v_count, 0);
END;
$$;


ALTER FUNCTION "public"."get_unread_notification_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_favorite_events"("p_user_id" "uuid", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "created_by" "uuid", "title" "text", "description" "text", "event_type" "text", "location" "text", "latitude" numeric, "longitude" numeric, "start_date" timestamp with time zone, "end_date" timestamp with time zone, "rsvp_count" integer, "max_attendees" integer, "cover_image_url" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "favorited_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_user_favorite_events"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_favorite_listings"("p_user_id" "uuid", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "user_id" "uuid", "title" "text", "model" "text", "year" integer, "price" numeric, "mileage" integer, "description" "text", "condition" "text", "city" "text", "state" "text", "zip_code" "text", "location" "text", "vin" "text", "color" "text", "transmission" "text", "status" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "favorited_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_user_favorite_listings"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_stats"("p_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."get_user_stats"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$DECLARE
  raw_user jsonb;
  raw_app jsonb;
BEGIN
  raw_user := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  raw_app := COALESCE(NEW.raw_app_meta_data, '{}'::jsonb);

  BEGIN
    INSERT INTO public.profiles (id, username, full_name, email, avatar_url, phone_number, created_at, updated_at)
    VALUES (
      NEW.id,
      COALESCE(raw_user->> 'username', raw_user->> 'preferred_username', raw_user->> 'user_name', NULL),
      COALESCE(
        raw_user->> 'full_name',
        raw_user->> 'name',
        CASE WHEN raw_user->> 'given_name' IS NOT NULL THEN TRIM(COALESCE(raw_user->> 'given_name','') || ' ' || COALESCE(raw_user->> 'family_name','')) ELSE NULL END,
        raw_user->> 'display_name',
        raw_app->> 'full_name',
        raw_app->> 'name',
        ''
      ),
      COALESCE(NEW.email, ''),
      COALESCE(
        raw_user->> 'avatar_url',
        raw_user->> 'picture',
        raw_user->> 'avatar',
        raw_app->> 'avatar_url',
        raw_app->> 'picture',
        NULL
      ),
      COALESCE(raw_user->> 'phone_number', NEW.phone, NULL),
      NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      username = EXCLUDED.username,
      full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
      email = COALESCE(NULLIF(EXCLUDED.email, ''), profiles.email),
      avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
      phone_number = COALESCE(EXCLUDED.phone_number, profiles.phone_number),
      updated_at = NOW();

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.profile_creation_errors (user_id, error_message) VALUES (NEW.id, SQLERRM);
    RAISE NOTICE 'Profile creation failed for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_user_favorited_event"("p_user_id" "uuid", "p_event_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM event_favorites 
    WHERE user_id = p_user_id 
      AND event_id = p_event_id
  );
END;
$$;


ALTER FUNCTION "public"."has_user_favorited_event"("p_user_id" "uuid", "p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_user_favorited_listing"("p_user_id" "uuid", "p_listing_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM listing_favorites 
    WHERE user_id = p_user_id 
      AND listing_id = p_listing_id
  );
END;
$$;


ALTER FUNCTION "public"."has_user_favorited_listing"("p_user_id" "uuid", "p_listing_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_user_liked_comment"("p_user_id" "uuid", "p_comment_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM comment_likes 
    WHERE user_id = p_user_id 
      AND comment_id = p_comment_id
  );
END;
$$;


ALTER FUNCTION "public"."has_user_liked_comment"("p_user_id" "uuid", "p_comment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_all_notifications_read"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE user_id = auth.uid() AND is_read = FALSE;
END;
$$;


ALTER FUNCTION "public"."mark_all_notifications_read"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$;


ALTER FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_event_favorited"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_event_title TEXT;
  v_favoriter_name TEXT;
  v_event_creator_id UUID;
BEGIN
  -- Get event creator and title
  SELECT created_by, title INTO v_event_creator_id, v_event_title
  FROM events
  WHERE id = NEW.event_id;
  
  -- Only notify if favoriter is not the event creator
  IF v_event_creator_id IS NULL OR v_event_creator_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get favoriter's name
  SELECT COALESCE(full_name, username, 'Someone') INTO v_favoriter_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Create notification for event creator
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
$$;


ALTER FUNCTION "public"."notify_event_favorited"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_event_rsvp"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_event_title TEXT;
  v_rsvper_name TEXT;
  v_event_creator_id UUID;
BEGIN
  -- Get event creator and title
  SELECT created_by, title INTO v_event_creator_id, v_event_title
  FROM events
  WHERE id = NEW.event_id;
  
  -- Only notify if RSVPer is not the event creator
  IF v_event_creator_id IS NULL OR v_event_creator_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get RSVPer's name
  SELECT COALESCE(full_name, username, 'Someone') INTO v_rsvper_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Create notification for event creator
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
$$;


ALTER FUNCTION "public"."notify_event_rsvp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_forum_comment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_post_title TEXT;
  v_commenter_name TEXT;
  v_post_owner_id UUID;
BEGIN
  -- Only notify for top-level comments (not replies)
  IF NEW.parent_comment_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get post owner and title
  SELECT user_id, title INTO v_post_owner_id, v_post_title
  FROM forum_posts
  WHERE id = NEW.post_id;
  
  -- Only notify if commenter is not the post owner
  IF v_post_owner_id IS NULL OR v_post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get commenter's name
  SELECT COALESCE(full_name, username, 'Someone') INTO v_commenter_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Create notification for post owner
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
$$;


ALTER FUNCTION "public"."notify_forum_comment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_forum_like"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_post_title TEXT;
  v_liker_name TEXT;
  v_post_owner_id UUID;
BEGIN
  -- Get post owner and title
  SELECT user_id, title INTO v_post_owner_id, v_post_title
  FROM forum_posts
  WHERE id = NEW.post_id;
  
  -- Only notify if liker is not the post owner
  IF v_post_owner_id IS NULL OR v_post_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get liker's name
  SELECT COALESCE(full_name, username, 'Someone') INTO v_liker_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Create notification for post owner
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
$$;


ALTER FUNCTION "public"."notify_forum_like"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_forum_reply"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_post_title TEXT;
  v_replier_name TEXT;
  v_comment_owner_id UUID;
BEGIN
  -- Only notify if this is a reply (has parent_comment_id)
  IF NEW.parent_comment_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get post title
  SELECT title INTO v_post_title
  FROM forum_posts
  WHERE id = NEW.post_id;
  
  -- Get replier's name
  SELECT COALESCE(full_name, username, 'Someone') INTO v_replier_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Get original comment owner
  SELECT user_id INTO v_comment_owner_id
  FROM forum_comments
  WHERE id = NEW.parent_comment_id;
  
  -- Only notify if replying to someone else's comment
  IF v_comment_owner_id != NEW.user_id THEN
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
$$;


ALTER FUNCTION "public"."notify_forum_reply"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_listing_favorited"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_listing_title TEXT;
  v_favoriter_name TEXT;
  v_listing_owner_id UUID;
BEGIN
  -- Get listing owner and title
  SELECT user_id, title INTO v_listing_owner_id, v_listing_title
  FROM listings
  WHERE id = NEW.listing_id;
  
  -- Only notify if favoriter is not the listing owner
  IF v_listing_owner_id IS NULL OR v_listing_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get favoriter's name
  SELECT COALESCE(full_name, username, 'Someone') INTO v_favoriter_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Create notification for listing owner
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
$$;


ALTER FUNCTION "public"."notify_listing_favorited"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_new_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_sender_name TEXT;
  v_message_preview TEXT;
BEGIN
  -- Get sender's name
  SELECT COALESCE(full_name, username, 'Someone') INTO v_sender_name
  FROM profiles
  WHERE id = NEW.sender_id;
  
  -- Get message preview (first 50 chars)
  v_message_preview := LEFT(NEW.content, 50);
  IF LENGTH(NEW.content) > 50 THEN
    v_message_preview := v_message_preview || '...';
  END IF;
  
  -- Create notification for recipient
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
$$;


ALTER FUNCTION "public"."notify_new_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_event_rsvp_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  update events
  set rsvp_count = (
    select count(*) from event_rsvps
    where event_id = coalesce(new.event_id, old.event_id)
      and status = 'going'
  )
  where id = coalesce(new.event_id, old.event_id);
  return new;
end;
$$;


ALTER FUNCTION "public"."refresh_event_rsvp_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_listings"("search_query" "text" DEFAULT NULL::"text", "model_filter" "text" DEFAULT NULL::"text", "year_min" integer DEFAULT NULL::integer, "year_max" integer DEFAULT NULL::integer, "price_min" numeric DEFAULT NULL::numeric, "price_max" numeric DEFAULT NULL::numeric, "city_filter" "text" DEFAULT NULL::"text", "state_filter" "text" DEFAULT NULL::"text", "condition_filter" "text" DEFAULT NULL::"text", "transmission_filter" "text" DEFAULT NULL::"text", "limit_count" integer DEFAULT 50, "offset_count" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "user_id" "uuid", "title" "text", "model" "text", "year" integer, "price" numeric, "mileage" integer, "description" "text", "condition" "text", "city" "text", "state" "text", "zip_code" "text", "location" "text", "vin" "text", "color" "text", "transmission" "text", "status" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "search_rank" real)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."search_listings"("search_query" "text", "model_filter" "text", "year_min" integer, "year_max" integer, "price_min" numeric, "price_max" numeric, "city_filter" "text", "state_filter" "text", "condition_filter" "text", "transmission_filter" "text", "limit_count" integer, "offset_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_comment_like_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE forum_comments SET like_count = like_count + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE forum_comments SET like_count = like_count - 1 WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_comment_like_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_comment_reply_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.parent_comment_id IS NOT NULL THEN
    UPDATE forum_comments SET reply_count = reply_count + 1 WHERE id = NEW.parent_comment_id;
  ELSIF TG_OP = 'DELETE' AND OLD.parent_comment_id IS NOT NULL THEN
    UPDATE forum_comments SET reply_count = reply_count - 1 WHERE id = OLD.parent_comment_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_comment_reply_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_conversation_on_message"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."update_conversation_on_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_device_token_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_device_token_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_event_rsvp_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  target_event uuid := coalesce(new.event_id, old.event_id);
begin
  update events e
  set rsvp_count = (
    select count(*)
    from event_rsvps r
    where r.event_id = target_event
      and r.status = 'going'
  )
  where e.id = target_event;
  return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."update_event_rsvp_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_forum_post_comment_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE forum_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE forum_posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_forum_post_comment_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_forum_post_like_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE forum_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE forum_posts SET like_count = like_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_forum_post_like_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_media_comment_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."update_media_comment_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_media_like_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."update_media_like_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_favorite_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."update_user_favorite_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_favorite_events_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."update_user_favorite_events_count"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."comment_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."comment_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."community_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "model" "text",
    "title" "text",
    "description" "text",
    "media_type" "text" NOT NULL,
    "media_url" "text" NOT NULL,
    "thumbnail_url" "text",
    "storage_path" "text" NOT NULL,
    "file_size" integer,
    "duration" integer,
    "view_count" integer DEFAULT 0,
    "like_count" integer DEFAULT 0,
    "comment_count" integer DEFAULT 0,
    "tags" "text"[],
    "is_featured" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."community_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user1_id" "uuid" NOT NULL,
    "user2_id" "uuid" NOT NULL,
    "last_message_at" timestamp with time zone DEFAULT "now"(),
    "last_message_preview" "text",
    "user1_unread_count" integer DEFAULT 0,
    "user2_unread_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "conversations_check" CHECK (("user1_id" < "user2_id"))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "is_primary" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_rsvps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'going'::"text",
    "checked_in" boolean DEFAULT false,
    "checked_in_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_rsvps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "event_type" "text" NOT NULL,
    "location" "text" NOT NULL,
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone,
    "rsvp_count" integer DEFAULT 0,
    "max_attendees" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "country" "text",
    "state" "text",
    "city" "text"
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forum_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "parent_comment_id" "uuid",
    "reply_count" integer DEFAULT 0,
    "like_count" integer DEFAULT 0
);


ALTER TABLE "public"."forum_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forum_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "model" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "image_urls" "text"[],
    "like_count" integer DEFAULT 0,
    "comment_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."forum_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."listing_favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."listing_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."listing_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "is_primary" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."listing_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "model" "text" NOT NULL,
    "year" integer NOT NULL,
    "price" numeric(12,2) NOT NULL,
    "mileage" integer,
    "description" "text",
    "condition" "text",
    "city" "text",
    "state" "text",
    "zip_code" "text",
    "location" "text",
    "vin" "text",
    "color" "text",
    "transmission" "text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sold_at" timestamp with time zone,
    "country" "text",
    "street_address" "text",
    "search_vector" "tsvector" GENERATED ALWAYS AS ((((((("setweight"("to_tsvector"('"english"'::"regconfig", COALESCE("title", ''::"text")), 'A'::"char") || "setweight"("to_tsvector"('"english"'::"regconfig", COALESCE("description", ''::"text")), 'B'::"char")) || "setweight"("to_tsvector"('"english"'::"regconfig", COALESCE("city", ''::"text")), 'C'::"char")) || "setweight"("to_tsvector"('"english"'::"regconfig", COALESCE("state", ''::"text")), 'C'::"char")) || "setweight"("to_tsvector"('"english"'::"regconfig", COALESCE("country", ''::"text")), 'C'::"char")) || "setweight"("to_tsvector"('"english"'::"regconfig", COALESCE("model", ''::"text")), 'C'::"char")) || "setweight"("to_tsvector"('"english"'::"regconfig", COALESCE("color", ''::"text")), 'D'::"char"))) STORED
);


ALTER TABLE "public"."listings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."listings"."city" IS 'City name';



COMMENT ON COLUMN "public"."listings"."state" IS 'State/Province (dependent on country)';



COMMENT ON COLUMN "public"."listings"."location" IS 'Full location string (kept for backward compatibility)';



COMMENT ON COLUMN "public"."listings"."country" IS 'ISO country code (e.g., US, CA, GB) for location filtering';



COMMENT ON COLUMN "public"."listings"."street_address" IS 'Custom street address or detailed location';



CREATE TABLE IF NOT EXISTS "public"."media_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "media_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."media_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "media_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."media_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "image_url" "text",
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."model_specs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "model" "text" NOT NULL,
    "year" integer,
    "engine" "text",
    "displacement" "text",
    "horsepower" integer,
    "torque" integer,
    "transmission" "text",
    "drivetrain" "text",
    "weight" integer,
    "length" numeric(5,2),
    "width" numeric(5,2),
    "height" numeric(5,2),
    "wheelbase" numeric(5,2),
    "fuel_capacity" numeric(4,2),
    "mpg_city" numeric(4,1),
    "mpg_highway" numeric(4,1),
    "acceleration_0_60" numeric(4,2),
    "top_speed" integer,
    "additional_specs" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."model_specs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "data" "jsonb",
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parts_listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "part_name" "text" NOT NULL,
    "part_number" "text",
    "compatible_models" "text"[],
    "price" numeric(12,2) NOT NULL,
    "condition" "text",
    "description" "text",
    "image_urls" "text"[],
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."parts_listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."password_reset_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "code_hash" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."password_reset_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."post_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_creation_errors" (
    "id" integer NOT NULL,
    "user_id" "uuid",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profile_creation_errors" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."profile_creation_errors_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."profile_creation_errors_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."profile_creation_errors_id_seq" OWNED BY "public"."profile_creation_errors"."id";



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "full_name" "text",
    "email" "text",
    "phone_number" "text",
    "phone_verified" boolean DEFAULT false,
    "bio" "text",
    "avatar_url" "text",
    "location" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "favorite_listings_count" integer DEFAULT 0,
    "favorite_events_count" integer DEFAULT 0
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_searches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "search_name" "text" NOT NULL,
    "search_query" "text",
    "model" "text",
    "min_price" numeric(12,2),
    "max_price" numeric(12,2),
    "min_year" integer,
    "max_year" integer,
    "condition" "text"[],
    "city" "text",
    "state" "text",
    "location" "text",
    "transmission" "text"[],
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."saved_searches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_device_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "device_token" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_device_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_garage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "model" "text" NOT NULL,
    "year" integer,
    "nickname" "text",
    "description" "text",
    "cover_image_url" "text",
    "mods" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_garage" OWNER TO "postgres";


ALTER TABLE ONLY "public"."profile_creation_errors" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."profile_creation_errors_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_comment_id_user_id_key" UNIQUE ("comment_id", "user_id");



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."community_media"
    ADD CONSTRAINT "community_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user1_id_user2_id_key" UNIQUE ("user1_id", "user2_id");



ALTER TABLE ONLY "public"."event_favorites"
    ADD CONSTRAINT "event_favorites_event_id_user_id_key" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."event_favorites"
    ADD CONSTRAINT "event_favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_images"
    ADD CONSTRAINT "event_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_rsvps"
    ADD CONSTRAINT "event_rsvps_event_id_user_id_key" UNIQUE ("event_id", "user_id");



ALTER TABLE ONLY "public"."event_rsvps"
    ADD CONSTRAINT "event_rsvps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_comments"
    ADD CONSTRAINT "forum_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forum_posts"
    ADD CONSTRAINT "forum_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."listing_favorites"
    ADD CONSTRAINT "listing_favorites_listing_id_user_id_key" UNIQUE ("listing_id", "user_id");



ALTER TABLE ONLY "public"."listing_favorites"
    ADD CONSTRAINT "listing_favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."listing_images"
    ADD CONSTRAINT "listing_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_comments"
    ADD CONSTRAINT "media_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_likes"
    ADD CONSTRAINT "media_likes_media_id_user_id_key" UNIQUE ("media_id", "user_id");



ALTER TABLE ONLY "public"."media_likes"
    ADD CONSTRAINT "media_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."model_specs"
    ADD CONSTRAINT "model_specs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parts_listings"
    ADD CONSTRAINT "parts_listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_reset_codes"
    ADD CONSTRAINT "password_reset_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_user_id_key" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."profile_creation_errors"
    ADD CONSTRAINT "profile_creation_errors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."saved_searches"
    ADD CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_device_tokens"
    ADD CONSTRAINT "user_device_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_device_tokens"
    ADD CONSTRAINT "user_device_tokens_user_id_device_token_key" UNIQUE ("user_id", "device_token");



ALTER TABLE ONLY "public"."user_garage"
    ADD CONSTRAINT "user_garage_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_comment_likes_comment_id" ON "public"."comment_likes" USING "btree" ("comment_id");



CREATE INDEX "idx_comment_likes_created_at" ON "public"."comment_likes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_comment_likes_user_id" ON "public"."comment_likes" USING "btree" ("user_id");



CREATE INDEX "idx_community_media_created_at" ON "public"."community_media" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_community_media_like_count" ON "public"."community_media" USING "btree" ("like_count" DESC);



CREATE INDEX "idx_community_media_media_type" ON "public"."community_media" USING "btree" ("media_type");



CREATE INDEX "idx_community_media_model" ON "public"."community_media" USING "btree" ("model");



CREATE INDEX "idx_community_media_user_id" ON "public"."community_media" USING "btree" ("user_id");



CREATE INDEX "idx_conversations_last_message_at" ON "public"."conversations" USING "btree" ("last_message_at" DESC);



CREATE INDEX "idx_conversations_user1_id" ON "public"."conversations" USING "btree" ("user1_id");



CREATE INDEX "idx_conversations_user2_id" ON "public"."conversations" USING "btree" ("user2_id");



CREATE INDEX "idx_event_favorites_created_at" ON "public"."event_favorites" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_event_favorites_event_id" ON "public"."event_favorites" USING "btree" ("event_id");



CREATE INDEX "idx_event_favorites_user_id" ON "public"."event_favorites" USING "btree" ("user_id");



CREATE INDEX "idx_event_images_display_order" ON "public"."event_images" USING "btree" ("event_id", "display_order");



CREATE INDEX "idx_event_images_event_id" ON "public"."event_images" USING "btree" ("event_id");



CREATE INDEX "idx_event_rsvps_event_id" ON "public"."event_rsvps" USING "btree" ("event_id");



CREATE INDEX "idx_event_rsvps_user_id" ON "public"."event_rsvps" USING "btree" ("user_id");



CREATE INDEX "idx_events_event_type" ON "public"."events" USING "btree" ("event_type");



CREATE INDEX "idx_events_start_date" ON "public"."events" USING "btree" ("start_date");



CREATE INDEX "idx_forum_comments_parent_comment_id" ON "public"."forum_comments" USING "btree" ("parent_comment_id");



CREATE INDEX "idx_forum_comments_post_id" ON "public"."forum_comments" USING "btree" ("post_id");



CREATE INDEX "idx_forum_comments_post_parent" ON "public"."forum_comments" USING "btree" ("post_id", "parent_comment_id");



CREATE INDEX "idx_forum_comments_user_id" ON "public"."forum_comments" USING "btree" ("user_id");



CREATE INDEX "idx_forum_posts_created_at" ON "public"."forum_posts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_forum_posts_model" ON "public"."forum_posts" USING "btree" ("model");



CREATE INDEX "idx_forum_posts_user_id" ON "public"."forum_posts" USING "btree" ("user_id");



CREATE INDEX "idx_listing_favorites_created_at" ON "public"."listing_favorites" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_listing_favorites_listing_id" ON "public"."listing_favorites" USING "btree" ("listing_id");



CREATE INDEX "idx_listing_favorites_user_id" ON "public"."listing_favorites" USING "btree" ("user_id");



CREATE INDEX "idx_listing_images_listing_id" ON "public"."listing_images" USING "btree" ("listing_id");



CREATE INDEX "idx_listings_city" ON "public"."listings" USING "btree" ("city");



CREATE INDEX "idx_listings_city_state" ON "public"."listings" USING "btree" ("city", "state");



CREATE INDEX "idx_listings_country" ON "public"."listings" USING "btree" ("country");



CREATE INDEX "idx_listings_country_state" ON "public"."listings" USING "btree" ("country", "state");



CREATE INDEX "idx_listings_country_state_city" ON "public"."listings" USING "btree" ("country", "state", "city") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_listings_created_at" ON "public"."listings" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_listings_model" ON "public"."listings" USING "btree" ("model");



CREATE INDEX "idx_listings_model_year" ON "public"."listings" USING "btree" ("model", "year");



CREATE INDEX "idx_listings_price" ON "public"."listings" USING "btree" ("price");



CREATE INDEX "idx_listings_state" ON "public"."listings" USING "btree" ("state");



CREATE INDEX "idx_listings_state_city_model" ON "public"."listings" USING "btree" ("state", "city", "model") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_listings_status" ON "public"."listings" USING "btree" ("status");



CREATE INDEX "idx_listings_status_price" ON "public"."listings" USING "btree" ("status", "price") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_listings_user_id" ON "public"."listings" USING "btree" ("user_id");



CREATE INDEX "idx_listings_year" ON "public"."listings" USING "btree" ("year");



CREATE INDEX "idx_media_comments_created_at" ON "public"."media_comments" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_media_comments_media_id" ON "public"."media_comments" USING "btree" ("media_id");



CREATE INDEX "idx_media_comments_user_id" ON "public"."media_comments" USING "btree" ("user_id");



CREATE INDEX "idx_media_likes_media_id" ON "public"."media_likes" USING "btree" ("media_id");



CREATE INDEX "idx_media_likes_user_id" ON "public"."media_likes" USING "btree" ("user_id");



CREATE INDEX "idx_messages_conversation_id" ON "public"."messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_messages_created_at" ON "public"."messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_messages_is_read" ON "public"."messages" USING "btree" ("is_read") WHERE ("is_read" = false);



CREATE INDEX "idx_messages_recipient_id" ON "public"."messages" USING "btree" ("recipient_id");



CREATE INDEX "idx_messages_sender_id" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "idx_model_specs_model" ON "public"."model_specs" USING "btree" ("model");



CREATE INDEX "idx_model_specs_model_year" ON "public"."model_specs" USING "btree" ("model", "year");



CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_notifications_type" ON "public"."notifications" USING "btree" ("type");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_user_unread" ON "public"."notifications" USING "btree" ("user_id", "is_read") WHERE ("is_read" = false);



CREATE INDEX "idx_parts_listings_status" ON "public"."parts_listings" USING "btree" ("status");



CREATE INDEX "idx_parts_listings_user_id" ON "public"."parts_listings" USING "btree" ("user_id");



CREATE INDEX "idx_password_reset_codes_user_id" ON "public"."password_reset_codes" USING "btree" ("user_id", "used", "expires_at" DESC);



CREATE INDEX "idx_post_likes_post_id" ON "public"."post_likes" USING "btree" ("post_id");



CREATE INDEX "idx_post_likes_user_id" ON "public"."post_likes" USING "btree" ("user_id");



CREATE INDEX "idx_saved_searches_user_id" ON "public"."saved_searches" USING "btree" ("user_id");



CREATE INDEX "idx_user_device_tokens_token" ON "public"."user_device_tokens" USING "btree" ("device_token");



CREATE INDEX "idx_user_device_tokens_user_id" ON "public"."user_device_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_user_garage_user_id" ON "public"."user_garage" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "comment_like_count_on_delete" AFTER DELETE ON "public"."comment_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_comment_like_count"();



CREATE OR REPLACE TRIGGER "comment_like_count_on_insert" AFTER INSERT ON "public"."comment_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_comment_like_count"();



CREATE OR REPLACE TRIGGER "enforce_capacity_insert" BEFORE INSERT ON "public"."event_rsvps" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_event_capacity"();



CREATE OR REPLACE TRIGGER "enforce_capacity_update" BEFORE UPDATE ON "public"."event_rsvps" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_event_capacity"();



CREATE OR REPLACE TRIGGER "trg_refresh_event_rsvp_count" AFTER INSERT OR DELETE OR UPDATE ON "public"."event_rsvps" FOR EACH ROW EXECUTE FUNCTION "public"."refresh_event_rsvp_count"();



CREATE OR REPLACE TRIGGER "trigger_event_favorited" AFTER INSERT ON "public"."event_favorites" FOR EACH ROW EXECUTE FUNCTION "public"."notify_event_favorited"();



CREATE OR REPLACE TRIGGER "trigger_event_rsvp" AFTER INSERT ON "public"."event_rsvps" FOR EACH ROW EXECUTE FUNCTION "public"."notify_event_rsvp"();



CREATE OR REPLACE TRIGGER "trigger_forum_comment" AFTER INSERT ON "public"."forum_comments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_forum_comment"();



CREATE OR REPLACE TRIGGER "trigger_forum_like" AFTER INSERT ON "public"."post_likes" FOR EACH ROW EXECUTE FUNCTION "public"."notify_forum_like"();



CREATE OR REPLACE TRIGGER "trigger_forum_reply" AFTER INSERT ON "public"."forum_comments" FOR EACH ROW EXECUTE FUNCTION "public"."notify_forum_reply"();



CREATE OR REPLACE TRIGGER "trigger_listing_favorited" AFTER INSERT ON "public"."listing_favorites" FOR EACH ROW EXECUTE FUNCTION "public"."notify_listing_favorited"();



CREATE OR REPLACE TRIGGER "update_comment_count_on_delete" AFTER DELETE ON "public"."forum_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_forum_post_comment_count"();



CREATE OR REPLACE TRIGGER "update_comment_count_on_insert" AFTER INSERT ON "public"."forum_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_forum_post_comment_count"();



CREATE OR REPLACE TRIGGER "update_comment_like_count_on_delete" AFTER DELETE ON "public"."comment_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_comment_like_count"();



CREATE OR REPLACE TRIGGER "update_comment_like_count_on_insert" AFTER INSERT ON "public"."comment_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_comment_like_count"();



CREATE OR REPLACE TRIGGER "update_conversation_on_message_insert" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_conversation_on_message"();



CREATE OR REPLACE TRIGGER "update_conversation_on_message_update" AFTER UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_conversation_on_message"();



CREATE OR REPLACE TRIGGER "update_device_token_updated_at" BEFORE UPDATE ON "public"."user_device_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."update_device_token_updated_at"();



CREATE OR REPLACE TRIGGER "update_forum_posts_updated_at" BEFORE UPDATE ON "public"."forum_posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_like_count_on_delete" AFTER DELETE ON "public"."post_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_forum_post_like_count"();



CREATE OR REPLACE TRIGGER "update_like_count_on_insert" AFTER INSERT ON "public"."post_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_forum_post_like_count"();



CREATE OR REPLACE TRIGGER "update_listings_updated_at" BEFORE UPDATE ON "public"."listings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_media_comment_count_on_delete" AFTER DELETE ON "public"."media_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_media_comment_count"();



CREATE OR REPLACE TRIGGER "update_media_comment_count_on_insert" AFTER INSERT ON "public"."media_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_media_comment_count"();



CREATE OR REPLACE TRIGGER "update_media_like_count_on_delete" AFTER DELETE ON "public"."media_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_media_like_count"();



CREATE OR REPLACE TRIGGER "update_media_like_count_on_insert" AFTER INSERT ON "public"."media_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_media_like_count"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_reply_count_on_delete" AFTER DELETE ON "public"."forum_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_comment_reply_count"();



CREATE OR REPLACE TRIGGER "update_reply_count_on_insert" AFTER INSERT ON "public"."forum_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_comment_reply_count"();



CREATE OR REPLACE TRIGGER "update_rsvp_count_on_delete" AFTER DELETE ON "public"."event_rsvps" FOR EACH ROW EXECUTE FUNCTION "public"."update_event_rsvp_count"();



CREATE OR REPLACE TRIGGER "update_rsvp_count_on_insert" AFTER INSERT ON "public"."event_rsvps" FOR EACH ROW EXECUTE FUNCTION "public"."update_event_rsvp_count"();



CREATE OR REPLACE TRIGGER "update_rsvp_count_on_update" AFTER UPDATE ON "public"."event_rsvps" FOR EACH ROW EXECUTE FUNCTION "public"."update_event_rsvp_count"();



CREATE OR REPLACE TRIGGER "update_user_favorite_count_on_delete" AFTER DELETE ON "public"."listing_favorites" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_favorite_count"();



CREATE OR REPLACE TRIGGER "update_user_favorite_count_on_insert" AFTER INSERT ON "public"."listing_favorites" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_favorite_count"();



CREATE OR REPLACE TRIGGER "update_user_favorite_events_count_on_delete" AFTER DELETE ON "public"."event_favorites" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_favorite_events_count"();



CREATE OR REPLACE TRIGGER "update_user_favorite_events_count_on_insert" AFTER INSERT ON "public"."event_favorites" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_favorite_events_count"();



CREATE OR REPLACE TRIGGER "update_user_garage_updated_at" BEFORE UPDATE ON "public"."user_garage" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."forum_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."community_media"
    ADD CONSTRAINT "community_media_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user1_id_fkey" FOREIGN KEY ("user1_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user2_id_fkey" FOREIGN KEY ("user2_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_favorites"
    ADD CONSTRAINT "event_favorites_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_favorites"
    ADD CONSTRAINT "event_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_images"
    ADD CONSTRAINT "event_images_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_rsvps"
    ADD CONSTRAINT "event_rsvps_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_rsvps"
    ADD CONSTRAINT "event_rsvps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."forum_comments"
    ADD CONSTRAINT "forum_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."forum_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_comments"
    ADD CONSTRAINT "forum_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_comments"
    ADD CONSTRAINT "forum_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forum_posts"
    ADD CONSTRAINT "forum_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listing_favorites"
    ADD CONSTRAINT "listing_favorites_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listing_favorites"
    ADD CONSTRAINT "listing_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listing_images"
    ADD CONSTRAINT "listing_images_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_comments"
    ADD CONSTRAINT "media_comments_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "public"."community_media"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_comments"
    ADD CONSTRAINT "media_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_likes"
    ADD CONSTRAINT "media_likes_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "public"."community_media"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_likes"
    ADD CONSTRAINT "media_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parts_listings"
    ADD CONSTRAINT "parts_listings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."password_reset_codes"
    ADD CONSTRAINT "password_reset_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."forum_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."saved_searches"
    ADD CONSTRAINT "saved_searches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_device_tokens"
    ADD CONSTRAINT "user_device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_garage"
    ADD CONSTRAINT "user_garage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Active listings are viewable by everyone" ON "public"."listings" FOR SELECT USING (("status" = 'active'::"text"));



CREATE POLICY "Authenticated users can RSVP" ON "public"."event_rsvps" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can create comments" ON "public"."forum_comments" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can create comments" ON "public"."media_comments" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can create events" ON "public"."events" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "Authenticated users can create forum posts" ON "public"."forum_posts" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can create specs" ON "public"."model_specs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can favorite events" ON "public"."event_favorites" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can favorite listings" ON "public"."listing_favorites" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can like comments" ON "public"."comment_likes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can like media" ON "public"."media_likes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can like posts" ON "public"."post_likes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can update specs" ON "public"."model_specs" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Comment likes are viewable by everyone" ON "public"."comment_likes" FOR SELECT USING (true);



CREATE POLICY "Community media is viewable by everyone" ON "public"."community_media" FOR SELECT USING (true);



CREATE POLICY "Event creators can add images" ON "public"."event_images" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_images"."event_id") AND ("e"."created_by" = "auth"."uid"())))));



CREATE POLICY "Event creators can delete images" ON "public"."event_images" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_images"."event_id") AND ("e"."created_by" = "auth"."uid"())))));



CREATE POLICY "Event creators can delete their events" ON "public"."events" FOR DELETE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Event creators can update images" ON "public"."event_images" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_images"."event_id") AND ("e"."created_by" = "auth"."uid"())))));



CREATE POLICY "Event creators can update their events" ON "public"."events" FOR UPDATE USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Event favorites are viewable by everyone" ON "public"."event_favorites" FOR SELECT USING (true);



CREATE POLICY "Event images are viewable by everyone" ON "public"."event_images" FOR SELECT USING (true);



CREATE POLICY "Events are viewable by everyone" ON "public"."events" FOR SELECT USING (true);



CREATE POLICY "Forum comments are viewable by everyone" ON "public"."forum_comments" FOR SELECT USING (true);



CREATE POLICY "Forum posts are viewable by everyone" ON "public"."forum_posts" FOR SELECT USING (true);



CREATE POLICY "Listing favorites are viewable by everyone" ON "public"."listing_favorites" FOR SELECT USING (true);



CREATE POLICY "Listing images are viewable by everyone" ON "public"."listing_images" FOR SELECT USING (true);



CREATE POLICY "Media comments are viewable by everyone" ON "public"."media_comments" FOR SELECT USING (true);



CREATE POLICY "Media likes are viewable by everyone" ON "public"."media_likes" FOR SELECT USING (true);



CREATE POLICY "Model specs are viewable by everyone" ON "public"."model_specs" FOR SELECT USING (true);



CREATE POLICY "Post likes are viewable by everyone" ON "public"."post_likes" FOR SELECT USING (true);



CREATE POLICY "Public profiles are viewable by everyone" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "RSVPs are viewable by everyone" ON "public"."event_rsvps" FOR SELECT USING (true);



CREATE POLICY "Recipients can mark messages as read" ON "public"."messages" FOR UPDATE USING (("auth"."uid"() = "recipient_id")) WITH CHECK (("auth"."uid"() = "recipient_id"));



CREATE POLICY "Service role can manage password reset codes" ON "public"."password_reset_codes" USING (false) WITH CHECK (false);



CREATE POLICY "System can create notifications" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "User garage is viewable by everyone" ON "public"."user_garage" FOR SELECT USING (true);



CREATE POLICY "Users can add to their garage" ON "public"."user_garage" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create conversations" ON "public"."conversations" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user1_id") OR ("auth"."uid"() = "user2_id")));



CREATE POLICY "Users can create listings" ON "public"."listings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create media posts" ON "public"."community_media" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create saved searches" ON "public"."saved_searches" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete from their garage" ON "public"."user_garage" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete images from their listings" ON "public"."listing_images" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."listings"
  WHERE (("listings"."id" = "listing_images"."listing_id") AND ("listings"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their RSVP" ON "public"."event_rsvps" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own comments" ON "public"."forum_comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own comments" ON "public"."media_comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own device tokens" ON "public"."user_device_tokens" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own forum posts" ON "public"."forum_posts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own listings" ON "public"."listings" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own media posts" ON "public"."community_media" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own notifications" ON "public"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their saved searches" ON "public"."saved_searches" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert images for their listings" ON "public"."listing_images" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."listings"
  WHERE (("listings"."id" = "listing_images"."listing_id") AND ("listings"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert their own device tokens" ON "public"."user_device_tokens" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can remove their likes" ON "public"."post_likes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can send messages" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "sender_id") AND (EXISTS ( SELECT 1
   FROM "public"."conversations"
  WHERE (("conversations"."id" = "messages"."conversation_id") AND (("conversations"."user1_id" = "auth"."uid"()) OR ("conversations"."user2_id" = "auth"."uid"())))))));



CREATE POLICY "Users can unfavorite their own favorites" ON "public"."event_favorites" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can unfavorite their own favorites" ON "public"."listing_favorites" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can unlike media" ON "public"."media_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can unlike posts" ON "public"."post_likes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can unlike their comment likes" ON "public"."comment_likes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can unlike their own likes" ON "public"."comment_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their RSVP" ON "public"."event_rsvps" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their garage" ON "public"."user_garage" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own comments" ON "public"."forum_comments" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own comments" ON "public"."media_comments" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own conversations" ON "public"."conversations" FOR UPDATE USING ((("auth"."uid"() = "user1_id") OR ("auth"."uid"() = "user2_id")));



CREATE POLICY "Users can update their own device tokens" ON "public"."user_device_tokens" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own forum posts" ON "public"."forum_posts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own listings" ON "public"."listings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own media posts" ON "public"."community_media" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own sent messages" ON "public"."messages" FOR UPDATE USING (("auth"."uid"() = "sender_id"));



CREATE POLICY "Users can update their saved searches" ON "public"."saved_searches" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view messages in their conversations" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversations"
  WHERE (("conversations"."id" = "messages"."conversation_id") AND (("conversations"."user1_id" = "auth"."uid"()) OR ("conversations"."user2_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view their own conversations" ON "public"."conversations" FOR SELECT USING ((("auth"."uid"() = "user1_id") OR ("auth"."uid"() = "user2_id")));



CREATE POLICY "Users can view their own device tokens" ON "public"."user_device_tokens" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own listings" ON "public"."listings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own saved searches" ON "public"."saved_searches" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."comment_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."community_media" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_rsvps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forum_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."listing_favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."listing_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."media_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."media_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."model_specs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."password_reset_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."saved_searches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_device_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_garage" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."comment_likes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."community_media";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."conversations";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."event_favorites";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."event_images";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."events";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."forum_comments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."forum_posts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."listing_favorites";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."listings";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."media_comments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."media_likes";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" "text", "p_title" "text", "p_body" "text", "p_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_event_capacity"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_event_capacity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_event_capacity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_comment_replies"("p_comment_id" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_comment_replies"("p_comment_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_comment_replies"("p_comment_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_events_cursor"("p_cursor" timestamp with time zone, "p_limit" integer, "p_location" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_events_cursor"("p_cursor" timestamp with time zone, "p_limit" integer, "p_location" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_events_cursor"("p_cursor" timestamp with time zone, "p_limit" integer, "p_location" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_forum_posts_cursor"("p_cursor" timestamp with time zone, "p_limit" integer, "p_model" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_forum_posts_cursor"("p_cursor" timestamp with time zone, "p_limit" integer, "p_model" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_forum_posts_cursor"("p_cursor" timestamp with time zone, "p_limit" integer, "p_model" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_listings_cursor"("p_cursor" timestamp with time zone, "p_limit" integer, "p_city" "text", "p_state" "text", "p_min_price" numeric, "p_max_price" numeric, "p_model" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_listings_cursor"("p_cursor" timestamp with time zone, "p_limit" integer, "p_city" "text", "p_state" "text", "p_min_price" numeric, "p_max_price" numeric, "p_model" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_listings_cursor"("p_cursor" timestamp with time zone, "p_limit" integer, "p_city" "text", "p_state" "text", "p_min_price" numeric, "p_max_price" numeric, "p_model" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_post_comments_nested"("p_post_id" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_post_comments_nested"("p_post_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_post_comments_nested"("p_post_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_unread_notification_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_unread_notification_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unread_notification_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_favorite_events"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_favorite_events"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_favorite_events"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_favorite_listings"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_favorite_listings"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_favorite_listings"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_stats"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_stats"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_stats"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_user_favorited_event"("p_user_id" "uuid", "p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_user_favorited_event"("p_user_id" "uuid", "p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_user_favorited_event"("p_user_id" "uuid", "p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_user_favorited_listing"("p_user_id" "uuid", "p_listing_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_user_favorited_listing"("p_user_id" "uuid", "p_listing_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_user_favorited_listing"("p_user_id" "uuid", "p_listing_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_user_liked_comment"("p_user_id" "uuid", "p_comment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_user_liked_comment"("p_user_id" "uuid", "p_comment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_user_liked_comment"("p_user_id" "uuid", "p_comment_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"() TO "anon";
GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_all_notifications_read"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_notification_read"("p_notification_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_event_favorited"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_event_favorited"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_event_favorited"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_event_rsvp"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_event_rsvp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_event_rsvp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_forum_comment"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_forum_comment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_forum_comment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_forum_like"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_forum_like"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_forum_like"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_forum_reply"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_forum_reply"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_forum_reply"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_listing_favorited"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_listing_favorited"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_listing_favorited"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_new_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_new_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_new_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_event_rsvp_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_event_rsvp_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_event_rsvp_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."search_listings"("search_query" "text", "model_filter" "text", "year_min" integer, "year_max" integer, "price_min" numeric, "price_max" numeric, "city_filter" "text", "state_filter" "text", "condition_filter" "text", "transmission_filter" "text", "limit_count" integer, "offset_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_listings"("search_query" "text", "model_filter" "text", "year_min" integer, "year_max" integer, "price_min" numeric, "price_max" numeric, "city_filter" "text", "state_filter" "text", "condition_filter" "text", "transmission_filter" "text", "limit_count" integer, "offset_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_listings"("search_query" "text", "model_filter" "text", "year_min" integer, "year_max" integer, "price_min" numeric, "price_max" numeric, "city_filter" "text", "state_filter" "text", "condition_filter" "text", "transmission_filter" "text", "limit_count" integer, "offset_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_comment_like_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_comment_like_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_comment_like_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_comment_reply_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_comment_reply_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_comment_reply_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_conversation_on_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_conversation_on_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_conversation_on_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_device_token_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_device_token_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_device_token_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_event_rsvp_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_event_rsvp_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_event_rsvp_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_forum_post_comment_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_forum_post_comment_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_forum_post_comment_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_forum_post_like_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_forum_post_like_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_forum_post_like_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_media_comment_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_media_comment_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_media_comment_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_media_like_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_media_like_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_media_like_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_favorite_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_favorite_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_favorite_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_favorite_events_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_favorite_events_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_favorite_events_count"() TO "service_role";


















GRANT ALL ON TABLE "public"."comment_likes" TO "anon";
GRANT ALL ON TABLE "public"."comment_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."comment_likes" TO "service_role";



GRANT ALL ON TABLE "public"."community_media" TO "anon";
GRANT ALL ON TABLE "public"."community_media" TO "authenticated";
GRANT ALL ON TABLE "public"."community_media" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."event_favorites" TO "anon";
GRANT ALL ON TABLE "public"."event_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."event_favorites" TO "service_role";



GRANT ALL ON TABLE "public"."event_images" TO "anon";
GRANT ALL ON TABLE "public"."event_images" TO "authenticated";
GRANT ALL ON TABLE "public"."event_images" TO "service_role";



GRANT ALL ON TABLE "public"."event_rsvps" TO "anon";
GRANT ALL ON TABLE "public"."event_rsvps" TO "authenticated";
GRANT ALL ON TABLE "public"."event_rsvps" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."forum_comments" TO "anon";
GRANT ALL ON TABLE "public"."forum_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."forum_comments" TO "service_role";



GRANT ALL ON TABLE "public"."forum_posts" TO "anon";
GRANT ALL ON TABLE "public"."forum_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."forum_posts" TO "service_role";



GRANT ALL ON TABLE "public"."listing_favorites" TO "anon";
GRANT ALL ON TABLE "public"."listing_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."listing_favorites" TO "service_role";



GRANT ALL ON TABLE "public"."listing_images" TO "anon";
GRANT ALL ON TABLE "public"."listing_images" TO "authenticated";
GRANT ALL ON TABLE "public"."listing_images" TO "service_role";



GRANT ALL ON TABLE "public"."listings" TO "anon";
GRANT ALL ON TABLE "public"."listings" TO "authenticated";
GRANT ALL ON TABLE "public"."listings" TO "service_role";



GRANT ALL ON TABLE "public"."media_comments" TO "anon";
GRANT ALL ON TABLE "public"."media_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."media_comments" TO "service_role";



GRANT ALL ON TABLE "public"."media_likes" TO "anon";
GRANT ALL ON TABLE "public"."media_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."media_likes" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."model_specs" TO "anon";
GRANT ALL ON TABLE "public"."model_specs" TO "authenticated";
GRANT ALL ON TABLE "public"."model_specs" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."parts_listings" TO "anon";
GRANT ALL ON TABLE "public"."parts_listings" TO "authenticated";
GRANT ALL ON TABLE "public"."parts_listings" TO "service_role";



GRANT ALL ON TABLE "public"."password_reset_codes" TO "anon";
GRANT ALL ON TABLE "public"."password_reset_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."password_reset_codes" TO "service_role";



GRANT ALL ON TABLE "public"."post_likes" TO "anon";
GRANT ALL ON TABLE "public"."post_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."post_likes" TO "service_role";



GRANT ALL ON TABLE "public"."profile_creation_errors" TO "anon";
GRANT ALL ON TABLE "public"."profile_creation_errors" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_creation_errors" TO "service_role";



GRANT ALL ON SEQUENCE "public"."profile_creation_errors_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."profile_creation_errors_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."profile_creation_errors_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."saved_searches" TO "anon";
GRANT ALL ON TABLE "public"."saved_searches" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_searches" TO "service_role";



GRANT ALL ON TABLE "public"."user_device_tokens" TO "anon";
GRANT ALL ON TABLE "public"."user_device_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."user_device_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."user_garage" TO "anon";
GRANT ALL ON TABLE "public"."user_garage" TO "authenticated";
GRANT ALL ON TABLE "public"."user_garage" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































