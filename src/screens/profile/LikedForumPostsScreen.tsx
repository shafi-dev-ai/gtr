import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { forumService } from '../../services/forum';
import { ForumPostWithUser } from '../../types/forum.types';
import { ForumPostCard } from '../../components/shared/ForumPostCard';
import { useDataFetch } from '../../hooks/useDataFetch';
import dataManager, { RequestPriority } from '../../services/dataManager';
import { useFavorites } from '../../context/FavoritesContext';

export const LikedForumPostsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const { forumFavoritesVersion } = useFavorites();

  const { data: posts, loading, refresh } = useDataFetch<ForumPostWithUser[]>({
    cacheKey: `user:favorites:forum:${user?.id || ''}`,
    fetchFn: () => forumService.getLikedPosts(),
    priority: RequestPriority.HIGH,
    enabled: !!user,
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handlePostPress = (post: ForumPostWithUser) => {
    navigation.navigate('ForumDetail', {
      postId: post.id,
      initialPost: post,
    });
  };

  useEffect(() => {
    if (user?.id && forumFavoritesVersion > 0) {
      dataManager.invalidateCache(`user:favorites:forum:${user.id}`);
      refresh();
    }
  }, [forumFavoritesVersion, user?.id, refresh]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Liked Forum Posts</Text>
        <View style={styles.placeholder} />
      </View>

      {loading && !posts ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC143C" />
          <Text style={styles.loadingText}>Loading liked posts...</Text>
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
                containerStyle={styles.cardFullWidth}
                showComments={false}
                showCommentInput={false}
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
          <Ionicons name="heart-outline" size={64} color="#808080" />
          <Text style={styles.emptyText}>No liked forum posts</Text>
          <Text style={styles.emptySubtext}>
            Tap the heart icon on forum posts to save them here
          </Text>
        </View>
      )}
    </SafeAreaView>
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
    paddingHorizontal: 32,
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
