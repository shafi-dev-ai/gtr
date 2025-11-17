-- ============================================================================
-- Complete Notifications System Setup
-- Run this entire script in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL, -- 'listing_favorited', 'event_rsvp', 'event_favorited', 'forum_comment', 'forum_reply', 'forum_like', 'saved_search_match', 'message'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB, -- Stores related IDs: { listing_id, event_id, post_id, comment_id, user_id, conversation_id, etc. }
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 2: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- ============================================================================
-- STEP 3: ENABLE RLS AND CREATE POLICIES
-- ============================================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications" 
  ON notifications FOR SELECT 
  USING (auth.uid() = user_id);

-- System can create notifications (via triggers/functions)
CREATE POLICY "System can create notifications" 
  ON notifications FOR INSERT 
  WITH CHECK (true);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications" 
  ON notifications FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications" 
  ON notifications FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 4: CREATE NOTIFICATION FUNCTIONS
-- ============================================================================

-- Function: Create notification
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

-- Function: Mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Mark all notifications as read for user
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS void AS $$
BEGIN
  UPDATE notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE user_id = auth.uid() AND is_read = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get unread notification count
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

-- ============================================================================
-- STEP 5: CREATE TRIGGERS FOR AUTO-NOTIFICATIONS
-- ============================================================================

-- Trigger: Notify when someone favorites your listing
CREATE OR REPLACE FUNCTION notify_listing_favorited()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_listing_favorited
  AFTER INSERT ON listing_favorites
  FOR EACH ROW
  EXECUTE FUNCTION notify_listing_favorited();

-- Trigger: Notify when someone RSVPs to your event
CREATE OR REPLACE FUNCTION notify_event_rsvp()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_event_rsvp
  AFTER INSERT ON event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION notify_event_rsvp();

-- Trigger: Notify when someone favorites your event
CREATE OR REPLACE FUNCTION notify_event_favorited()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_event_favorited
  AFTER INSERT ON event_favorites
  FOR EACH ROW
  EXECUTE FUNCTION notify_event_favorited();

-- Trigger: Notify when someone comments on your forum post
CREATE OR REPLACE FUNCTION notify_forum_comment()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_forum_comment
  AFTER INSERT ON forum_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_forum_comment();

-- Trigger: Notify when someone replies to your comment
CREATE OR REPLACE FUNCTION notify_forum_reply()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_forum_reply
  AFTER INSERT ON forum_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_forum_reply();

-- Trigger: Notify when someone likes your forum post
CREATE OR REPLACE FUNCTION notify_forum_like()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_forum_like
  AFTER INSERT ON post_likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_forum_like();

-- Trigger: Notify when new message is received (ready for future chat integration)
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: This trigger is ready but won't fire until messages table is used
-- Uncomment when ready to use messages:
-- CREATE TRIGGER trigger_new_message
--   AFTER INSERT ON messages
--   FOR EACH ROW
--   EXECUTE FUNCTION notify_new_message();

-- ============================================================================
-- STEP 6: ENABLE REAL-TIME SUBSCRIPTIONS
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================================================
-- STEP 7: GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_read TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_notification_count TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_notification_count TO anon;

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================
-- Notification types implemented:
-- ✅ listing_favorited - When someone favorites your listing
-- ✅ event_rsvp - When someone RSVPs to your event
-- ✅ event_favorited - When someone favorites your event
-- ✅ forum_comment - When someone comments on your post
-- ✅ forum_reply - When someone replies to your comment
-- ✅ forum_like - When someone likes your post
-- ✅ message - Ready for future chat integration
--
-- Features:
-- ✅ Auto-notifications via database triggers
-- ✅ Real-time subscriptions enabled
-- ✅ RLS policies for security
-- ✅ Helper functions for reading/managing notifications
-- ============================================================================

