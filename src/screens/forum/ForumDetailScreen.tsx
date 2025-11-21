import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl,
  LayoutChangeEvent,
  Keyboard,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ForumPostWithUser, ForumCommentWithUser } from '../../types/forum.types';
import { forumService } from '../../services/forum';
import { useDataFetch } from '../../hooks/useDataFetch';
import dataManager, { RequestPriority } from '../../services/dataManager';
import { useAuth } from '../../context/AuthContext';
import { useFavorites } from '../../context/FavoritesContext';
import { RateLimiter } from '../../utils/throttle';
import { profilesService } from '../../services/profiles';
import { Dimensions } from 'react-native';

interface ForumDetailRouteParams {
  postId: string;
  initialPost?: ForumPostWithUser | null;
}

interface CommentItem extends ForumCommentWithUser {
  replies?: ForumCommentWithUser[];
  repliesOffset?: number;
  repliesHasMore?: boolean;
  repliesLoading?: boolean;
  showReplies?: boolean;
}

const PAGE_SIZE = 20;
const REPLY_PAGE_SIZE = 20;
const SCREEN_WIDTH = Dimensions.get('window').width;
const FALLBACK_IMAGE = 'https://picsum.photos/1200/800';

const timeAgo = (dateString?: string) => {
  if (!dateString) return '';
  const diffMs = Date.now() - new Date(dateString).getTime();
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.floor(day / 7);
  if (week < 4) return `${week}w ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}mo ago`;
  const year = Math.floor(day / 365);
  return `${year}y ago`;
};

