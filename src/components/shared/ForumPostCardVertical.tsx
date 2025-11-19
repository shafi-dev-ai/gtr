import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ForumPostWithUser } from '../../types/forum.types';
import { useFavorites } from '../../context/FavoritesContext';
import { RateLimiter } from '../../utils/throttle';
import { realtimeService } from '../../services/realtime';

interface ForumPostCardVerticalProps {
  post: ForumPostWithUser;
  onPress?: () => void;
}

export const ForumPostCardVertical: React.FC<ForumPostCardVerticalProps> = ({ post, onPress }) => {
  const { isForumPostLiked, toggleForumFavorite } = useFavorites();
  const [likeCount, setLikeCount] = useState(post.like_count || 0);
  const rateLimiter = useRef(new RateLimiter(10, 10000));
  const isLiked = isForumPostLiked(post.id);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    const setup = async () => {
      try {
        unsubscribe = await realtimeService.subscribeToPostLike(post.id, (_, count) => {
          setLikeCount(count);
        });
      } catch (error) {
        console.error('Error subscribing to post likes:', error);
      }
    };
    setup();
    return () => {
      unsubscribe?.();
    };
  }, [post.id]);

  const handleLikePress = async () => {
    if (!rateLimiter.current.canCall()) return;
    rateLimiter.current.recordCall();
    const prevCount = likeCount;
    setLikeCount(isLiked ? Math.max(0, likeCount - 1) : likeCount + 1);
    try {
      await toggleForumFavorite(post.id);
    } catch (error) {
      console.error('Error toggling forum favorite:', error);
      setLikeCount(prevCount);
    }
  };

  const primaryImage = post.image_urls?.[0] || 'https://picsum.photos/800/600';

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={onPress}>
      <Image source={{ uri: primaryImage }} style={styles.image} contentFit="cover" />

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {post.title}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {post.content}
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleLikePress} activeOpacity={0.8}>
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={20}
              color={isLiked ? '#DC143C' : '#FFFFFF'}
            />
            <Text style={styles.actionText}>{likeCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
            <Ionicons name='chatbubble-outline' size={20} color='#FFFFFF'/>
            <Text style={styles.actionText}>{post.comment_count || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} activeOpacity={0.8}>
            <Ionicons name='share-outline' size={20} color='#FFFFFF'/>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#1F222A',
    borderRadius: 20,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 200,
    backgroundColor: '#2B2F3C',
  },
  content: {
    padding: 16,
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  description: {
    color: '#C7CAD7',
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
