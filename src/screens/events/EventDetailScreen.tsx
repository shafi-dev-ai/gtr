import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { EventRSVP, EventWithCreator, EventRSVPWithUser } from '../../types/event.types';
import { useAuth } from '../../context/AuthContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useDataFetch } from '../../hooks/useDataFetch';
import dataManager, { RequestPriority } from '../../services/dataManager';
import { eventsService } from '../../services/events';
import { realtimeService } from '../../services/realtime';
import { RateLimiter } from '../../utils/throttle';
import { profilesService } from '../../services/profiles';

interface EventDetailRouteParams {
  eventId: string;
  initialEvent?: EventWithCreator | null;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_WIDTH * 0.7;
const FALLBACK_IMAGE = 'https://picsum.photos/1200/800';

export const EventDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { eventId, initialEvent } = (route.params as EventDetailRouteParams) || {};
  const { user } = useAuth();
  const { isEventFavorited, toggleEventFavorite } = useFavorites();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [rsvpUpdating, setRsvpUpdating] = useState<null | 'going' | 'maybe' | 'not_going'>(null);
  const favoriteLimiter = useRef(new RateLimiter(5, 10000));
  const [localRsvp, setLocalRsvp] = useState<EventRSVP | null>(null);
  const imageListRef = useRef<FlatList<string>>(null);

  const {
    data: fetchedEvent,
    loading: eventLoading,
    error,
    refresh: refreshEvent,
  } = useDataFetch<EventWithCreator | null>({
    cacheKey: eventId ? `event:detail:${eventId}` : 'event:detail:unknown',
    fetchFn: () => eventsService.getEventById(eventId!),
    priority: RequestPriority.HIGH,
    enabled: !!eventId,
  });

  const {
    data: attendees,
    loading: attendeesLoading,
    refresh: refreshAttendees,
  } = useDataFetch<EventRSVPWithUser[]>({
    cacheKey: eventId ? `events:rsvps:${eventId}` : 'events:rsvps:unknown',
    fetchFn: () => eventsService.getEventRSVPs(eventId!, 60),
    priority: RequestPriority.MEDIUM,
    enabled: !!eventId,
  });

  const {
    data: userRsvp,
    loading: userRsvpLoading,
    refresh: refreshUserRsvp,
  } = useDataFetch<EventRSVP | null>({
    cacheKey: eventId ? `event:user:rsvp:${eventId}` : 'event:user:rsvp:unknown',
    fetchFn: () => eventsService.getUserRSVPStatus(eventId!),
    priority: RequestPriority.MEDIUM,
    enabled: !!eventId,
  });

  const { data: profile } = useDataFetch({
    cacheKey: 'profile:current',
    fetchFn: () => profilesService.getCurrentUserProfile(),
    priority: RequestPriority.MEDIUM,
    enabled: !!user,
  });

  useEffect(() => {
    setLocalRsvp(userRsvp || null);
  }, [userRsvp?.id, userRsvp?.status, userRsvp]);

  const event = fetchedEvent || initialEvent || null;
  const isOwner = event?.created_by && user?.id === event.created_by;
  const isFavorite = event?.id ? isEventFavorited(event.id) : false;
  const heroImages = useMemo(() => {
    if (event?.event_images?.length) {
      const ordered = [...event.event_images].sort(
        (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
      );
      return ordered.map((img) => img.image_url || FALLBACK_IMAGE);
    }
    return [FALLBACK_IMAGE];
  }, [event?.event_images]);

  const invalidateEventCaches = useCallback(() => {
    dataManager.invalidateCache(/^home:events/);
    dataManager.invalidateCache(/^explore:events/);
    dataManager.invalidateCache(/^user:events/);
    dataManager.invalidateCache(/^user:favorites:events/);
    if (eventId) {
      dataManager.invalidateCache(`event:detail:${eventId}`);
      dataManager.invalidateCache(new RegExp(`.*events:rsvps.*${eventId}.*`));
      dataManager.invalidateCache(`event:user:rsvp:${eventId}`);
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    const unsubscribe = realtimeService.subscribeToEventRSVPs(eventId, () => {
      refreshEvent();
      refreshAttendees();
      refreshUserRsvp();
    });
    return () => unsubscribe();
  }, [eventId, refreshEvent, refreshAttendees, refreshUserRsvp]);

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [event?.id]);

  const getItemLayout = (_: unknown, index: number) => ({
    length: SCREEN_WIDTH,
    offset: SCREEN_WIDTH * index,
    index,
  });

  const handleImageMomentum = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentImageIndex(index);
  };

  const scrollToImage = (index: number) => {
    if (index < 0 || index >= heroImages.length) return;
    setCurrentImageIndex(index);
    imageListRef.current?.scrollToIndex({ index, animated: true });
  };

