import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ListingWithImages } from '../../types/listing.types';
import { useFavorites } from '../../context/FavoritesContext';
import { RateLimiter } from '../../utils/throttle';

interface ListingCardVerticalProps {
  listing: ListingWithImages;
  onPress?: () => void;
  onChatPress?: (listing: ListingWithImages) => void;
  onFavorite?: () => void;
  mode?: 'default' | 'owner';
  onToggleStatus?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  statusLoading?: boolean;
  deleteLoading?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ListingCardVertical: React.FC<ListingCardVerticalProps> = ({
  listing,
  onPress,
  onChatPress,
  onFavorite,
  mode = 'default',
  onToggleStatus,
  onEdit,
  onDelete,
  statusLoading = false,
  deleteLoading = false,
}) => {
  const { isListingFavorited, toggleListingFavorite } = useFavorites();
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const isOwnerMode = mode === 'owner';
  
  // Rate limiter: max 5 favorite actions per 10 seconds
  const favoriteRateLimiter = useRef(new RateLimiter(5, 10000));

  // Get favorite status from context
  const isFavorite = isOwnerMode ? false : isListingFavorited(listing.id);

  const primaryImage = listing.listing_images?.find(img => img.is_primary)?.image_url 
    || listing.listing_images?.[0]?.image_url 
    || 'https://picsum.photos/800/600';

  const location = listing.location || `${listing.city || ''}, ${listing.state || ''}`.trim() || 'Location not specified';

  const handleFavoritePress = async () => {
    if (favoriteLoading || isOwnerMode) return;

    // Rate limiting check
    if (!favoriteRateLimiter.current.canCall()) {
      console.warn('Favorite action rate limited');
      return;
    }

    favoriteRateLimiter.current.recordCall();
    setFavoriteLoading(true);

    try {
      await toggleListingFavorite(listing.id);
      // Context handles optimistic updates and real-time sync
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setFavoriteLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatMileage = (mileage: number | null) => {
    if (!mileage) return 'N/A';
    return `${mileage.toLocaleString()} KM`;
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.95}
    >
      {/* Image and Favorite */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: primaryImage }}
          style={styles.carImage}
          contentFit="cover"
        />
        {!isOwnerMode && (
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={handleFavoritePress}
            activeOpacity={favoriteLoading ? 1 : 0.8}
            disabled={favoriteLoading}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={20}
              color={isFavorite ? '#DC143C' : '#FFFFFF'}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Car Name and Price */}
        <View style={styles.headerRow}>
          <Text style={styles.carName} numberOfLines={1}>
            {listing.model} {listing.year}
          </Text>
          <View style={styles.headerRight}>
            {isOwnerMode && (
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
            <Text style={styles.price}>
              {formatPrice(listing.price)} $
            </Text>
          </View>
        </View>

        {/* Specifications - Individual White Cards */}
        <View style={styles.specsContainer}>
          <View style={styles.specCard}>
            <Ionicons name="speedometer-outline" size={24} color="#181920" />
            <Text style={styles.specText} numberOfLines={1}>
              {formatMileage(listing.mileage)}
            </Text>
          </View>
          <View style={styles.specCard}>
            <Ionicons name="calendar-outline" size={24} color="#181920" />
            <Text style={styles.specText} numberOfLines={1}>
              {listing.year}
            </Text>
          </View>
          <View style={styles.specCard}>
            <Ionicons name="settings-outline" size={24} color="#181920" />
            <Text style={styles.specText} numberOfLines={1}>
              {listing.transmission || 'N/A'}
            </Text>
          </View>
          <View style={styles.specCard}>
            <Ionicons name="checkmark-circle-outline" size={24} color="#181920" />
            <Text style={styles.specText} numberOfLines={1}>
              {listing.condition || 'N/A'}
            </Text>
          </View>
        </View>

        {/* Location */}
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color="#808080" />
          <Text style={styles.locationText}>{location}</Text>
        </View>

        {/* Description */}
        {listing.description && (
          <Text style={styles.description} numberOfLines={2}>
            {listing.description}
          </Text>
        )}

        {/* Actions */}
        {isOwnerMode ? (
          <View style={styles.ownerActions}>
            <TouchableOpacity
              style={[styles.ownerButton, styles.ownerPrimaryButton]}
              onPress={onToggleStatus}
              disabled={statusLoading}
            >
              {statusLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={[styles.ownerButtonText, styles.ownerPrimaryButtonText]}>
                  {listing.status === 'sold' ? 'Mark Active' : 'Mark Sold'}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ownerButton, styles.ownerSecondaryButton]}
              onPress={onEdit}
              activeOpacity={0.8}
            >
              <Text style={[styles.ownerButtonText, styles.ownerSecondaryButtonText]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ownerButton, styles.ownerDangerButton]}
              onPress={onDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={[styles.ownerButtonText, styles.ownerDangerButtonText]}>Delete</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.chatButton}
            onPress={() => onChatPress?.(listing)}
            activeOpacity={0.8}
          >
            <Ionicons name="chatbubble-outline" size={18} color="#181920" />
            <Text style={styles.chatButtonText}>Chat now</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1F222A',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
  },
  carImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333333',
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  carName: {
    fontSize: 20,
    fontFamily: 'Rubik',
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  price: {
    fontSize: 20,
    fontFamily: 'Rubik',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusChipActive: {
    backgroundColor: 'rgba(76, 217, 100, 0.15)',
    borderColor: '#4CD964',
  },
  statusChipSold: {
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    borderColor: '#808080',
  },
  statusChipText: {
    fontSize: 12,
    fontFamily: 'Rubik',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusChipTextActive: {
    color: '#4CD964',
  },
  statusChipTextSold: {
    color: '#CCCCCC',
  },
  specsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  specCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 70,
  },
  specText: {
    fontSize: 11,
    fontFamily: 'Rubik',
    fontWeight: '600',
    color: '#181920',
    marginTop: 6,
    textAlign: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  locationText: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#808080',
  },
  description: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#808080',
    marginBottom: 12,
    lineHeight: 20,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  chatButtonText: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '600',
    color: '#181920',
  },
  ownerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ownerButton: {
    flexGrow: 1,
    flexBasis: '30%',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerButtonText: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '600',
  },
  ownerPrimaryButton: {
    backgroundColor: '#DC143C',
  },
  ownerPrimaryButtonText: {
    color: '#FFFFFF',
  },
  ownerSecondaryButton: {
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  ownerSecondaryButtonText: {
    color: '#FFFFFF',
  },
  ownerDangerButton: {
    backgroundColor: '#2A2D3A',
    borderWidth: 1,
    borderColor: '#DC143C',
  },
  ownerDangerButtonText: {
    color: '#DC143C',
  },
});
