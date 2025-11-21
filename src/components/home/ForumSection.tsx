import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Dimensions } from 'react-native';
import { ForumPostCard } from '../shared/ForumPostCard';
import { forumService } from '../../services/forum';
import { ForumPostWithUser, ForumCommentWithUser } from '../../types/forum.types';
import { useDataFetch } from '../../hooks/useDataFetch';
import { useCriticalAction } from '../../hooks/useCriticalAction';
import { RequestPriority } from '../../services/dataManager';
import { realtimeService } from '../../services/realtime';
import { useAuth } from '../../context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48; // Screen width minus padding

interface PostWithComments extends ForumPostWithUser {
  comments: ForumCommentWithUser[];
  commentText: string;
}

interface ForumSectionProps {
  onPostPress?: (post: ForumPostWithUser) => void;
  onSeeMorePress?: () => void;
  onRefreshReady?: (refreshFn: () => Promise<void>) => void;
}

export const ForumSection: React.FC<ForumSectionProps> = ({
  onPostPress,
  onSeeMorePress,
  onRefreshReady,
}) => {
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const { user } = useAuth();

  // Fetch forum posts using DataManager
  const { data: allPosts, loading, refresh } = useDataFetch<ForumPostWithUser[]>({
    cacheKey: 'home:forum:recent:3',
    fetchFn: () => forumService.getAllPosts(3),
    priority: RequestPriority.HIGH,
  });

  const visiblePosts = useMemo(() => {
    if (!allPosts) return [];
    if (!user?.id) return allPosts;
    return allPosts.filter((post) => post.user_id !== user.id);
  }, [allPosts, user?.id]);

  // Fetch comments for posts
  const { data: commentsByPost } = useDataFetch<Record<string, ForumCommentWithUser[]>>({
    cacheKey: `home:forum:comments:${visiblePosts?.map(p => p.id).join(',') || ''}`,
    fetchFn: async () => {
      if (!visiblePosts || visiblePosts.length === 0) return {};
      const postIds = visiblePosts.map(p => p.id);
      return await forumService.getBatchPostComments(postIds);
    },
    priority: RequestPriority.MEDIUM,
    enabled: !!visiblePosts && visiblePosts.length > 0,
  });

  // Combine posts with comments
  const posts = useMemo<PostWithComments[]>(() => {
    if (!visiblePosts) return [];
    return visiblePosts.map(post => ({
      ...post,
      comments: (commentsByPost?.[post.id] || []).slice(0, 2),
      commentText: commentTexts[post.id] || '',
    }));
  }, [visiblePosts, commentsByPost, commentTexts]);

  // Critical action for commenting
  const { execute: executeComment } = useCriticalAction({
    cacheKey: 'forum:comment',
    actionFn: async () => null,
    invalidateCache: ['home:forum'],
  });

  const handleCommentTextChange = (postId: string, text: string) => {
    setCommentTexts(prev => ({ ...prev, [postId]: text }));
  };

  const handleCommentSubmit = async (postId: string) => {
    const commentText = commentTexts[postId];
    if (!commentText?.trim()) return;
    
    try {
      await forumService.createComment({
        post_id: postId,
        content: commentText.trim(),
      });
      
      // Clear comment text
      setCommentTexts(prev => ({ ...prev, [postId]: '' }));
      
      // Invalidate cache and refresh
      await executeComment();
      await refresh();
    } catch (error) {
      console.error('Error creating comment:', error);
    }
  };

  // Subscribe to new forum posts in real-time
  useEffect(() => {
    const unsubscribe = realtimeService.subscribeToNewForumPosts(() => {
      // Refresh forum posts when new ones are added
      refresh();
    });

    return () => {
      unsubscribe();
    };
  }, [refresh]);

  // Expose refresh function to parent
  useEffect(() => {
    if (onRefreshReady) {
      onRefreshReady(refresh);
    }
  }, [onRefreshReady, refresh]);

  if (loading && !posts.length) {
    return (
      <View style={styles.container}>
        <View style={styles.titleContainer}>
          <Text style={styles.sectionTitle}>Recent forum</Text>
          <TouchableOpacity onPress={onSeeMorePress} activeOpacity={0.7}>
            <Text style={styles.seeMoreText}>See more...</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading forum posts...</Text>
        </View>
      </View>
    );
  }

  if (posts.length === 0 && !loading) {
    return (
      <View style={styles.container}>
        <View style={styles.titleContainer}>
          <Text style={styles.sectionTitle}>Recent forum</Text>
          <TouchableOpacity onPress={onSeeMorePress} activeOpacity={0.7}>
            <Text style={styles.seeMoreText}>See more...</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No forum posts available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.sectionTitle}>Recent forum</Text>
        <TouchableOpacity onPress={onSeeMorePress} activeOpacity={0.7}>
          <Text style={styles.seeMoreText}>See more...</Text>
        </TouchableOpacity>
      </View>

      {/* Forum Posts with Comments */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        snapToInterval={CARD_WIDTH + 16}
        decelerationRate="fast"
        snapToAlignment="start"
      >
        {posts.map((post) => (
          <ForumPostCard
            key={post.id}
            post={post}
            comments={post.comments}
            commentText={post.commentText}
            onCommentTextChange={(text) => handleCommentTextChange(post.id, text)}
            onCommentSubmit={() => handleCommentSubmit(post.id)}
            onPress={() => onPostPress?.(post)}
            onComment={() => onPostPress?.(post)}
            onShare={() => {}}
            onReply={() => {}}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 32,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Rubik',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  seeMoreText: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FFFFFF',
  },
  loadingContainer: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#808080',
    marginTop: 8,
  },
  emptyContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#808080',
  },
  scrollContent: {
    paddingLeft: 24,
    paddingRight: 8,
  },
});
