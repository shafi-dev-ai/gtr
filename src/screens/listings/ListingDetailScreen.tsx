import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  FlatList,
  Alert,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ListingWithImages } from '../../types/listing.types';
import { useFavorites } from '../../context/FavoritesContext';
import { useAuth } from '../../context/AuthContext';
import { listingsService } from '../../services/listings';
import { useDataFetch } from '../../hooks/useDataFetch';
import dataManager, { RequestPriority } from '../../services/dataManager';
import { RateLimiter } from '../../utils/throttle';
import { openChatWithUser } from '../../utils/chatHelpers';

interface ListingDetailRouteParams {
  listingId: string;
  initialListing?: ListingWithImages;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_WIDTH * 0.7;
const FALLBACK_IMAGE = 'https://picsum.photos/1200/800';

export const ListingDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { listingId, initialListing } = (route.params as ListingDetailRouteParams) || {};
  const { user } = useAuth();
  const { isListingFavorited, toggleListingFavorite } = useFavorites();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const favoriteLimiter = useRef(new RateLimiter(5, 10000));
  const imageListRef = useRef<FlatList<string>>(null);

  const {
    data: fetchedListing,
    loading,
    error,
    refresh,
  } = useDataFetch<ListingWithImages | null>({
    cacheKey: listingId ? `listing:detail:${listingId}` : 'listing:detail:unknown',
    fetchFn: () => listingsService.getListingById(listingId!),
    priority: RequestPriority.HIGH,
    enabled: !!listingId,
  });

