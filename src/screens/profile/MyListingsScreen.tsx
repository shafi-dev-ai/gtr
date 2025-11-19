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
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { listingsService } from '../../services/listings';
import { ListingWithImages } from '../../types/listing.types';
import { ListingCardVertical } from '../../components/shared/ListingCardVertical';
import { useDataFetch } from '../../hooks/useDataFetch';
import dataManager, { RequestPriority } from '../../services/dataManager';

export const MyListingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [deleteProcessingId, setDeleteProcessingId] = useState<string | null>(null);

  const { data: listings, loading, refresh } = useDataFetch<ListingWithImages[]>({
    cacheKey: `user:listings:${user?.id || ''}`,
    fetchFn: () => listingsService.getUserListings(user?.id || ''),
    priority: RequestPriority.HIGH,
    enabled: !!user,
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const invalidateListingCaches = useCallback(() => {
    dataManager.invalidateCache(new RegExp(`^user:listings:${user?.id || ''}`));
    dataManager.invalidateCache(/^home:listings/);
    dataManager.invalidateCache(/^marketplace:listings/);
  }, [user?.id]);

  const handleListingPress = (listing: ListingWithImages) => {
    navigation.navigate('ListingDetail', {
      listingId: listing.id,
      initialListing: listing,
    });
  };

  const handleToggleStatus = useCallback(
    async (listing: ListingWithImages) => {
      if (!listing.id) return;
      const nextStatus = listing.status === 'sold' ? 'active' : 'sold';
      setStatusUpdatingId(listing.id);
      try {
        await listingsService.updateListing(listing.id, { status: nextStatus });
        invalidateListingCaches();
        await refresh();
      } catch (error) {
        console.error('Error updating listing status:', error);
        Alert.alert('Update failed', 'Could not update the listing status. Please try again.');
      } finally {
        setStatusUpdatingId(null);
      }
    },
    [invalidateListingCaches, refresh]
  );

  const handleDeleteListing = useCallback(
    (listing: ListingWithImages) => {
      Alert.alert(
        'Delete listing',
        'Are you sure you want to delete this listing? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setDeleteProcessingId(listing.id);
              try {
                await listingsService.deleteListing(listing.id, false);
                invalidateListingCaches();
                await refresh();
              } catch (error) {
                console.error('Error deleting listing:', error);
                Alert.alert('Delete failed', 'Could not delete the listing. Please try again.');
              } finally {
                setDeleteProcessingId(null);
              }
            },
          },
        ]
      );
    },
    [invalidateListingCaches, refresh]
  );

  const handleEditListing = (listing: ListingWithImages) => {
    navigation.navigate('CreateListing', {
      listingToEdit: listing,
    });
  };

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
        <Text style={styles.headerTitle}>My Listings</Text>
        <View style={styles.placeholder} />
      </View>

      {loading && !listings ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC143C" />
          <Text style={styles.loadingText}>Loading listings...</Text>
        </View>
      ) : listings && listings.length > 0 ? (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ListingCardVertical
              listing={item}
              onPress={() => handleListingPress(item)}
              mode="owner"
              onToggleStatus={() => handleToggleStatus(item)}
              onEdit={() => handleEditListing(item)}
              onDelete={() => handleDeleteListing(item)}
              statusLoading={statusUpdatingId === item.id}
              deleteLoading={deleteProcessingId === item.id}
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
          <Ionicons name="car-outline" size={64} color="#808080" />
          <Text style={styles.emptyText}>No listings yet</Text>
          <Text style={styles.emptySubtext}>Start selling your GT-R by creating a listing</Text>
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
