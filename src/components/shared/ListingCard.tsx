import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ListingWithImages } from '../../types/listing.types';
import { FALLBACK_CARD, pickImageSource } from '../../utils/imageFallbacks';
import { useFavorites } from '../../context/FavoritesContext';
import { RateLimiter } from '../../utils/throttle';

interface ListingCardProps {
  listing: ListingWithImages;
  onPress?: () => void;
  onChatPress?: (listing: ListingWithImages) => void;
  onFavorite?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48; // Screen width minus padding

export const ListingCard: React.FC<ListingCardProps> = ({
  listing,
  onPress,
  onChatPress,
  onFavorite,
}) => {
  const { isListingFavorited, toggleListingFavorite } = useFavorites();
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Rate limiter: max 5 favorite actions per 10 seconds
  const favoriteRateLimiter = useRef(new RateLimiter(5, 10000));

  // Get favorite status from context
  const isFavorite = isListingFavorited(listing.id);

  const primaryImage = listing.listing_images?.find(img => img.is_primary)?.image_url 
    || listing.listing_images?.[0]?.image_url 
    || null;
  const primarySource = pickImageSource(primaryImage, FALLBACK_CARD);

  const images = listing.listing_images?.map(img => img.image_url) || (primaryImage ? [primaryImage] : []);
  const location = listing.location || `${listing.city || ''}, ${listing.state || ''}`.trim() || 'Location not specified';

  const handleFavoritePress = async () => {
    if (favoriteLoading) return;

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
      {/* Car Image */}
      <View style={styles.imageContainer}>
        <Image
          source={primarySource}
          style={styles.carImage}
          contentFit="cover"
        />
        {/* Pagination Dots */}
        {images.length > 1 && (
          <View style={styles.paginationDots}>
            {images.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentImageIndex && styles.dotActive,
                ]}
              />
            ))}
          </View>
        )}
      </View>

      {/* Car Name and Price */}
      <View style={styles.headerRow}>
        <Text style={styles.carName} numberOfLines={1}>
          {listing.model} {listing.year}
        </Text>
        <Text style={styles.price}>
          {formatPrice(listing.price)} $
        </Text>
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
        <Ionicons name="location-outline" size={16} color="#808080" />
        <Text style={styles.locationText}>{location}</Text>
      </View>

      {/* Description */}
      {listing.description && (
        <Text style={styles.description} numberOfLines={2}>
          {listing.description}
        </Text>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => onChatPress?.(listing)}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#181920" />
          <Text style={styles.chatButtonText}>Chat now</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive]}
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
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#1F222A',
    borderRadius: 16,
    marginRight: 16,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    height: 240,
    position: 'relative',
  },
  carImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333333',
  },
  paginationDots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  carName: {
    fontSize: 22,
    fontFamily: 'Rubik',
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  price: {
    fontSize: 22,
    fontFamily: 'Rubik',
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  specsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
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
    paddingHorizontal: 16,
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
    paddingHorizontal: 16,
    marginBottom: 16,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  chatButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  chatButtonText: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '600',
    color: '#181920',
  },
  favoriteButton: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButtonActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
});
