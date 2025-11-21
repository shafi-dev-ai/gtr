import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
import { useFavorites } from '../../context/FavoritesContext';
import { eventFavoritesService, FavoriteEvent } from '../../services/eventFavorites';
import { EventCard } from '../../components/shared/EventCard';
import { useDataFetch } from '../../hooks/useDataFetch';
import { RequestPriority } from '../../services/dataManager';
import dataManager from '../../services/dataManager';

export const LikedEventsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { refreshEventFavorites, eventFavoritesVersion, favoriteEvents: contextFavoriteEvents } = useFavorites();
  const [refreshing, setRefreshing] = useState(false);

  const { data: favoriteEvents, loading, refresh } = useDataFetch<FavoriteEvent[]>({
    cacheKey: `user:favorites:events:${user?.id || ''}`,
    fetchFn: () => eventFavoritesService.getUserFavoriteEvents(100, 0),
    priority: RequestPriority.HIGH,
    enabled: !!user,
  });

  // Refresh when favorites context updates (version changes)
  useEffect(() => {
    if (user?.id && eventFavoritesVersion > 0) {
      // Invalidate cache first, then refresh to ensure fresh data
      const refreshData = async () => {
        dataManager.invalidateCache(`user:favorites:events:${user.id}`);
        // Small delay to ensure API has processed the change
        await new Promise(resolve => setTimeout(resolve, 300));
        await refresh();
      };
      refreshData();
    }
  }, [eventFavoritesVersion, user?.id, refresh]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Refresh both context and data fetch
    await Promise.all([
      refreshEventFavorites(),
      refresh(),
    ]);
    setRefreshing(false);
  }, [refresh, refreshEventFavorites]);

  const handleEventPress = (event: FavoriteEvent) => {
    navigation.navigate('EventDetail', {
      eventId: event.id,
      initialEvent: event,
    });
  };

  const handleFavorite = () => {
    // FavoritesContext handles real-time updates and will trigger refresh
    refresh();
  };

  // Filter events based on context to immediately remove unfavorited items
  const eventsForDisplay = useMemo(() => {
    if (!favoriteEvents) return [];
    
    // Filter out items that are no longer in the context Set (immediate removal)
    return favoriteEvents.filter((event) => 
      contextFavoriteEvents.has(event.id)
    );
  }, [favoriteEvents, contextFavoriteEvents]);

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
        <Text style={styles.headerTitle}>Liked Events</Text>
        <View style={styles.placeholder} />
      </View>

      {loading && !favoriteEvents ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC143C" />
          <Text style={styles.loadingText}>Loading favorites...</Text>
        </View>
      ) : eventsForDisplay && eventsForDisplay.length > 0 ? (
        <FlatList
          data={eventsForDisplay}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <EventCard
                event={item}
                onPress={() => handleEventPress(item)}
                onFavorite={handleFavorite}
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
          <Ionicons name="heart-outline" size={64} color="#808080" />
          <Text style={styles.emptyText}>No liked events yet</Text>
          <Text style={styles.emptySubtext}>Like events you're interested in attending</Text>
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