  const handleFavoritePress = async () => {
    if (!event?.id || isOwner) return;
    if (!favoriteLimiter.current.canCall()) {
      return;
    }
    favoriteLimiter.current.recordCall();
    try {
      await toggleEventFavorite(event.id);
    } catch (err) {
      Alert.alert('Unable to favorite', 'Please try again in a moment.');
    }
  };

  const handleRsvpChange = async (status: 'going' | 'maybe') => {
    if (!eventId) return;
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in to RSVP.');
      return;
    }
    setRsvpUpdating(status);
    const previous = localRsvp;
    setLocalRsvp({
      ...(previous || {
        id: 'local',
        event_id: eventId,
        user_id: user.id,
        checked_in: false,
        checked_in_at: null,
        created_at: new Date().toISOString(),
      }),
      status,
    });
    try {
      await eventsService.rsvpToEvent(eventId, status);
      invalidateEventCaches();
      await Promise.all([refreshEvent(), refreshAttendees(), refreshUserRsvp()]);
    } catch (err) {
      console.error('Error updating RSVP:', err);
      setLocalRsvp(previous || null);
      Alert.alert('Unable to RSVP', 'Please try again.');
    } finally {
      setRsvpUpdating(null);
    }
  };

  const handleCancelRsvp = async () => {
    if (!eventId) return;
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in to RSVP.');
      return;
    }
    setRsvpUpdating('not_going');
    const previous = localRsvp;
    setLocalRsvp(null);
    try {
      await eventsService.cancelRSVP(eventId);
      invalidateEventCaches();
      await Promise.all([refreshEvent(), refreshAttendees(), refreshUserRsvp()]);
    } catch (err) {
      console.error('Error cancelling RSVP:', err);
      setLocalRsvp(previous || null);
      Alert.alert('Could not cancel', 'Please try again.');
    } finally {
      setRsvpUpdating(null);
    }
  };

  const attendeeAvatars = useMemo(() => {
    const list = attendees || [];
    const avatars = list
      .filter((rsvp) => rsvp.status === 'going' && rsvp.profiles?.avatar_url)
      .map((rsvp) => rsvp.profiles!.avatar_url as string);
    const userGoing = (localRsvp || userRsvp)?.status === 'going';
    const alreadyIncluded = list.some((rsvp) => rsvp.user_id === user?.id);
    if (userGoing && !alreadyIncluded && profile?.avatar_url) {
      avatars.unshift(profile.avatar_url);
    }
    return avatars.slice(0, 12);
  }, [attendees, localRsvp, userRsvp, user?.id, profile?.avatar_url]);

  const attendeeCount = useMemo(() => {
    if (event?.rsvp_count && event.rsvp_count > 0) {
      return event.rsvp_count;
    }
    const going = attendees?.filter((r) => r.status === 'going').length || 0;
    const isGoing = (localRsvp || userRsvp)?.status === 'going';
    const alreadyCounted = attendees?.some((r) => r.user_id === user?.id) || false;
    return isGoing && !alreadyCounted ? going + 1 : going;
  }, [attendees, event?.rsvp_count, localRsvp, userRsvp, user?.id]);

  const maxAttendees = event?.max_attendees ?? null;
  const spotsRemaining = maxAttendees !== null ? Math.max(maxAttendees - attendeeCount, 0) : null;
  const isEventFull = maxAttendees !== null && spotsRemaining === 0;

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Date TBA';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatRange = (start?: string, end?: string | null) => {
    if (!start) return 'Date TBA';
    const startText = formatDate(start);
    if (!end) return startText;
    const endText = formatDate(end);
    return `${startText} — ${endText}`;
  };

  const currentStatus = (localRsvp || userRsvp)?.status || null;

  const renderState = () => {
    if (eventLoading && !event) {
      return (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#DC143C" />
          <Text style={styles.stateText}>Loading event...</Text>
        </View>
      );
    }

    if (!event) {
      return (
        <View style={styles.stateContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#808080" />
          <Text style={styles.stateTitle}>
            {error ? 'Unable to load event' : 'Event not found'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={refreshEvent} activeOpacity={0.8}>
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
          {event?.title || 'Event'}
        </Text>
        <TouchableOpacity
          style={[styles.headerIcon, isFavorite && styles.headerIconActive]}
          onPress={handleFavoritePress}
          activeOpacity={isOwner ? 1 : 0.8}
          disabled={isOwner}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={20}
            color={isFavorite ? '#DC143C' : '#FFFFFF'}
          />
        </TouchableOpacity>
      </View>

      {event ? (
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
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroBadge}>
                <Ionicons name="flag-outline" size={16} color="#FFFFFF" />
                <Text style={styles.heroBadgeText}>{event.event_type || 'Event'}</Text>
              </View>
              <View style={styles.heroBadge}>
                <Ionicons name="people-outline" size={16} color="#FFFFFF" />
                <Text style={styles.heroBadgeText}>{attendeeCount} going</Text>
              </View>
            </View>
          </View>

          <View style={styles.content}>
            <View style={styles.titleRow}>
              <Text style={styles.titleText}>{event.title}</Text>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaChip}>
                <Ionicons name="calendar-outline" size={16} color="#FFFFFF" />
                <Text style={styles.metaText}>{formatRange(event.start_date, event.end_date)}</Text>
              </View>
              <View style={styles.metaChip}>
                <Ionicons name="location-outline" size={16} color="#FFFFFF" />
                <Text style={styles.metaText}>
                  {event.location || [event.city, event.state].filter(Boolean).join(', ') || 'Location TBA'}
                </Text>
              </View>
            </View>

            <View style={styles.organizerCard}>
              <View style={styles.organizerRow}>
                <View style={styles.organizerAvatar}>
                  {event.profiles?.avatar_url ? (
                    <Image source={{ uri: event.profiles.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name="person-circle-outline" size={36} color="#808080" />
                  )}
                </View>
                <View style={styles.organizerInfo}>
                  <Text style={styles.organizerLabel}>Organized by</Text>
                  <Text style={styles.organizerName}>{event.profiles?.username || 'GT-R host'}</Text>
                </View>
                <View style={styles.capacityPill}>
                  <Ionicons name="flash-outline" size={14} color="#181920" />
                  <Text style={styles.capacityText}>
                    {spotsRemaining !== null ? (spotsRemaining > 0 ? `${spotsRemaining} spots left` : 'Full') : 'Open RSVP'}
                  </Text>
                </View>
              </View>
              <View style={styles.statusRow}>
                <View style={styles.statusBadge}>
                  <Ionicons name="time-outline" size={14} color="#54D62C" />
                  <Text style={styles.statusBadgeText}>Starts {formatDate(event.start_date)}</Text>
                </View>
                <View style={styles.statusBadgeMuted}>
                  <Ionicons name="navigate-outline" size={14} color="#8A8FA6" />
                  <Text style={styles.statusBadgeMutedText}>
                    {event.city || event.state || 'TBA'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>About this event</Text>
              <Text style={styles.descriptionText}>
                {event.description || 'This host has not added a detailed description yet.'}
              </Text>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>Who's going</Text>
                <Text style={styles.sectionSub}>{attendeeCount} confirmed</Text>
              </View>
              <View style={styles.avatarGroup}>
                {attendeeAvatars.length === 0 ? (
                  <Text style={styles.placeholderText}>No RSVPs yet. Be the first.</Text>
                ) : (
                  attendeeAvatars.map((avatar, index) => (
                    <Image
                      key={`${avatar}-${index}`}
                      source={{ uri: avatar }}
                      style={[styles.attendeeAvatar, { marginLeft: index === 0 ? 0 : -14 }]}
                    />
                  ))
                )}
              </View>
              {attendeesLoading && (
                <ActivityIndicator size="small" color="#DC143C" style={styles.inlineLoader} />
              )}
            </View>

            <View style={styles.rsvpCard}>
              <View style={styles.rsvpHeader}>
                <Text style={styles.rsvpTitle}>Your RSVP</Text>
                <View
                  style={[
                    styles.rsvpStatusPill,
                    currentStatus === 'going' && styles.rsvpStatusGoing,
                    currentStatus === 'maybe' && styles.rsvpStatusMaybe,
                    !currentStatus && styles.rsvpStatusNone,
                  ]}
                >
                  <Text
                    style={[
                      styles.rsvpStatusText,
                      currentStatus === 'going' && styles.rsvpStatusTextDark,
                      currentStatus === 'maybe' && styles.rsvpStatusText,
                      !currentStatus && styles.rsvpStatusTextMuted,
                    ]}
                  >
                    {currentStatus ? currentStatus.replace('_', ' ') : 'Not set'}
                  </Text>
                </View>
              </View>
              <Text style={styles.rsvpHint}>
                Lock in your spot so the host can plan ahead. We'll keep you updated if details change.
              </Text>
              {isEventFull && !currentStatus ? (
                <Text style={styles.capacityNote}>Event is full. RSVP will open if a spot frees up.</Text>
              ) : (
                <View style={styles.rsvpButtons}>
                  <TouchableOpacity
                    style={[
                      styles.rsvpButton,
                      styles.rsvpPrimary,
                      currentStatus === 'going' && styles.rsvpPrimaryActive,
                    ]}
                    onPress={() => handleRsvpChange('going')}
                    activeOpacity={0.85}
                    disabled={rsvpUpdating !== null || isOwner || (isEventFull && currentStatus !== 'going')}
                  >
                    {rsvpUpdating === 'going' ? (
                      <ActivityIndicator size="small" color="#181920" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={18} color="#181920" />
                        <Text style={styles.rsvpPrimaryText}>
                          {currentStatus === 'going' ? 'Confirmed' : 'RSVP Going'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.rsvpButton,
                      styles.rsvpSecondary,
                      currentStatus === 'maybe' && styles.rsvpSecondaryActive,
                    ]}
                    onPress={() => handleRsvpChange('maybe')}
                    activeOpacity={0.85}
                    disabled={
                      rsvpUpdating !== null ||
                      isOwner ||
                      (isEventFull && currentStatus !== 'going' && currentStatus !== 'maybe')
                    }
                  >
                    {rsvpUpdating === 'maybe' ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="help-circle-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.rsvpSecondaryText}>
                          {currentStatus === 'maybe' ? 'Marked Maybe' : 'Maybe'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
              {currentStatus && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCancelRsvp}
                  activeOpacity={rsvpUpdating === 'not_going' ? 1 : 0.8}
                  disabled={rsvpUpdating === 'not_going' || isOwner}
                >
                  {rsvpUpdating === 'not_going' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.cancelButtonText}>Cancel RSVP</Text>
                  )}
                </TouchableOpacity>
              )}
              {isOwner && (
                <Text style={styles.ownerNote}>You are the host. Guests control their own RSVP.</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Details</Text>
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={16} color="#FFFFFF" />
                <Text style={styles.detailText}>{formatRange(event.start_date, event.end_date)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="pin-outline" size={16} color="#FFFFFF" />
                <Text style={styles.detailText}>
                  {event.location || [event.city, event.state, event.country].filter(Boolean).join(', ') || 'Location TBA'}
                </Text>
              </View>
            </View>
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
    backgroundColor: '#11121A',
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
  headerIcon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#1C1E29',
  },
  headerIconActive: {
    backgroundColor: 'rgba(220,20,60,0.15)',
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
  heroBadgeRow: {
    position: 'absolute',
    top: 18,
    left: 18,
    flexDirection: 'row',
    gap: 10,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 18,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  metaRow: {
    gap: 12,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#1B1D27',
  },
  metaText: {
    color: '#C7CAD7',
    fontSize: 14,
    flex: 1,
  },
  organizerCard: {
    backgroundColor: '#151724',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1F2130',
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  organizerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#1F2230',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  organizerInfo: {
    flex: 1,
    gap: 2,
  },
  organizerLabel: {
    color: '#8A8FA6',
    fontSize: 12,
  },
  organizerName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  capacityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  capacityText: {
    fontWeight: '700',
    color: '#181920',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(84,214,44,0.12)',
  },
  statusBadgeText: {
    color: '#54D62C',
    fontWeight: '700',
  },
  statusBadgeMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#1B1D27',
    flexShrink: 1,
    maxWidth: '100%',
  },
  statusBadgeMutedText: {
    color: '#8A8FA6',
    fontWeight: '600',
    flexShrink: 1,
  },
  section: {
    gap: 10,
    paddingVertical: 6,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionSub: {
    color: '#8A8FA6',
    fontSize: 13,
  },
  descriptionText: {
    color: '#C7CAD7',
    fontSize: 15,
    lineHeight: 22,
  },
  avatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  attendeeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#11121A',
    backgroundColor: '#2B2F3C',
  },
  placeholderText: {
    color: '#8A8FA6',
    fontSize: 14,
  },
  inlineLoader: {
    marginTop: 8,
  },
  rsvpCard: {
    backgroundColor: '#181A28',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#222436',
  },
  rsvpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rsvpTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  rsvpStatusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  rsvpStatusGoing: {
    backgroundColor: '#FFFFFF',
  },
  rsvpStatusMaybe: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  rsvpStatusNone: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  rsvpStatusText: {
    color: '#FFFFFF',
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  rsvpStatusTextDark: {
    color: '#181920',
  },
  rsvpStatusTextMuted: {
    color: '#8A8FA6',
  },
  rsvpHint: {
    color: '#9CA0B8',
    fontSize: 14,
    lineHeight: 20,
  },
  rsvpButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rsvpButton: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  rsvpPrimary: {
    backgroundColor: '#FFFFFF',
  },
  rsvpPrimaryActive: {
    backgroundColor: '#C5F36B',
  },
  rsvpPrimaryText: {
    color: '#181920',
    fontWeight: '700',
    fontSize: 15,
  },
  rsvpSecondary: {
    backgroundColor: '#222436',
  },
  rsvpSecondaryActive: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  rsvpSecondaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  cancelButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2F3141',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#C7CAD7',
    fontWeight: '600',
  },
  capacityNote: {
    color: '#DC143C',
    fontSize: 13,
    lineHeight: 18,
  },
  ownerNote: {
    color: '#8A8FA6',
    fontSize: 12,
    marginTop: -4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailText: {
    color: '#C7CAD7',
    fontSize: 14,
    flex: 1,
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
