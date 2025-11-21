import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ForumCommentWithUser } from '../../types/forum.types';
import { FALLBACK_AVATAR, pickAvatarSource } from '../../utils/imageFallbacks';

interface CommentCardProps {
  comment: ForumCommentWithUser;
  onReply?: () => void;
}

export const CommentCard: React.FC<CommentCardProps> = ({
  comment,
  onReply,
}) => {
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
  };

  const avatarUrl = comment.profiles?.avatar_url || null;
  const avatarSource = pickAvatarSource(avatarUrl);
  const username = comment.profiles?.username || comment.profiles?.full_name || 'Anonymous';

  return (
    <View style={styles.container}>
      <Image
        source={avatarSource}
        style={styles.avatar}
        contentFit="cover"
      />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.username}>{username}</Text>
        </View>
        <Text style={styles.commentText} numberOfLines={2}>
          {comment.content}
        </Text>
        <View style={styles.footer}>
          <Text style={styles.timestamp}>{formatTimeAgo(comment.created_at)}</Text>
          <TouchableOpacity onPress={onReply}>
            <Text style={styles.replyText}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333333',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  username: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '600',
    color: '#FFFFFF',
  },
  commentText: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#808080',
    marginBottom: 8,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timestamp: {
    fontSize: 12,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#808080',
  },
  replyText: {
    fontSize: 12,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#808080',
  },
});
