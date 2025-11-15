import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions, TouchableOpacity } from 'react-native';
import { ListingCard } from '../shared/ListingCard';
import { SearchBar } from '../common/SearchBar';
import { listingsService } from '../../services/listings';
import { ListingWithImages } from '../../types/listing.types';
import { profilesService } from '../../services/profiles';
import { useDataFetch } from '../../hooks/useDataFetch';
import { RequestPriority } from '../../services/dataManager';
import { useAuth } from '../../context/AuthContext';
import { realtimeService } from '../../services/realtime';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48; // Screen width minus padding

interface ListingsSectionProps {
  onListingPress?: (listingId: string) => void;
  onChatPress?: (listingId: string) => void;
  onFavorite?: (listingId: string) => void;
  onSearchPress?: () => void;
  onSearchSubmit?: (searchQuery: string) => void;
  onSeeMorePress?: () => void;
  onRefreshReady?: (refreshFn: () => Promise<void>) => void;
}

export const ListingsSection: React.FC<ListingsSectionProps> = ({
  onListingPress,
  onChatPress,
  onFavorite,
  onSearchPress,
  onSearchSubmit,
  onSeeMorePress,
  onRefreshReady,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const { user } = useAuth();

  // Fetch listings using DataManager
  const { data: allListings, loading, refresh } = useDataFetch<ListingWithImages[]>({
    cacheKey: 'home:listings:nearby:5',
    fetchFn: async () => {
      const listings = await listingsService.getAllListings();
      return listings;
    },
    priority: RequestPriority.HIGH,
  });

  // Fetch user profile for location filtering
  const { data: profile } = useDataFetch({
    cacheKey: 'profile:current',
    fetchFn: () => profilesService.getCurrentUserProfile(),
    priority: RequestPriority.HIGH,
  });

  const visibleListings = useMemo(() => {
    if (!allListings) return [];
    if (!user?.id) return allListings;
    return allListings.filter((listing) => listing.user_id !== user.id);
  }, [allListings, user?.id]);

  // Sort and filter listings based on location
  const sortedListings = useMemo(() => {
    if (!visibleListings) return [];
    
    let sorted = visibleListings;
    if (profile?.location) {
      const locationParts = profile.location.split(',').map(s => s.trim());
      const userCity = locationParts[0]?.toLowerCase();
      const userState = locationParts[1]?.toLowerCase();
      
      if (userCity || userState) {
        const locationListings: ListingWithImages[] = [];
        const otherListings: ListingWithImages[] = [];

        visibleListings.forEach((listing) => {
          const listingCity = listing.city?.toLowerCase();
          const listingState = listing.state?.toLowerCase();
          const matchesLocation =
            (userCity && listingCity?.includes(userCity)) ||
            (userState && listingState?.includes(userState));

          if (matchesLocation) {
            locationListings.push(listing);
          } else {
            otherListings.push(listing);
          }
        });

        sorted = [...locationListings, ...otherListings];
      }
    }

    return sorted.slice(0, 5);
  }, [visibleListings, profile]);

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      onSearchSubmit?.(searchQuery.trim());
      setSearchQuery('');
    } else {
      onSearchPress?.();
    }
  };

  // Subscribe to new listings in real-time
  useEffect(() => {
    const unsubscribe = realtimeService.subscribeToNewListings(() => {
      // Refresh listings when new ones are added
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

  if (loading && !sortedListings.length) {
    return (
      <View style={styles.container}>
        <View style={styles.searchContainer}>
          <SearchBar
            placeholder="Search listings..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            onPress={onSearchPress}
            editable={true}
          />
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.sectionTitle}>{profile?.location ? 'Nearby Listings' : 'Featured Listings'}</Text>
          <TouchableOpacity onPress={onSeeMorePress} activeOpacity={0.7}>
            <Text style={styles.seeMoreText}>See more...</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading listings...</Text>
        </View>
      </View>
    );
  }

  if (sortedListings.length === 0 && !loading) {
    return (
      <View style={styles.container}>
        <View style={styles.searchContainer}>
          <SearchBar
            placeholder="Search listings..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            onPress={onSearchPress}
            editable={true}
          />
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.sectionTitle}>Nearby Listings</Text>
          <TouchableOpacity onPress={onSeeMorePress} activeOpacity={0.7}>
            <Text style={styles.seeMoreText}>See more...</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No listings available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <SearchBar
          placeholder="Search listings..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearchSubmit}
          onPress={onSearchPress}
          editable={true}
        />
      </View>
      <View style={styles.titleContainer}>
        <Text style={styles.sectionTitle}>
          {profile?.location ? 'Nearby Listings' : 'Featured Listings'}
        </Text>
        <TouchableOpacity onPress={onSeeMorePress} activeOpacity={0.7}>
          <Text style={styles.seeMoreText}>See more...</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        snapToInterval={CARD_WIDTH + 16}
        decelerationRate="fast"
        snapToAlignment="start"
      >
        {sortedListings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            onPress={() => onListingPress?.(listing.id)}
            onChatPress={() => onChatPress?.(listing.id)}
            onFavorite={() => onFavorite?.(listing.id)}
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
  searchContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  seeMoreText: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Rubik',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingLeft: 24,
    paddingRight: 8,
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
});

