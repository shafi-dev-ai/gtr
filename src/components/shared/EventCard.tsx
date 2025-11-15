import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { EventWithCreator } from '../../types/event.types';
import { useFavorites } from '../../context/FavoritesContext';
import { RateLimiter } from '../../utils/throttle';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48; // Screen width minus padding

interface EventCardProps {
  event: EventWithCreator & { attendeeAvatars?: string[] };
  onPress?: () => void;
  onFavorite?: () => void;
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  onPress,
  onFavorite,
}) => {
  const { isEventFavorited, toggleEventFavorite } = useFavorites();
  
  // Rate limiter: max 5 favorite actions per 10 seconds
  const favoriteRateLimiter = useRef(new RateLimiter(5, 10000));

  // Get favorite status from context
  const isFavorite = isEventFavorited(event.id);

  const handleFavoritePress = async () => {
    // Rate limiting check
    if (!favoriteRateLimiter.current.canCall()) {
      console.warn('Favorite action rate limited');
      return;
    }

    favoriteRateLimiter.current.recordCall();

    try {
      await toggleEventFavorite(event.id);
      // Context handles optimistic updates and real-time sync
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const dayName = days[date.getDay()];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    const minutesStr = minutes.toString().padStart(2, '0');
    
    return `${dayName}, ${month} ${day}, ${year} - ${hour12}:${minutesStr} ${ampm}`;
  };

  const parseLocation = (location: string) => {
    // Parse location string (format: "City, State" or just "City")
    const parts = location.split(',').map(s => s.trim());
    return parts.length > 1 ? `${parts[0]}, ${parts[1]}` : location;
  };

  const coverImage = event.cover_image_url || 'https://picsum.photos/800/600';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.95}
    >
      {/* Event Image */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: coverImage }}
          style={styles.eventImage}
          contentFit="cover"
        />
        {/* Favorite Button */}
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={handleFavoritePress}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={20}
            color={isFavorite ? '#DC143C' : '#181920'}
          />
        </TouchableOpacity>
      </View>

      {/* Event Info */}
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title} numberOfLines={1}>
          {event.title}
        </Text>

        {/* Location */}
        <View style={styles.infoItem}>
          <Ionicons name="location-outline" size={16} color="#FFFFFF" />
          <Text style={styles.infoText} numberOfLines={1}>
            {parseLocation(event.location)}
          </Text>
        </View>
        
        {/* Date and Time */}
        <View style={styles.infoItem}>
          <Ionicons name="calendar-outline" size={16} color="#FFFFFF" />
          <Text style={styles.infoText} numberOfLines={2}>
            {formatDate(event.start_date)}
          </Text>
        </View>

        {/* Description */}
        {event.description && (
          <Text style={styles.description} numberOfLines={2}>
            {event.description}
          </Text>
        )}

        {/* Attendees */}
        <View style={styles.attendeesRow}>
          <View style={styles.avatarContainer}>
            {event.attendeeAvatars && event.attendeeAvatars.length > 0 ? (
              event.attendeeAvatars.map((avatarUrl, index) => {
                const avatarStyle = [
                  styles.avatar,
                  index === 0 ? styles.avatar1 : index === 1 ? styles.avatar2 : styles.avatar3,
                ];
                return (
                  <Image
                    key={index}
                    source={{ uri: avatarUrl }}
                    style={avatarStyle}
                    contentFit="cover"
                  />
                );
              })
            ) : (
              // Placeholder avatars if no attendees
              <>
                <View style={[styles.avatar, styles.avatar1]} />
                <View style={[styles.avatar, styles.avatar2]} />
                <View style={[styles.avatar, styles.avatar3]} />
              </>
            )}
          </View>
          <Text style={styles.attendeesText}>
            {event.rsvp_count || 0}+ Going
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#1F222A',
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 16,
  },
  imageContainer: {
    width: '100%',
    height: 240,
    position: 'relative',
  },
  eventImage: {
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
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: 'Rubik',
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FFFFFF',
    flex: 1,
  },
  description: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FFFFFF',
    marginBottom: 12,
    lineHeight: 20,
  },
  attendeesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#808080',
    borderWidth: 2,
    borderColor: '#1F222A',
    marginLeft: -8,
  },
  avatar1: {
    marginLeft: 0,
    zIndex: 3,
  },
  avatar2: {
    zIndex: 2,
  },
  avatar3: {
    zIndex: 1,
  },
  attendeesText: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FFFFFF',
  },
});

