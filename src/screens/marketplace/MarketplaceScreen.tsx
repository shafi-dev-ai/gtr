import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SearchBar } from '../../components/common/SearchBar';
import { ListingCardVertical } from '../../components/shared/ListingCardVertical';
import { FilterModal } from '../../components/marketplace/FilterModal';
import { searchService, SearchFilters } from '../../services/search';
import { listingsService } from '../../services/listings';
import { profilesService } from '../../services/profiles';
import { ListingWithImages } from '../../types/listing.types';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { useDataFetch } from '../../hooks/useDataFetch';
import { RequestPriority } from '../../services/dataManager';

interface MarketplaceScreenProps {
  initialSearchQuery?: string;
  onListingPress?: (listingId: string) => void;
  onChatPress?: (listingId: string) => void;
  onFavorite?: (listingId: string) => void;
}

const ITEMS_PER_PAGE = 10;

export const MarketplaceScreen: React.FC<MarketplaceScreenProps> = ({
  initialSearchQuery = '',
  onListingPress,
  onChatPress,
  onFavorite,
}) => {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);

  // Fetch user profile for location
  const { data: profile } = useDataFetch({
    cacheKey: 'profile:current',
    fetchFn: () => profilesService.getCurrentUserProfile(),
    priority: RequestPriority.HIGH,
    ttl: 10 * 60 * 1000,
  });

  const userLocation = useMemo(() => {
    if (!profile?.location) return null;
    const locationParts = profile.location.split(',').map(s => s.trim());
    return {
      city: locationParts[0] || undefined,
      state: locationParts[1] || undefined,
    };
  }, [profile]);

  // Create cache key based on search and filters
  const cacheKey = useMemo(() => {
    const filterStr = JSON.stringify(filters);
    const searchStr = searchQuery.trim();
    return `marketplace:listings:${searchStr}:${filterStr}`;
  }, [searchQuery, filters]);

  // Infinite scroll for listings
  const {
    data: listings,
    loading,
    loadingMore,
    hasMore,
    refresh,
    loadMore,
  } = useInfiniteScroll<ListingWithImages>({
    cacheKey,
    fetchFn: async (offset: number, limit: number) => {
      // If search query or filters exist, use search service
      if (searchQuery.trim() || Object.keys(filters).length > 0) {
        setIsSearchMode(true);
        const searchFilters: SearchFilters = {
          ...filters,
          searchText: searchQuery.trim() || undefined,
          limit,
          offset,
        };
        return await searchService.searchListingsDirect(searchFilters);
      } else {
        // No search/filters - show location-based listings first
        setIsSearchMode(false);
        const allListings = await listingsService.getAllListings(1000); // Get more for sorting

        if (userLocation && (userLocation.city || userLocation.state)) {
          // Split into location-based and others
          const locationListings: ListingWithImages[] = [];
          const otherListings: ListingWithImages[] = [];

          allListings.forEach((listing) => {
            const matchesLocation =
              (userLocation.city &&
                listing.city?.toLowerCase().includes(userLocation.city.toLowerCase())) ||
              (userLocation.state &&
                listing.state?.toLowerCase().includes(userLocation.state.toLowerCase()));

            if (matchesLocation) {
              locationListings.push(listing);
            } else {
              otherListings.push(listing);
            }
          });

          // Combine: location listings first, then others
          const combined = [...locationListings, ...otherListings];
          return combined.slice(offset, offset + limit);
        } else {
          // No location - just show all listings
          return allListings.slice(offset, offset + limit);
        }
      }
    },
    limit: ITEMS_PER_PAGE,
    priority: RequestPriority.HIGH,
    ttl: 5 * 60 * 1000, // 5 minutes
  });

  // Update search query when initialSearchQuery changes (from home screen)
  useEffect(() => {
    setSearchQuery(initialSearchQuery);
    if (initialSearchQuery) {
      setIsSearchMode(true);
    } else {
      setIsSearchMode(false);
    }
  }, [initialSearchQuery]);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    // If search is cleared, also clear search mode
    if (!text.trim()) {
      setIsSearchMode(false);
    }
  };

  const handleFilterApply = (newFilters: SearchFilters) => {
    setFilters(newFilters);
  };

  const handleLoadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadMore();
    }
  }, [loadingMore, hasMore, loadMore]);

  const handleSearchFocus = () => {
    // Search bar is already focused, user can type
  };

  const renderListing = ({ item }: { item: ListingWithImages }) => (
    <ListingCardVertical
      listing={item}
      onPress={() => onListingPress?.(item.id)}
      onChatPress={() => onChatPress?.(item.id)}
      onFavorite={() => onFavorite?.(item.id)}
    />
  );

  const renderFooter = () => {
    // Don't show loading indicator - seamless infinite scroll
    return null;
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="search-outline" size={64} color="#808080" />
        <Text style={styles.emptyText}>
          {isSearchMode ? 'No listings found' : 'No listings available'}
        </Text>
        <Text style={styles.emptySubtext}>
          {isSearchMode
            ? 'Try adjusting your search or filters'
            : 'Check back later for new listings'}
        </Text>
      </View>
    );
  };

  const activeFiltersCount = Object.keys(filters).filter((key) => filters[key as keyof SearchFilters]).length;

  return (
    <View style={styles.container}>
      {/* Search Bar and Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBarContainer}>
          <SearchBar
            placeholder="Search listings..."
            value={searchQuery}
            onChangeText={handleSearch}
            onFocus={handleSearchFocus}
            editable={true}
            noMargin={true}
          />
        </View>
        <TouchableOpacity
          style={[styles.filterButton, activeFiltersCount > 0 && styles.filterButtonActive]}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="options-outline" size={24} color={activeFiltersCount > 0 ? '#DC143C' : '#FFFFFF'} />
          {activeFiltersCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Listings */}
      {loading && listings.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC143C" />
        </View>
      ) : (
        <FlatList
          data={listings}
          renderItem={renderListing}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading && listings.length > 0}
              onRefresh={refresh}
              tintColor="#DC143C"
            />
          }
        />
      )}

      {/* Filter Modal */}
      <FilterModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={handleFilterApply}
        initialFilters={filters}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181920',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 12,
    alignItems: 'center',
  },
  searchBarContainer: {
    flex: 1,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1F222A',
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterButtonActive: {
    borderColor: '#DC143C',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#DC143C',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterBadgeText: {
    fontSize: 10,
    fontFamily: 'Rubik',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: 'Rubik',
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#808080',
    textAlign: 'center',
  },
});

