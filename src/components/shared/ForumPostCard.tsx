import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput, StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ForumPostWithUser, ForumCommentWithUser } from '../../types/forum.types';
import { CommentCard } from './CommentCard';
import { realtimeService } from '../../services/realtime';
import { RateLimiter } from '../../utils/throttle';
import { useFavorites } from '../../context/FavoritesContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48; // Screen width minus padding

interface ForumPostCardProps {
  post: ForumPostWithUser;
  comments?: ForumCommentWithUser[];
  commentText?: string;
  onCommentTextChange?: (text: string) => void;
  onCommentSubmit?: () => void;
  onPress?: () => void;
  onLike?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onReply?: (commentId: string) => void;
  containerStyle?: StyleProp<ViewStyle>;
  mode?: 'default' | 'owner';
  onEdit?: () => void;
  onDelete?: () => void;
  showComments?: boolean;
  showCommentInput?: boolean;
}

export const ForumPostCard: React.FC<ForumPostCardProps> = ({
  post,
  comments = [],
  commentText = '',
  onCommentTextChange,
  onCommentSubmit,
  onPress,
  onLike,
  onComment,
  onShare,
  onReply,
  containerStyle,
  mode = 'default',
  onEdit,
  onDelete,
  showComments = true,
  showCommentInput = true,
}) => {
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const { isForumPostLiked, toggleForumFavorite } = useFavorites();
  const isOwnerMode = mode === 'owner';
  const isLiked = isOwnerMode ? false : isForumPostLiked(post.id);
  const totalCommentCount =
    typeof post.comment_count === 'number' ? post.comment_count : comments.length;
  
  // Rate limiter: max 10 like actions per 10 seconds
  const likeRateLimiter = useRef(new RateLimiter(10, 10000));

  useEffect(() => {
    setLikeCount(post.like_count || 0);
  }, [post.like_count]);

  // Subscribe to real-time updates for like count
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const subscribe = async () => {
      try {
        unsubscribe = await realtimeService.subscribeToPostLike(post.id, (_, count) => {
          setLikeCount(count);
        });
      } catch (error) {
        console.error('Error subscribing to post likes:', error);
      }
    };

    subscribe();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [post.id]);

  const handleLike = async () => {
    if (isOwnerMode) return;

    // Rate limiting check
    if (!likeRateLimiter.current.canCall()) {
      console.warn('Like action rate limited');
      return;
    }

    likeRateLimiter.current.recordCall();

    const previousLiked = isLiked;
    const previousCount = likeCount;

    // Optimistic update for like count
    setLikeCount(previousLiked ? Math.max(0, previousCount - 1) : previousCount + 1);

    try {
      await toggleForumFavorite(post.id);
      onLike?.();
    } catch (error) {
      console.error('Error toggling forum favorite:', error);
      setLikeCount(previousCount);
    }
  };

  const primaryImage = post.image_urls && post.image_urls.length > 0 
    ? post.image_urls[0] 
    : 'https://picsum.photos/800/600';

  return (
    <View style={[styles.container, containerStyle]}>
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={onPress}
      >
        {/* Post Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: primaryImage }}
            style={styles.postImage}
            contentFit="cover"
          />
        </View>

        {/* Post Content */}
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {post.title}
          </Text>
          <Text style={styles.description} numberOfLines={2}>
            {post.content}
          </Text>

          {/* Interaction Icons */}
          {mode === 'owner' ? (
            <View style={styles.ownerActions}>
              {onEdit && (
                <TouchableOpacity
                  style={[styles.ownerButton, styles.ownerPrimaryButton]}
                  onPress={onEdit}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.ownerButtonText, styles.ownerPrimaryButtonText]}>Edit post</Text>
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity
                  style={[styles.ownerButton, styles.ownerDangerButton]}
                  onPress={onDelete}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.ownerButtonText, styles.ownerDangerButtonText]}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionButton} onPress={handleLike} activeOpacity={0.7}>
                <Ionicons
                  name={isLiked ? 'heart' : 'heart-outline'}
                  size={24}
                  color={isLiked ? '#DC143C' : '#FFFFFF'}
                />
                <Text style={styles.actionValue}>{likeCount}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={onComment} activeOpacity={0.7}>
                <Ionicons name="chatbubble-outline" size={24} color="#FFFFFF" />
                <Text style={styles.actionValue}>{totalCommentCount}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={onShare} activeOpacity={0.7}>
                <Ionicons name="paper-plane-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Comments Section */}
      {mode !== 'owner' && showComments && comments.length > 0 && (
        <View style={styles.commentsSection}>
          {comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              onReply={() => onReply?.(comment.id)}
            />
          ))}
        </View>
      )}

      {/* Add Comment Input */}
      {mode !== 'owner' && showCommentInput && (
        <View style={styles.commentInputContainer}>
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment"
            placeholderTextColor="#808080"
            value={commentText}
            onChangeText={onCommentTextChange}
            multiline
          />
          <TouchableOpacity
            style={styles.sendButton}
            onPress={onCommentSubmit}
            activeOpacity={0.7}
          >
            <Ionicons name="send" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1F222A',
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 16,
    width: CARD_WIDTH,
  },
  commentsSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#181920',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FFFFFF',
    minHeight: 44,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#181920',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    width: '100%',
    height: 280,
  },
  postImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333333',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Rubik',
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#808080',
    marginBottom: 16,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  actionButton: {
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionValue: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '600',
    color: '#FFFFFF',
  },
  ownerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  ownerButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerButtonText: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '600',
  },
  ownerPrimaryButton: {
    backgroundColor: '#FFFFFF',
  },
  ownerPrimaryButtonText: {
    color: '#181920',
  },
  ownerDangerButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF7676',
  },
  ownerDangerButtonText: {
    color: '#FF7676',
  },
});