export const ForumDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { postId, initialPost } = (route.params as ForumDetailRouteParams) || {};
  const { user } = useAuth();
  const { isForumPostLiked, toggleForumFavorite } = useFavorites();
  const [commentText, setCommentText] = useState('');
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [commentsOffset, setCommentsOffset] = useState(0);
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const likeLimiter = useRef(new RateLimiter(15, 10000));
  const [inputBarHeight, setInputBarHeight] = useState(96);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates?.height || 0);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const {
    data: post,
    loading: postLoading,
    refresh: refreshPost,
  } = useDataFetch<ForumPostWithUser | null>({
    cacheKey: postId ? `forum:post:${postId}` : 'forum:post:unknown',
    fetchFn: () => forumService.getPostById(postId!),
    priority: RequestPriority.HIGH,
    enabled: !!postId,
  });

  const currentPost = post || initialPost || null;
  const postLiked = currentPost?.id ? isForumPostLiked(currentPost.id) : false;
  const postAuthor = currentPost?.profiles;

  const { data: currentProfile } = useDataFetch({
    cacheKey: 'profile:current',
    fetchFn: () => profilesService.getCurrentUserProfile(),
    priority: RequestPriority.MEDIUM,
    enabled: !!user,
  });

  const invalidateForumCaches = useCallback(() => {
    dataManager.invalidateCache(/^home:forum/);
    dataManager.invalidateCache(/^explore:forum/);
    if (postId) {
      dataManager.invalidateCache(`forum:post:${postId}`);
    }
  }, [postId]);

  const fetchComments = useCallback(
    async (reset = false) => {
      if (!postId) return;
      if (reset) {
        setLoadingComments(true);
      } else {
        setLoadingMore(true);
      }
      try {
        const nextOffset = reset ? 0 : commentsOffset;
        const fetched = await forumService.getPostComments(postId, {
          limit: PAGE_SIZE,
          offset: nextOffset,
          parentCommentId: null,
        });

        const merged = reset ? fetched : [...comments, ...fetched];
        setComments(merged as CommentItem[]);
        setCommentsOffset(nextOffset + fetched.length);
        setHasMoreComments(fetched.length === PAGE_SIZE);

        if (user?.id) {
          const likedIds = await forumService.getUserCommentLikes(fetched.map(c => c.id));
          setLikedComments(prev => new Set([...prev, ...likedIds]));
        }
      } catch (err) {
        console.error('Error loading comments', err);
      } finally {
        setLoadingComments(false);
        setLoadingMore(false);
      }
    },
    [postId, comments, commentsOffset, user?.id]
  );

  useEffect(() => {
    fetchComments(true);
  }, [postId]);

  const handleLikePost = async () => {
    if (!currentPost) return;
    try {
      await toggleForumFavorite(currentPost.id);
      refreshPost();
    } catch (err) {
      console.error('Error liking post', err);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in to like comments.');
      return;
    }
    if (!likeLimiter.current.canCall()) return;
    likeLimiter.current.recordCall();

    const isLiked = likedComments.has(commentId);
    setLikedComments(prev => {
      const next = new Set(prev);
      if (isLiked) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
    setComments(prev =>
      prev.map(c =>
        c.id === commentId
          ? { ...c, like_count: Math.max(0, (c.like_count || 0) + (isLiked ? -1 : 1)) }
          : {
              ...c,
              replies: c.replies?.map(r =>
                r.id === commentId
                  ? { ...r, like_count: Math.max(0, (r.like_count || 0) + (isLiked ? -1 : 1)) }
                  : r
              ),
            }
      )
    );

    try {
      if (isLiked) {
        await forumService.unlikeComment(commentId);
      } else {
        await forumService.likeComment(commentId);
      }
    } catch (err) {
      console.error('Error toggling comment like', err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    Alert.alert('Delete comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await forumService.deleteComment(commentId);
            setComments(prev =>
              prev
                .filter(c => c.id !== commentId)
                .map(c => ({
                  ...c,
                  replies: c.replies?.filter(r => r.id !== commentId),
                }))
            );
            invalidateForumCaches();
          } catch (err) {
            console.error('Error deleting comment', err);
            Alert.alert('Delete failed', 'Unable to delete this comment right now.');
          }
        },
      },
    ]);
  };

  const handleReplyToggle = async (comment: CommentItem) => {
    if (comment.showReplies) {
      setComments(prev =>
        prev.map(c => (c.id === comment.id ? { ...c, showReplies: false } : c))
      );
      return;
    }

    // Load initial replies
    setComments(prev =>
      prev.map(c =>
        c.id === comment.id ? { ...c, repliesLoading: true, showReplies: true } : c
      )
    );
    try {
      const replies = await forumService.getPostComments(comment.post_id, {
        limit: REPLY_PAGE_SIZE,
        offset: 0,
        parentCommentId: comment.id,
      });
      const likedIds = user?.id ? await forumService.getUserCommentLikes(replies.map(r => r.id)) : [];
      if (likedIds.length) {
        setLikedComments(prev => new Set([...prev, ...likedIds]));
      }
      setComments(prev =>
        prev.map(c =>
          c.id === comment.id
            ? {
                ...c,
                replies,
                repliesOffset: replies.length,
                repliesHasMore: replies.length === REPLY_PAGE_SIZE,
                repliesLoading: false,
                showReplies: true,
              }
            : c
        )
      );
    } catch (err) {
      console.error('Error loading replies', err);
      setComments(prev =>
        prev.map(c => (c.id === comment.id ? { ...c, repliesLoading: false } : c))
      );
    }
  };

  const handleLoadMoreReplies = async (comment: CommentItem) => {
    if (comment.repliesLoading || !comment.repliesHasMore) return;
    setComments(prev =>
      prev.map(c => (c.id === comment.id ? { ...c, repliesLoading: true } : c))
    );
    try {
      const replies = await forumService.getPostComments(comment.post_id, {
        limit: REPLY_PAGE_SIZE,
        offset: comment.repliesOffset || 0,
        parentCommentId: comment.id,
      });
      const likedIds = user?.id ? await forumService.getUserCommentLikes(replies.map(r => r.id)) : [];
      if (likedIds.length) {
        setLikedComments(prev => new Set([...prev, ...likedIds]));
      }
      setComments(prev =>
        prev.map(c =>
          c.id === comment.id
            ? {
                ...c,
                replies: [...(c.replies || []), ...replies],
                repliesOffset: (c.repliesOffset || 0) + replies.length,
                repliesHasMore: replies.length === REPLY_PAGE_SIZE,
                repliesLoading: false,
              }
            : c
        )
      );
    } catch (err) {
      console.error('Error loading more replies', err);
      setComments(prev =>
        prev.map(c => (c.id === comment.id ? { ...c, repliesLoading: false } : c))
      );
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;
    if (!postId) return;
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in to comment.');
      return;
    }
    const content = commentText.trim();
    setCommentText('');
    const parentId = replyTarget;
    try {
      const created = await forumService.createComment({
        post_id: postId,
        content,
        parent_comment_id: parentId || null,
      });

      const newComment: CommentItem = {
        ...created,
        profiles: currentProfile || currentPost?.profiles,
        like_count: 0,
        reply_count: 0,
      };

      if (parentId) {
        setComments(prev =>
          [
            ...prev.map(c =>
            c.id === parentId
              ? {
                  ...c,
                  replies: c.replies ? [newComment, ...c.replies] : [newComment],
                  reply_count: (c.reply_count || 0) + 1,
                  showReplies: true,
                }
              : c),
          ]
        );
      } else {
        setComments(prev => [newComment, ...prev]);
      }
      setReplyTarget(null);
      invalidateForumCaches();
    } catch (err) {
      console.error('Error creating comment', err);
      Alert.alert('Unable to post', 'Please try again in a moment.');
      setCommentText(content);
    }
  };

  const renderComment = ({ item }: { item: CommentItem }) => {
    const isOwner = user?.id === item.user_id;
    const isLiked = likedComments.has(item.id);
    return (
      <View style={styles.commentCard}>
        <View style={styles.commentHeader}>
          <View style={styles.commentAuthorRow}>
            <Image
              source={{ uri: item.profiles?.avatar_url || 'https://picsum.photos/200' }}
              style={styles.commentAvatar}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.commentAuthor} numberOfLines={1}>
                {item.profiles?.username || 'Member'}
              </Text>
              <Text style={styles.commentMeta}>{timeAgo(item.created_at)}</Text>
            </View>
          </View>
          <View style={styles.commentActions}>
            <TouchableOpacity onPress={() => handleLikeComment(item.id)} activeOpacity={0.7} style={styles.likeButton}>
              <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={18} color={isLiked ? '#DC143C' : '#FFFFFF'} />
              <Text style={styles.likeCount}>{item.like_count || 0}</Text>
            </TouchableOpacity>
            {isOwner && (
              <TouchableOpacity onPress={() => handleDeleteComment(item.id)} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={18} color="#FF7676" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={styles.commentContent}>{item.content}</Text>
        <View style={styles.commentFooter}>
          <TouchableOpacity onPress={() => setReplyTarget(item.id)} activeOpacity={0.7}>
            <Text style={styles.replyText}>Reply</Text>
          </TouchableOpacity>
          {item.reply_count ? (
            <TouchableOpacity onPress={() => handleReplyToggle(item)} activeOpacity={0.7}>
              <Text style={styles.replyToggleText}>
                {item.showReplies ? 'Hide replies' : `View replies (${item.reply_count})`}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {item.showReplies && item.replies && (
          <View style={styles.repliesContainer}>
            {item.replies.map((reply) => {
              const replyLiked = likedComments.has(reply.id);
              const replyOwner = user?.id === reply.user_id;
              return (
                <View key={reply.id} style={styles.replyRow}>
                  <View style={styles.threadLine} />
                  <View style={styles.replyContent}>
                    <View style={styles.commentHeader}>
                      <View style={styles.commentAuthorRow}>
                        <Image
                          source={{ uri: reply.profiles?.avatar_url || 'https://picsum.photos/200' }}
                          style={styles.replyAvatar}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.commentAuthor} numberOfLines={1}>
                            {reply.profiles?.username || 'Member'}
                          </Text>
                    <Text style={styles.commentMeta}>{timeAgo(reply.created_at)}</Text>
                  </View>
                </View>
                      <View style={styles.commentActions}>
                        <TouchableOpacity onPress={() => handleLikeComment(reply.id)} activeOpacity={0.7} style={styles.likeButton}>
                          <Ionicons name={replyLiked ? 'heart' : 'heart-outline'} size={16} color={replyLiked ? '#DC143C' : '#FFFFFF'} />
                          <Text style={styles.likeCount}>{reply.like_count || 0}</Text>
                        </TouchableOpacity>
                        {replyOwner && (
                          <TouchableOpacity onPress={() => handleDeleteComment(reply.id)} activeOpacity={0.7}>
                            <Ionicons name="trash-outline" size={16} color="#FF7676" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    <Text style={styles.commentContent}>{reply.content}</Text>
                  </View>
                </View>
              );
            })}
            {item.repliesHasMore && (
              <TouchableOpacity
                style={styles.loadMoreReplies}
                onPress={() => handleLoadMoreReplies(item)}
                activeOpacity={0.75}
              >
                {item.repliesLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.loadMoreText}>View more replies</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const listHeader = useMemo(() => {
    if (postLoading && !currentPost && !initialPost) {
      return (
        <View style={styles.headerState}>
          <ActivityIndicator size="large" color="#DC143C" />
        </View>
      );
    }
    if (!currentPost) {
      return (
        <View style={styles.headerState}>
          <Text style={styles.stateTitle}>Post not found</Text>
          <TouchableOpacity onPress={refreshPost} style={styles.retryButton} activeOpacity={0.8}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    const heroImages = currentPost.image_urls?.length ? currentPost.image_urls : [FALLBACK_IMAGE];
    return (
      <View style={styles.postCard}>
        <View style={styles.postImageWrapper}>
          <FlatList
            data={heroImages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={SCREEN_WIDTH}
            decelerationRate="fast"
            snapToAlignment="start"
            keyExtractor={(item, index) => `${item}-${index}`}
            onScroll={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              if (idx !== heroIndex) setHeroIndex(idx);
            }}
            scrollEventThrottle={16}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={styles.postImage} contentFit="cover" />
            )}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setHeroIndex(idx);
            }}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
          />
          {postAuthor && (
            <View style={styles.heroAuthor}>
              <Image
                source={{ uri: postAuthor.avatar_url || 'https://picsum.photos/200' }}
                style={styles.heroAuthorAvatar}
              />
              <Text style={styles.heroAuthorName} numberOfLines={1}>
                {postAuthor.username || postAuthor.full_name || 'Member'}
              </Text>
            </View>
          )}
          {heroImages.length > 1 && (
            <View style={styles.pagination}>
              {heroImages.map((_, idx) => (
                <View
                  key={`dot-${idx}`}
                  style={[styles.dotSmall, heroIndex === idx && styles.dotSmallActive]}
                />
              ))}
            </View>
          )}
        </View>
        <View style={styles.postMetaRow}>
          <View style={styles.metaLeft}>
            <Text style={styles.metaText}>{currentPost.model || 'GT-R'}</Text>
            <View style={styles.dot} />
            <Text style={styles.metaText}>{timeAgo(currentPost.created_at)}</Text>
          </View>
          <View style={styles.iconRow}>
            <TouchableOpacity onPress={handleLikePost} activeOpacity={0.7} style={styles.iconButton}>
              <Ionicons
                name={postLiked ? 'heart' : 'heart-outline'}
                size={22}
                color={postLiked ? '#DC143C' : '#FFFFFF'}
              />
              <Text style={styles.iconValue}>{currentPost.like_count || 0}</Text>
            </TouchableOpacity>
            <View style={styles.iconButton}>
              <Ionicons name="chatbubble-outline" size={22} color="#FFFFFF" />
              <Text style={styles.iconValue}>{currentPost.comment_count || 0}</Text>
            </View>
            <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
              <Ionicons name="paper-plane-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.postTitle}>{currentPost.title}</Text>
        <Text style={styles.postBody}>{currentPost.content}</Text>
        <View style={styles.commentsHeaderRow}>
          <Text style={styles.commentsTitle}>Comments</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{currentPost.comment_count || comments.length}</Text>
          </View>
        </View>
      </View>
    );
  }, [postLoading, currentPost, initialPost, postLiked, comments.length, heroIndex]);

  const onInputLayout = (event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    if (height !== inputBarHeight) {
      setInputBarHeight(height);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Forum Post
        </Text>
        <View style={styles.headerPlaceholder} />
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={renderComment}
          ListHeaderComponent={listHeader}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: inputBarHeight + keyboardHeight + 48 },
          ]}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (hasMoreComments && !loadingMore && !loadingComments) {
              fetchComments(false);
            }
          }}
          refreshControl={
            <RefreshControl
              refreshing={loadingComments}
              onRefresh={() => fetchComments(true)}
              tintColor="#DC143C"
            />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            ) : null
          }
        />
        <View
          style={[
            styles.inputBar,
            { bottom: keyboardHeight ? keyboardHeight + 8 : 0 },
          ]}
          onLayout={onInputLayout}
        >
          {replyTarget && (
            <View style={styles.replyingTo}>
              <Text style={styles.replyingText}>Replying</Text>
              <TouchableOpacity onPress={() => setReplyTarget(null)} activeOpacity={0.7}>
                <Ionicons name="close" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={replyTarget ? 'Reply to comment...' : 'Add a comment...'}
              placeholderTextColor="#808080"
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <TouchableOpacity style={styles.sendButton} onPress={handleSubmitComment} activeOpacity={0.8}>
              <Ionicons name="send" size={20} color="#181920" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#11121A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1F2B',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  headerPlaceholder: {
    width: 44,
  },
  flex: {
    flex: 1,
  },
  listContent: {
    backgroundColor: '#11121A',
  },
  postCard: {
    paddingBottom: 16,
    marginBottom: 8,
    backgroundColor: '#11121A',
  },
  postImageWrapper: {
    height: 260,
    width: SCREEN_WIDTH,
    borderRadius: 0,
    overflow: 'hidden',
    marginHorizontal: 0,
    marginBottom: 12,
  },
  postImage: {
    width: SCREEN_WIDTH,
    height: '100%',
    backgroundColor: '#1F222A',
  },
  pagination: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotSmallActive: {
    backgroundColor: '#FFFFFF',
  },
  postMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    color: '#C7CAD7',
    fontSize: 13,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C7CAD7',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconValue: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  postTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  postBody: {
    color: '#C7CAD7',
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  commentsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 16,
  },
  commentsTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 2,
    minWidth: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  commentCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1F2B',
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  commentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  commentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#222436',
  },
  commentAuthor: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  commentMeta: {
    color: '#8A8FA6',
    fontSize: 12,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likeCount: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  commentContent: {
    color: '#C7CAD7',
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  heroAuthor: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  heroAuthorAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1F222A',
  },
  heroAuthorName: {
    color: '#FFFFFF',
    fontWeight: '700',
    maxWidth: 180,
  },
  commentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 10,
  },
  replyText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  replyToggleText: {
    color: '#8A8FA6',
    fontSize: 13,
  },
  repliesContainer: {
    marginTop: 10,
    gap: 12,
  },
  replyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  threadLine: {
    width: 16,
    borderLeftWidth: 1,
    borderLeftColor: '#222436',
  },
  replyContent: {
    flex: 1,
    paddingLeft: 4,
    gap: 6,
  },
  replyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#222436',
  },
  loadMoreReplies: {
    paddingVertical: 8,
  },
  loadMoreText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  inputBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: '#0E0F16',
    borderTopWidth: 1,
    borderTopColor: '#1E1F2B',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#181A28',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    maxHeight: 120,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyingTo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  replyingText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  footerLoader: {
    paddingVertical: 16,
  },
  headerState: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    marginTop: 8,
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  retryText: {
    color: '#181920',
    fontWeight: '700',
  },
});
