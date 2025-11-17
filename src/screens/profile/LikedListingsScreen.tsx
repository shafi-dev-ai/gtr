import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useFavorites } from '../../context/FavoritesContext';
import { favoritesService, FavoriteListing } from '../../services/favorites';
import { ListingCardVertical } from '../../components/shared/ListingCardVertical';
import { useDataFetch } from '../../hooks/useDataFetch';
import { RequestPriority } from '../../services/dataManager';
import { ListingWithImages } from '../../types/listing.types';
import dataManager from '../../services/dataManager';
import { openChatWithUser } from '../../utils/chatHelpers';

export const LikedListingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { refreshListingFavorites, listingFavoritesVersion, favoriteListings: contextFavoriteListings } = useFavorites();
  const [refreshing, setRefreshing] = useState(false);

  const { data: favoriteListings, loading, refresh } = useDataFetch<FavoriteListing[]>({
    cacheKey: `user:favorites:listings:${user?.id || ''}`,
    fetchFn: () => favoritesService.getUserFavorites(100, 0),
    priority: RequestPriority.HIGH,
    enabled: !!user,
  });

  // Refresh when favorites context updates (version changes)
  useEffect(() => {
    if (user?.id && listingFavoritesVersion > 0) {
      // Invalidate cache first, then refresh to ensure fresh data
      const refreshData = async () => {
        dataManager.invalidateCache(`user:favorites:listings:${user.id}`);
        // Small delay to ensure API has processed the change
        await new Promise(resolve => setTimeout(resolve, 300));
        await refresh();
      };
      refreshData();
    }
  }, [listingFavoritesVersion, user?.id, refresh]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Refresh both context and data fetch
    await Promise.all([
      refreshListingFavorites(),
      refresh(),
    ]);
    setRefreshing(false);
  }, [refresh, refreshListingFavorites]);

  const handleListingPress = (listing: FavoriteListing) => {
    // TODO: Navigate to listing detail
    console.log('Listing pressed:', listing.id);
  };

  const handleChatPress = async (listing: FavoriteListing) => {
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in to chat with sellers.');
      return;
    }
    if (listing.user_id === user.id) {
      Alert.alert('Unavailable', 'You cannot chat with your own listing.');
      return;
    }
    await openChatWithUser({
      partnerId: listing.user_id,
      navigation,
      fallbackName: listing.model || listing.title,
    });
  };

  const handleFavorite = () => {
    // FavoritesContext handles real-time updates and will trigger refresh
    refresh();
  };

  // FavoriteListing extends ListingWithImages, so it should already have listing_images
  // Filter based on context to immediately remove unfavorited items
  const listingsForDisplay: ListingWithImages[] = useMemo(() => {
    if (!favoriteListings) return [];
    
    // Filter out items that are no longer in the context Set (immediate removal)
    const filtered = favoriteListings.filter((fav) => 
      contextFavoriteListings.has(fav.id)
    );
    
    // FavoriteListing extends ListingWithImages, so it should already have the correct structure
    return filtered.map((fav) => ({
      ...fav,
      listing_images: fav.listing_images || [],
    })) as ListingWithImages[];
  }, [favoriteListings, contextFavoriteListings]);

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
        <Text style={styles.headerTitle}>Liked Listings</Text>
        <View style={styles.placeholder} />
      </View>

      {loading && !favoriteListings ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC143C" />
          <Text style={styles.loadingText}>Loading favorites...</Text>
        </View>
      ) : listingsForDisplay && listingsForDisplay.length > 0 ? (
        <FlatList
          data={listingsForDisplay}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ListingCardVertical
              listing={item}
              onPress={() => handleListingPress(item)}
              onChatPress={() => handleChatPress(item)}
              onFavorite={handleFavorite}
            />
          )}
          contentContainerStyle={styles.listContent}
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
          <Text style={styles.emptyText}>No liked listings yet</Text>
          <Text style={styles.emptySubtext}>Start exploring and like listings you're interested in</Text>
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
    padding: 16,
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