  const listing = fetchedListing || initialListing || null;
  const isOwner = listing && user?.id === listing.user_id;
  const isFavorite = listing?.id ? isListingFavorited(listing.id) : false;

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [listing?.id]);

  const heroImages = useMemo(() => {
    if (listing?.listing_images?.length) {
      const ordered = [...listing.listing_images].sort(
        (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
      );
      return ordered.map((img) => img.image_url || FALLBACK_IMAGE);
    }
    return [FALLBACK_IMAGE];
  }, [listing?.listing_images]);

  const displayTitle =
    listing?.title ||
    [listing?.year, listing?.model].filter(Boolean).join(' ') ||
    'Listing';

  const locationText =
    listing?.location ||
    [listing?.city, listing?.state].filter(Boolean).join(', ') ||
    null;

  const formattedPrice = listing?.price
    ? `${new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(listing.price)} $`
    : '—';

  const specCards = useMemo(
    () => [
      {
        label: 'Mileage',
        value: listing?.mileage ? `${listing.mileage.toLocaleString()} KM` : 'N/A',
        icon: 'speedometer-outline' as const,
      },
      {
        label: 'Transmission',
        value: listing?.transmission || 'N/A',
        icon: 'swap-horizontal-outline' as const,
      },
      {
        label: 'Condition',
        value: listing?.condition || 'N/A',
        icon: 'car-outline' as const,
      },
      {
        label: 'Model',
        value: listing?.model || 'N/A',
        icon: 'car-sport-outline' as const,
      },
      {
        label: 'Year',
        value: listing?.year ? String(listing.year) : 'N/A',
        icon: 'calendar-outline' as const,
      },
      {
        label: 'Color',
        value: listing?.color || 'N/A',
        icon: 'color-palette-outline' as const,
      },
    ],
    [listing?.mileage, listing?.transmission, listing?.condition, listing?.model, listing?.year, listing?.color]
  );

  const invalidateListingCaches = useCallback(() => {
    dataManager.invalidateCache(/^home:listings/);
    dataManager.invalidateCache(/^marketplace:listings/);
    dataManager.invalidateCache(/^user:listings/);
    dataManager.invalidateCache(/^user:favorites:listings/);
    if (listingId) {
      dataManager.invalidateCache(`listing:detail:${listingId}`);
    }
  }, [listingId]);

  const handleImageMomentum = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentImageIndex(index);
  };

  const scrollToImage = (index: number) => {
    if (index < 0 || index >= heroImages.length) return;
    setCurrentImageIndex(index);
    imageListRef.current?.scrollToIndex({ index, animated: true });
  };

  const handleNextImage = () => {
    const nextIndex = currentImageIndex + 1;
    if (nextIndex < heroImages.length) {
      scrollToImage(nextIndex);
    }
  };

  const handlePreviousImage = () => {
    const prevIndex = currentImageIndex - 1;
    if (prevIndex >= 0) {
      scrollToImage(prevIndex);
    }
  };

  const handleFavoritePress = async () => {
    if (!listing?.id || isOwner || favoriteLoading) return;
    if (!favoriteLimiter.current.canCall()) {
      console.warn('Favorite action rate limited');
      return;
    }
    favoriteLimiter.current.recordCall();
    setFavoriteLoading(true);
    try {
      await toggleListingFavorite(listing.id);
    } catch (err) {
      Alert.alert('Unable to favorite', 'Please try again in a moment.');
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleChatPress = async () => {
    if (!listing) return;
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in to contact the seller.');
      return;
    }
    if (isOwner) {
      Alert.alert('Unavailable', 'You cannot chat with your own listing.');
      return;
    }
    await openChatWithUser({
      partnerId: listing.user_id,
      navigation,
      fallbackName: displayTitle,
      listing,
    });
  };

  const handleToggleStatus = async () => {
    if (!listing?.id) return;
    const nextStatus = listing.status === 'sold' ? 'active' : 'sold';
    setStatusLoading(true);
    try {
      await listingsService.updateListing(listing.id, { status: nextStatus });
      invalidateListingCaches();
      await refresh();
    } catch (err) {
      console.error('Error updating listing status:', err);
      Alert.alert('Update failed', 'Could not update the listing status. Please try again.');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDeleteListing = () => {
    if (!listing?.id) return;
    Alert.alert(
      'Delete listing',
      'Are you sure you want to delete this listing? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleteLoading(true);
            try {
              await listingsService.deleteListing(listing.id, false);
              invalidateListingCaches();
              navigation.goBack();
            } catch (err) {
              console.error('Error deleting listing:', err);
              Alert.alert('Delete failed', 'Could not delete the listing. Please try again.');
            } finally {
              setDeleteLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleEditListing = () => {
    Alert.alert(
      'Edit listing',
      'Editing listings will be available soon. For now, please contact support to make changes.'
    );
  };

  const getItemLayout = (_: unknown, index: number) => ({
    length: SCREEN_WIDTH,
    offset: SCREEN_WIDTH * index,
    index,
  });

  const renderState = () => {
    if (loading && !listing) {
      return (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#DC143C" />
          <Text style={styles.stateText}>Loading listing...</Text>
        </View>
      );
    }

    if (!listing) {
      return (
        <View style={styles.stateContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#808080" />
          <Text style={styles.stateTitle}>
            {error ? 'Unable to load listing' : 'Listing not found'}
          </Text>
          {error && (
            <Text style={styles.stateText}>Please check your connection and try again.</Text>
          )}
          <TouchableOpacity style={styles.retryButton} onPress={refresh} activeOpacity={0.8}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
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
        <Text style={styles.headerTitle} numberOfLines={1}>
          {displayTitle}
        </Text>
        <TouchableOpacity
          style={styles.messageButton}
          onPress={handleChatPress}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {listing ? (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroContainer}>
            <FlatList
              data={heroImages}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleImageMomentum}
              renderItem={({ item }) => (
                <Image source={{ uri: item }} style={styles.heroImage} contentFit="cover" />
              )}
              keyExtractor={(item, index) => `${item}-${index}`}
              ref={imageListRef}
              getItemLayout={getItemLayout}
            />
            {heroImages.length > 1 && (
              <View style={styles.pagination}>
                {heroImages.map((_, index) => (
                  <View
                    key={`dot-${index}`}
                    style={[
                      styles.paginationDot,
                      index === currentImageIndex && styles.paginationDotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>

          <View style={styles.content}>
            <View style={styles.mediaControls}>
              {!isOwner && (
                <TouchableOpacity
                  style={[styles.circleButton, isFavorite && styles.circleButtonActive]}
                  onPress={handleFavoritePress}
                  activeOpacity={favoriteLoading ? 1 : 0.8}
                  disabled={favoriteLoading}
                >
                  <Ionicons
                    name={isFavorite ? 'heart' : 'heart-outline'}
                    size={22}
                    color={isFavorite ? '#DC143C' : '#FFFFFF'}
                  />
                </TouchableOpacity>
              )}

              {listing?.status && (
                <View
                  style={[
                    styles.statusChip,
                    listing.status === 'sold' ? styles.statusChipSold : styles.statusChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      listing.status === 'sold' ? styles.statusChipTextSold : styles.statusChipTextActive,
                    ]}
                  >
                    {listing.status === 'sold' ? 'Sold' : 'Active'}
                  </Text>
                </View>
              )}

              <View style={styles.carouselControls}>
                <TouchableOpacity
                  style={styles.circleButton}
                  onPress={handlePreviousImage}
                  disabled={heroImages.length <= 1 || currentImageIndex === 0}
                  activeOpacity={heroImages.length <= 1 ? 1 : 0.8}
                >
                  <Ionicons
                    name="arrow-back"
                    size={18}
                    color={heroImages.length <= 1 || currentImageIndex === 0 ? '#4B4F63' : '#FFFFFF'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.circleButton, styles.circleButtonPrimary]}
                  onPress={handleNextImage}
                  disabled={heroImages.length <= 1 || currentImageIndex === heroImages.length - 1}
                  activeOpacity={heroImages.length <= 1 ? 1 : 0.8}
                >
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color={
                      heroImages.length <= 1 || currentImageIndex === heroImages.length - 1
                        ? '#4B4F63'
                        : '#181920'
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.titleRow}>
              <Text style={styles.titleText}>
                {displayTitle}
              </Text>
            </View>

            <View style={styles.priceRow}>
              <View style={styles.priceLabelRow}>
                <Text style={styles.sectionLabel}>Price</Text>
                <Text style={styles.priceText}>{formattedPrice}</Text>
              </View>
              {listing?.profiles?.username && (
                <View style={styles.hostChip}>
                  <Ionicons name="person-circle-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.hostChipText} numberOfLines={1}>
                    {listing.profiles.username}
                  </Text>
                </View>
              )}
            </View>


            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Description</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={16} color="#FFFFFF" />
                <Text style={styles.locationText}>
                  {locationText || 'Location not specified'}
                </Text>
              </View>
              <Text style={styles.descriptionText}>
                {listing?.description ||
                  'This seller has not added a detailed description for the listing yet.'}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Specifications</Text>
              <View style={styles.specGrid}>
                {specCards.map((spec) => (
                  <View style={styles.specCard} key={spec.label}>
                    <Ionicons name={spec.icon} size={22} color="#FFFFFF" />
                    <Text style={styles.specLabel}>{spec.label}</Text>
                    <Text style={styles.specValue} numberOfLines={1}>
                      {spec.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {isOwner ? (
              <View style={styles.ownerActions}>
                <TouchableOpacity
                  style={[styles.ownerButton, styles.ownerPrimaryButton]}
                  onPress={handleToggleStatus}
                  activeOpacity={statusLoading ? 1 : 0.8}
                  disabled={statusLoading}
                >
                  {statusLoading ? (
                    <ActivityIndicator size="small" color="#181920" />
                  ) : (
                    <Text style={styles.ownerPrimaryButtonText}>
                      {listing.status === 'sold' ? 'Mark Active' : 'Mark Sold'}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.ownerButton, styles.ownerSecondaryButton]}
                  onPress={handleEditListing}
                  activeOpacity={0.8}
                >
                  <Text style={styles.ownerSecondaryButtonText}>Edit listing</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.ownerButton, styles.ownerDangerButton]}
                  onPress={handleDeleteListing}
                  activeOpacity={deleteLoading ? 1 : 0.8}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.ownerDangerButtonText}>Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.ctaContainer}>
                <TouchableOpacity
                  style={[styles.ctaButton, styles.chatButton]}
                  onPress={handleChatPress}
                  activeOpacity={0.85}
                >
                  <Ionicons name="chatbubble-ellipses" size={20} color="#181920" />
                  <Text style={styles.chatButtonText}>Chat with seller</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        renderState()
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1F2B',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 12,
  },
  messageButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
  },
  heroContainer: {
    width: '100%',
    height: HERO_HEIGHT,
    backgroundColor: '#0F1018',
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    backgroundColor: '#0F1018',
  },
  pagination: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleText: {
    fontSize: 26,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 8,
  },
  statusChipSold: {
    backgroundColor: 'rgba(220,20,60,0.15)',
  },
  statusChipActive: {
    backgroundColor: 'rgba(84,214,44,0.15)',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusChipTextActive: {
    color: '#54D62C',
  },
  statusChipTextSold: {
    color: '#DC143C',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  priceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  priceText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'right',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#B0B3C1',
    marginBottom: 6,
  },
  hostChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#1F2230',
  },
  hostChipText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
    maxWidth: 140,
  },
  mediaControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  circleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1F2230',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleButtonActive: {
    backgroundColor: 'rgba(220,20,60,0.15)',
  },
  circleButtonPrimary: {
    backgroundColor: '#FFFFFF',
  },
  carouselControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  section: {
    marginBottom: 24,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  locationText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  descriptionText: {
    color: '#C7CAD7',
    fontSize: 15,
    lineHeight: 22,
  },
  specGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
  },
  specCard: {
    width: (SCREEN_WIDTH - 24 * 2 - 16) / 2,
    backgroundColor: '#1B1D27',
    borderRadius: 16,
    padding: 16,
  },
  specLabel: {
    color: '#8A8FA6',
    fontSize: 12,
    marginTop: 12,
  },
  specValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  ownerActions: {
    gap: 12,
  },
  ownerButton: {
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerPrimaryButton: {
    backgroundColor: '#FFFFFF',
  },
  ownerPrimaryButtonText: {
    color: '#181920',
    fontSize: 16,
    fontWeight: '600',
  },
  ownerSecondaryButton: {
    backgroundColor: '#1F2230',
  },
  ownerSecondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  ownerDangerButton: {
    backgroundColor: '#32161A',
  },
  ownerDangerButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
  },
  ctaContainer: {
    gap: 12,
  },
  ctaButton: {
    height: 56,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  chatButton: {
    backgroundColor: '#FFFFFF',
  },
  chatButtonText: {
    color: '#181920',
    fontSize: 16,
    fontWeight: '600',
  },
  buyButton: {
    backgroundColor: '#0B84FF',
  },
  buyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  stateText: {
    color: '#8086A2',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  retryButtonText: {
    color: '#181920',
    fontWeight: '600',
  },
});
