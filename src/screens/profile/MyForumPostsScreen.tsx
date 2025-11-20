import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { forumService } from '../../services/forum';
import { ForumPostWithUser } from '../../types/forum.types';
import { ForumPostCard } from '../../components/shared/ForumPostCard';
import { useDataFetch } from '../../hooks/useDataFetch';
import dataManager, { RequestPriority } from '../../services/dataManager';
import { useDeleteConfirmation } from '../../hooks/useDeleteConfirmation';

export const MyForumPostsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const { confirmDelete, DeleteConfirmationModal } = useDeleteConfirmation();

  const { data: posts, loading, refresh } = useDataFetch<ForumPostWithUser[]>({
    cacheKey: `user:forum:posts:${user?.id || ''}`,
    fetchFn: () => forumService.getUserPosts(user?.id || ''),
    priority: RequestPriority.HIGH,
    enabled: !!user,
  });

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handlePostPress = (post: ForumPostWithUser) => {
    // TODO: Navigate to post detail
    console.log('Post pressed:', post.id);
  };

  const handleLike = () => {
    // Refresh posts after like
    refresh();
  };

  const invalidateForumCaches = useCallback(() => {
    dataManager.invalidateCache(new RegExp(`^user:forum:posts:${user?.id || ''}`));
    dataManager.invalidateCache(/^home:forum/);
    dataManager.invalidateCache(/^explore:forum/);
  }, [user?.id]);

  const handleDeletePost = useCallback(
    async (post: ForumPostWithUser) => {
      const confirmed = await confirmDelete({
        title: 'Delete post',
        message: 'Are you sure you want to delete this forum post? This action cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Keep post',
      });

      if (!confirmed) {
        return;
      }

      try {
        await forumService.deletePost(post.id);
        invalidateForumCaches();
        await refresh();
      } catch (error) {
        console.error('Failed to delete post', error);
        Alert.alert('Delete failed', 'Unable to delete post. Please try again.');
      }
    },
    [confirmDelete, invalidateForumCaches, refresh]
  );

  const handleEditPost = useCallback(
    (post: ForumPostWithUser) => {
      navigation.navigate('CreateForumPost', { postToEdit: post });
    },
    [navigation]
  );

  return (
    <>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Forum Posts</Text>
          <View style={styles.placeholder} />
        </View>

        {loading && !posts ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#DC143C" />
            <Text style={styles.loadingText}>Loading posts...</Text>
          </View>
        ) : posts && posts.length > 0 ? (
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.cardWrapper}>
                <ForumPostCard
                  post={item}
                  onPress={() => handlePostPress(item)}
                  mode="owner"
                  onEdit={() => handleEditPost(item)}
                  onDelete={() => handleDeletePost(item)}
                  containerStyle={styles.cardFullWidth}
                />
              </View>
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#DC143C"
              />
            }
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#808080" />
            <Text style={styles.emptyText}>No posts yet</Text>
            <Text style={styles.emptySubtext}>Share your GT-R experiences with the community</Text>
          </View>
        )}
      </SafeAreaView>
      {DeleteConfirmationModal}
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#13141C',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2D3A',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    marginLeft: -20,
  },
  placeholder: {
    width: 44,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#808080',
    fontSize: 14,
  },
  listContent: {
    paddingVertical: 16,
    paddingBottom: 32,
  },
  cardWrapper: {
    paddingHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  cardFullWidth: {
    width: '100%',
    marginRight: 0,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#808080',
    textAlign: 'center',
  },
});
