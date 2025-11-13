import { supabase } from './supabase';
import {
  ForumPost,
  ForumPostWithUser,
  ForumComment,
  ForumCommentWithUser,
  CreateForumPostData,
  CreateCommentData,
} from '../types/forum.types';

export const forumService = {
  /**
   * Get all forum posts with user profiles (optimized - only fetches required fields)
   */
  async getAllPosts(limit: number = 50): Promise<ForumPostWithUser[]> {
    // Fetch posts without profile join first (only required fields)
    const { data: posts, error: postsError } = await supabase
      .from('forum_posts')
      .select('id, user_id, model, title, content, image_urls, like_count, comment_count, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (postsError) throw postsError;
    if (!posts || posts.length === 0) return [];

    // Fetch user profiles separately
    const userIds = [...new Set(posts.map(post => post.user_id))];
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', userIds);

    if (profilesError) throw profilesError;

    // Combine posts with profiles
    return posts.map(post => ({
      ...post,
      profiles: profiles?.find(p => p.id === post.user_id) || undefined,
    })) as ForumPostWithUser[];
  },

  /**
   * Get posts by model
   */
  async getPostsByModel(model: string, limit: number = 50): Promise<ForumPostWithUser[]> {
    const { data, error } = await supabase
      .from('forum_posts')
      .select(
        `
        *,
        profiles:user_id (
          username,
          full_name,
          avatar_url
        )
      `
      )
      .eq('model', model)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  /**
   * Get a single post by ID with user profile
   */
  async getPostById(postId: string): Promise<ForumPostWithUser | null> {
    const { data, error } = await supabase
      .from('forum_posts')
      .select(
        `
        *,
        profiles:user_id (
          username,
          full_name,
          avatar_url
        )
      `
      )
      .eq('id', postId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get posts by user ID (optimized - only fetches required fields)
   */
  async getUserPosts(userId: string): Promise<ForumPostWithUser[]> {
    // Fetch posts without profile join first (only required fields)
    const { data: posts, error: postsError } = await supabase
      .from('forum_posts')
      .select('id, user_id, model, title, content, image_urls, like_count, comment_count, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (postsError) throw postsError;
    if (!posts || posts.length === 0) return [];

    // Fetch user profiles separately
    const userIds = [...new Set(posts.map(post => post.user_id))];
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', userIds);

    if (profilesError) throw profilesError;

    // Combine posts with profiles
    return posts.map(post => ({
      ...post,
      profiles: profiles?.find(p => p.id === post.user_id) || undefined,
    })) as ForumPostWithUser[];
  },

  /**
   * Create a new forum post
   */
  async createPost(postData: CreateForumPostData): Promise<ForumPost> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('forum_posts')
      .insert({
        ...postData,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get comments for a post (optimized - only fetches required fields)
   */
  async getPostComments(postId: string, limit?: number): Promise<ForumCommentWithUser[]> {
    // Fetch comments without profile join first (only required fields)
    const { data: comments, error: commentsError } = await supabase
      .from('forum_comments')
      .select('id, post_id, user_id, content, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(limit || 100);

    if (commentsError) throw commentsError;
    if (!comments || comments.length === 0) return [];

    // Fetch user profiles separately
    const userIds = [...new Set(comments.map(comment => comment.user_id))];
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', userIds);

    if (profilesError) throw profilesError;

    // Combine comments with profiles
    return comments.map(comment => ({
      ...comment,
      profiles: profiles?.find(p => p.id === comment.user_id) || undefined,
    })) as ForumCommentWithUser[];
  },

  /**
   * Batch get comments for multiple posts (optimized for ForumSection)
   */
  async getBatchPostComments(postIds: string[]): Promise<Record<string, ForumCommentWithUser[]>> {
    if (postIds.length === 0) return {};

    // Fetch all comments for these posts in one query
    const { data: comments, error: commentsError } = await supabase
      .from('forum_comments')
      .select('id, post_id, user_id, content, created_at')
      .in('post_id', postIds)
      .order('created_at', { ascending: true })
      .limit(500); // Limit total comments fetched

    if (commentsError) throw commentsError;
    if (!comments || comments.length === 0) return {};

    // Get unique user IDs
    const userIds = [...new Set(comments.map(comment => comment.user_id))];
    
    // Fetch profiles in one query
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', userIds);

    if (profilesError) throw profilesError;

    // Group comments by post_id and combine with profiles
    const result: Record<string, ForumCommentWithUser[]> = {};
    
    postIds.forEach(postId => {
      const postComments = comments.filter(c => c.post_id === postId).slice(0, 2); // Limit to 2 per post
      result[postId] = postComments.map(comment => {
        const profile = profiles?.find(p => p.id === comment.user_id);
        return {
          ...comment,
          profiles: profile ? {
            username: profile.username,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
          } : undefined,
        };
      }) as ForumCommentWithUser[];
    });

    return result;
  },

  /**
   * Create a comment on a post
   */
  async createComment(commentData: CreateCommentData): Promise<ForumComment> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('forum_comments')
      .insert({
        ...commentData,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Like a post
   */
  async likePost(postId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase.from('post_likes').insert({
      post_id: postId,
      user_id: user.id,
    });

    if (error) throw error;
  },

  /**
   * Unlike a post
   */
  async unlikePost(postId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', user.id);

    if (error) throw error;
  },

  /**
   * Check if current user has liked a post
   */
  async hasUserLikedPost(postId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') return false; // PGRST116 = no rows returned
    return !!data;
  },
};

