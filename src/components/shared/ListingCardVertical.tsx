import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ListingWithImages } from '../../types/listing.types';
import { favoritesService } from '../../services/favorites';

interface ListingCardVerticalProps {
  listing: ListingWithImages;
  onPress?: () => void;
  onChatPress?: () => void;
  onFavorite?: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ListingCardVertical: React.FC<ListingCardVerticalProps> = ({
  listing,
  onPress,
  onChatPress,
  onFavorite,
}) => {
  const [isFavorite, setIsFavorite] = useState(false);

  // Check favorite status on mount
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      try {
        const favorited = await favoritesService.hasUserFavorited(listing.id);
        setIsFavorite(favorited);
      } catch (error) {
        console.error('Error checking favorite status:', error);
      }
    };

    checkFavoriteStatus();
  }, [listing.id]);

  const primaryImage = listing.listing_images?.find(img => img.is_primary)?.image_url 
    || listing.listing_images?.[0]?.image_url 
    || 'https://picsum.photos/800/600';

  const location = listing.location || `${listing.city || ''}, ${listing.state || ''}`.trim() || 'Location not specified';

  const handleFavoritePress = async () => {
    // Optimistic update - update UI immediately
    const previousFavoriteState = isFavorite;
    setIsFavorite(!previousFavoriteState);
    onFavorite?.();

    // Then sync with backend
    try {
      await favoritesService.toggleFavorite(listing.id);
    } catch (error) {
      console.error('Error toggling favorite:', error);
      // Revert on error
      setIsFavorite(previousFavoriteState);
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
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={handleFavoritePress}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={20}
            color={isFavorite ? '#DC143C' : '#FFFFFF'}
          />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Car Name and Price */}
        <View style={styles.headerRow}>
          <Text style={styles.carName} numberOfLines={1}>
            {listing.model} {listing.year}
          </Text>
          <Text style={styles.price}>
            {formatPrice(listing.price)} $
          </Text>
        </View>

        {/* Specifications */}
        <View style={styles.specsContainer}>
          <View style={styles.specButton}>
            <Ionicons name="speedometer-outline" size={16} color="#FFFFFF" />
            <Text style={styles.specText}>{formatMileage(listing.mileage)}</Text>
          </View>
          <View style={styles.specButton}>
            <Ionicons name="calendar-outline" size={16} color="#FFFFFF" />
            <Text style={styles.specText}>{listing.year}</Text>
          </View>
          <View style={styles.specButton}>
            <Ionicons name="settings-outline" size={16} color="#FFFFFF" />
            <Text style={styles.specText} numberOfLines={1}>
              {listing.transmission || 'N/A'}
            </Text>
          </View>
          <View style={styles.specButton}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
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

        {/* Chat Button */}
        <TouchableOpacity
          style={styles.chatButton}
          onPress={onChatPress}
          activeOpacity={0.8}
        >
          <Ionicons name="chatbubble-outline" size={18} color="#181920" />
          <Text style={styles.chatButtonText}>Chat now</Text>
        </TouchableOpacity>
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
    marginLeft: 12,
  },
  specsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  specButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#181920',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    gap: 4,
  },
  specText: {
    fontSize: 11,
    fontFamily: 'Rubik',
    fontWeight: '500',
    color: '#FFFFFF',
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
});

