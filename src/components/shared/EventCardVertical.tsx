import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { EventWithCreator } from '../../types/event.types';
import { FALLBACK_CARD, pickImageSource } from '../../utils/imageFallbacks';
import { useFavorites } from '../../context/FavoritesContext';
import { RateLimiter } from '../../utils/throttle';

interface EventCardVerticalProps {
  event: EventWithCreator & { attendeeAvatars?: string[]; attendeeCount?: number };
  onPress?: () => void;
  onFavorite?: () => void;
  onDelete?: () => void;
  deleteLoading?: boolean;
  mode?: 'default' | 'owner';
}

export const EventCardVertical: React.FC<EventCardVerticalProps> = ({
  event,
  onPress,
  onFavorite,
  onDelete,
  deleteLoading = false,
  mode = 'default',
}) => {
  const { isEventFavorited, toggleEventFavorite } = useFavorites();
  const rateLimiter = useRef(new RateLimiter(5, 10000));
  const isOwner = mode === 'owner';
  const isFavorite = isOwner ? false : isEventFavorited(event.id);

  const handleFavoritePress = async () => {
    if (isOwner) return;
    if (!rateLimiter.current.canCall()) return;

    rateLimiter.current.recordCall();
    try {
      await toggleEventFavorite(event.id);
      onFavorite?.();
    } catch (error) {
      console.error('Error toggling event favorite:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const coverImage =
    event.event_images?.find((img) => img.is_primary)?.image_url ||
    event.event_images?.[0]?.image_url ||
    null;
  const coverSource = pickImageSource(coverImage, FALLBACK_CARD);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.imageWrapper}>
        <Image source={coverSource} style={styles.image} contentFit="cover" />

        {!isOwner ? (
          <TouchableOpacity style={styles.favoriteButton} onPress={handleFavoritePress} activeOpacity={0.85}>
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={20}
              color={isFavorite ? '#DC143C' : '#FFFFFF'}
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.favoriteButton, styles.deleteButton]}
            onPress={onDelete}
            activeOpacity={0.85}
            disabled={deleteLoading}
          >
            {deleteLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {event.title}
        </Text>

        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color="#FFFFFF" />
          <Text style={styles.infoText}>{formatDate(event.start_date)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color="#FFFFFF" />
          <Text style={styles.infoText} numberOfLines={1}>
            {event.location || 'Location TBA'}
          </Text>
        </View>

        {event.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {event.description}
          </Text>
        ) : null}
        <View style={styles.attendeesRow}>
          <View style={styles.avatarGroup}>
            {event.attendeeAvatars?.slice(0, 5).map((avatarUrl, index) => (
              <Image
                key={`${avatarUrl}-${index}`}
                source={{ uri: avatarUrl }}
                style={[styles.avatar, { marginLeft: index === 0 ? 0 : -10 }]}
                contentFit="cover"
              />
            ))}
          </View>
          {typeof event.attendeeCount === 'number' && (
            <Text style={styles.attendeesText}>{event.attendeeCount} going</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#1F222A',
    borderRadius: 20,
    overflow: 'hidden',
  },
  imageWrapper: {
    width: '100%',
    height: 220,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  favoriteButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    backgroundColor: 'rgba(220,20,60,0.8)',
  },
  content: {
    padding: 16,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    color: '#C7CAD7',
    fontSize: 14,
    flex: 1,
  },
  description: {
    color: '#9CA0B8',
    fontSize: 14,
  },
  attendeesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  avatarGroup: {
    flexDirection: 'row',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#1F222A',
    backgroundColor: '#2B2F3C',
  },
  attendeesText: {
    color: '#C7CAD7',
    fontSize: 14,
    fontWeight: '600',
  },
});
