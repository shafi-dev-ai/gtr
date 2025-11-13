-- ============================================================================
-- Add Comment Replies and Comment Likes to Forum System
-- This adds nested comment replies and the ability to like comments
-- ============================================================================

-- ============================================================================
-- PART 1: ADD COMMENT REPLIES (NESTED COMMENTS)
-- ============================================================================

-- 1. Add parent_comment_id to forum_comments table for nested replies
ALTER TABLE forum_comments ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES forum_comments(id) ON DELETE CASCADE;

-- 2. Add reply_count to forum_comments table
ALTER TABLE forum_comments ADD COLUMN IF NOT EXISTS reply_count INTEGER DEFAULT 0;

-- 3. Add like_count to forum_comments table
ALTER TABLE forum_comments ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;

-- 4. Create index for parent_comment_id (for efficient reply queries)
CREATE INDEX IF NOT EXISTS idx_forum_comments_parent_comment_id ON forum_comments(parent_comment_id);

-- 5. Create index for post_id and parent_comment_id (for efficient nested queries)
CREATE INDEX IF NOT EXISTS idx_forum_comments_post_parent ON forum_comments(post_id, parent_comment_id);

-- ============================================================================
-- PART 2: CREATE COMMENT LIKES TABLE
-- ============================================================================

-- 6. Create Comment Likes Table
CREATE TABLE IF NOT EXISTS comment_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID REFERENCES forum_comments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(comment_id, user_id)
);

-- 7. Create Indexes for Comment Likes
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON comment_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_created_at ON comment_likes(created_at DESC);

-- ============================================================================
-- PART 3: ENABLE RLS AND CREATE POLICIES
-- ============================================================================

-- 8. Update Forum Comments Policies (parent_comment_id is already covered by existing policies)
-- No changes needed - existing policies cover replies

-- 9. Enable RLS for Comment Likes
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- 10. Comment Likes Policies
CREATE POLICY "Comment likes are viewable by everyone" 
  ON comment_likes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can like comments" 
  ON comment_likes FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike their own likes" 
  ON comment_likes FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================================================
-- PART 4: CREATE FUNCTIONS
-- ============================================================================

-- 11. Function: Update comment reply count
CREATE OR REPLACE FUNCTION update_comment_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- If this is a reply (has parent_comment_id), increment parent's reply_count
    IF NEW.parent_comment_id IS NOT NULL THEN
      UPDATE forum_comments 
      SET reply_count = reply_count + 1 
      WHERE id = NEW.parent_comment_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- If this was a reply, decrement parent's reply_count
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

-- 12. Function: Update comment like count
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

-- 13. Function: Get comment replies (nested comments)
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

GRANT EXECUTE ON FUNCTION get_comment_replies TO authenticated;
GRANT EXECUTE ON FUNCTION get_comment_replies TO anon;

-- 14. Function: Get all comments for a post (with nested structure)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_post_comments_nested TO authenticated;
GRANT EXECUTE ON FUNCTION get_post_comments_nested TO anon;

-- 15. Function: Check if user has liked a comment
CREATE OR REPLACE FUNCTION has_user_liked_comment(
  p_user_id UUID,
  p_comment_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM comment_likes 
    WHERE user_id = p_user_id 
      AND comment_id = p_comment_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION has_user_liked_comment TO authenticated;
GRANT EXECUTE ON FUNCTION has_user_liked_comment TO anon;

-- ============================================================================
-- PART 5: CREATE TRIGGERS
-- ============================================================================

-- 16. Trigger: Update reply count when comment is inserted/deleted
CREATE TRIGGER update_reply_count_on_insert 
  AFTER INSERT ON forum_comments 
  FOR EACH ROW 
  EXECUTE FUNCTION update_comment_reply_count();

CREATE TRIGGER update_reply_count_on_delete 
  AFTER DELETE ON forum_comments 
  FOR EACH ROW 
  EXECUTE FUNCTION update_comment_reply_count();

-- 17. Trigger: Update comment like count when like is inserted/deleted
CREATE TRIGGER update_comment_like_count_on_insert 
  AFTER INSERT ON comment_likes 
  FOR EACH ROW 
  EXECUTE FUNCTION update_comment_like_count();

CREATE TRIGGER update_comment_like_count_on_delete 
  AFTER DELETE ON comment_likes 
  FOR EACH ROW 
  EXECUTE FUNCTION update_comment_like_count();

-- ============================================================================
-- PART 6: INITIALIZE COUNTS FOR EXISTING DATA
-- ============================================================================

-- 18. Initialize reply_count for existing comments
UPDATE forum_comments 
SET reply_count = (
  SELECT COUNT(*) 
  FROM forum_comments AS replies 
  WHERE replies.parent_comment_id = forum_comments.id
);

-- 19. Initialize like_count for existing comments
UPDATE forum_comments 
SET like_count = (
  SELECT COUNT(*) 
  FROM comment_likes 
  WHERE comment_likes.comment_id = forum_comments.id
);

-- ============================================================================
-- PART 7: ENABLE REAL-TIME SUBSCRIPTIONS
-- ============================================================================

-- 20. Enable Real-time for Comment Likes
ALTER PUBLICATION supabase_realtime ADD TABLE comment_likes;

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================
-- Features Added:
-- ✅ Nested comment replies (parent_comment_id)
-- ✅ Comment reply count tracking
-- ✅ Comment likes table
-- ✅ Comment like count tracking
-- ✅ Helper functions for nested queries
-- ✅ Automatic count updates via triggers
-- ✅ RLS policies for security
-- ✅ Real-time subscriptions
-- ============================================================================

