import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ForumPostWithUser, ForumCommentWithUser } from '../../types/forum.types';
import { CommentCard } from './CommentCard';

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
}) => {
  const [isLiked, setIsLiked] = useState(false);

  const handleLike = () => {
    setIsLiked(!isLiked);
    onLike?.();
  };

  const primaryImage = post.image_urls && post.image_urls.length > 0 
    ? post.image_urls[0] 
    : 'https://picsum.photos/800/600';

  return (
    <View style={styles.container}>
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
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleLike}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={24}
                color={isLiked ? '#DC143C' : '#FFFFFF'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onComment}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubble-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onShare}
              activeOpacity={0.7}
            >
              <Ionicons name="paper-plane-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      {/* Comments Section */}
      {comments.length > 0 && (
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
  },
});

