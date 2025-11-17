import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Dimensions } from 'react-native';
import { EventCard } from '../shared/EventCard';
import { eventsService } from '../../services/events';
import { profilesService } from '../../services/profiles';
import { EventWithCreator } from '../../types/event.types';
import { useDataFetch } from '../../hooks/useDataFetch';
import { RequestPriority } from '../../services/dataManager';
import { useAuth } from '../../context/AuthContext';
import { realtimeService } from '../../services/realtime';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48; // Screen width minus padding

interface EventWithAttendees extends EventWithCreator {
  attendeeAvatars?: string[];
}

interface EventsSectionProps {
  onEventPress?: (eventId: string) => void;
  onFavorite?: (eventId: string) => void;
  onSeeMorePress?: () => void;
  onRefreshReady?: (refreshFn: () => Promise<void>) => void;
}

export const EventsSection: React.FC<EventsSectionProps> = ({
  onEventPress,
  onFavorite,
  onSeeMorePress,
  onRefreshReady,
}) => {
  const { user } = useAuth();

  // Fetch events using DataManager
  const { data: allEvents, loading, refresh } = useDataFetch<EventWithCreator[]>({
    cacheKey: 'home:events:upcoming:5',
    fetchFn: async () => {
      const events = await eventsService.getUpcomingEvents(20);
      return events;
    },
    priority: RequestPriority.HIGH,
  });

  // Fetch user profile for location filtering
  const { data: profile } = useDataFetch({
    cacheKey: 'profile:current',
    fetchFn: () => profilesService.getCurrentUserProfile(),
    priority: RequestPriority.HIGH,
  });

  const visibleEvents = useMemo(() => {
    if (!allEvents) return [];
    if (!user?.id) return allEvents;
    return allEvents.filter((event) => event.created_by !== user.id);
  }, [allEvents, user?.id]);

  // Fetch RSVPs for events
  const { data: rsvpsByEvent } = useDataFetch<Record<string, any[]>>({
    cacheKey: `home:events:rsvps:${visibleEvents?.map(e => e.id).join(',') || ''}`,
    fetchFn: async () => {
      if (!visibleEvents || visibleEvents.length === 0) return {};
      const eventIds = visibleEvents.slice(0, 5).map(e => e.id);
      return await eventsService.getBatchEventRSVPs(eventIds);
    },
    priority: RequestPriority.MEDIUM,
    enabled: !!visibleEvents && visibleEvents.length > 0,
  });

  // Sort and filter events based on location
  const sortedEvents = useMemo(() => {
    if (!visibleEvents) return [];
    
    let sorted = visibleEvents;
    if (profile?.location) {
      const locationParts = profile.location.split(',').map(s => s.trim());
      const userCity = locationParts[0]?.toLowerCase();
      const userState = locationParts[1]?.toLowerCase();
      
      if (userCity || userState) {
        const locationEvents: EventWithCreator[] = [];
        const otherEvents: EventWithCreator[] = [];

        visibleEvents.forEach((event) => {
          const eventLocation = event.location?.toLowerCase() || '';
          const matchesLocation =
            (userCity && eventLocation.includes(userCity)) ||
            (userState && eventLocation.includes(userState));

          if (matchesLocation) {
            locationEvents.push(event);
          } else {
            otherEvents.push(event);
          }
        });

        sorted = [...locationEvents, ...otherEvents];
      }
    }

    return sorted.slice(0, 5);
  }, [visibleEvents, profile]);

  // Map events with avatars (max 5 avatars)
  const eventsWithAvatars = useMemo<EventWithAttendees[]>(() => {
    return sortedEvents.map(event => {
      const rsvps = rsvpsByEvent?.[event.id] || [];
      const attendeeAvatars = rsvps
        .filter((rsvp: any) => rsvp.profiles?.avatar_url)
        .slice(0, 5) // Maximum 5 avatars
        .map((rsvp: any) => rsvp.profiles!.avatar_url!);
      
      return {
        ...event,
        attendeeAvatars,
      };
    });
  }, [sortedEvents, rsvpsByEvent]);

  // Subscribe to new events in real-time
  useEffect(() => {
    const unsubscribe = realtimeService.subscribeToNewEvents(() => {
      // Refresh events when new ones are added
      refresh();
    });

    return () => {
      unsubscribe();
    };
  }, [refresh]);

  // Subscribe to RSVP changes for visible events in real-time
  useEffect(() => {
    if (!sortedEvents || sortedEvents.length === 0) return;

    const eventIds = sortedEvents.slice(0, 5).map(e => e.id);
    const unsubscribes: (() => void)[] = [];

    // Subscribe to RSVP changes for each event
    eventIds.forEach(eventId => {
      const unsubscribe = realtimeService.subscribeToEventRSVPs(eventId, () => {
        // Refresh RSVPs when someone RSVPs/cancels
        refresh();
      });
      unsubscribes.push(unsubscribe);
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [sortedEvents, refresh]);

  // Expose refresh function to parent
  useEffect(() => {
    if (onRefreshReady) {
      onRefreshReady(refresh);
    }
  }, [onRefreshReady, refresh]);

  if (loading && !eventsWithAvatars.length) {
    return (
      <View style={styles.container}>
        <View style={styles.titleContainer}>
          <Text style={styles.sectionTitle}>Upcoming Events</Text>
          <TouchableOpacity onPress={onSeeMorePress} activeOpacity={0.7}>
            <Text style={styles.seeMoreText}>See more...</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading events...</Text>
        </View>
      </View>
    );
  }

  if (eventsWithAvatars.length === 0 && !loading) {
    return (
      <View style={styles.container}>
        <View style={styles.titleContainer}>
          <Text style={styles.sectionTitle}>Upcoming Events</Text>
          <TouchableOpacity onPress={onSeeMorePress} activeOpacity={0.7}>
            <Text style={styles.seeMoreText}>See more...</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No upcoming events</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.sectionTitle}>Upcoming Events</Text>
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
        {eventsWithAvatars.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onPress={() => onEventPress?.(event.id)}
            onFavorite={() => onFavorite?.(event.id)}
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
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Rubik',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  seeMoreText: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
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

