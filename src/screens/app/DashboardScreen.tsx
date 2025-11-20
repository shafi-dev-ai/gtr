import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Alert, ActivityIndicator, Dimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { BottomNavigation, TabType } from '../../components/common/BottomNavigation';
import { DashboardHeader } from '../../components/common/DashboardHeader';
import { ListingsSection } from '../../components/home/ListingsSection';
import { EventsSection } from '../../components/home/EventsSection';
import { ForumSection } from '../../components/home/ForumSection';
import { MarketplaceScreen } from '../marketplace/MarketplaceScreen';
import { ProfileScreen } from '../profile/ProfileScreen';
import { ListingWithImages } from '../../types/listing.types';
import { openChatWithUser } from '../../utils/chatHelpers';
import { useDataFetch } from '../../hooks/useDataFetch';
import { RequestPriority } from '../../services/dataManager';
import { eventsService } from '../../services/events';
import { forumService } from '../../services/forum';
import { EventWithCreator } from '../../types/event.types';
import { ForumPostWithUser } from '../../types/forum.types';
import { EventCardVertical } from '../../components/shared/EventCardVertical';
import { ForumPostCardVertical } from '../../components/shared/ForumPostCardVertical';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface DashboardScreenProps {
  navigation?: any;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const { logout, user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [marketplaceSearchQuery, setMarketplaceSearchQuery] = useState<string>('');
  const [exploreTab, setExploreTab] = useState<'events' | 'forum'>('events');
  const [refreshing, setRefreshing] = useState(false);
  const refreshFunctionsRef = useRef<Array<() => Promise<void>>>([]);
  const explorePagerRef = useRef<ScrollView | null>(null);
  const exploreTabChangeSource = useRef<'manual' | 'scroll'>('manual');

  const updateExploreTab = useCallback(
    (tab: 'events' | 'forum', source: 'manual' | 'scroll' = 'manual') => {
      exploreTabChangeSource.current = source;
      setExploreTab((prev) => (prev === tab ? prev : tab));
    },
    []
  );

  useEffect(() => {
    if (activeTab !== 'explore' || !explorePagerRef.current) {
      return;
    }

    if (exploreTabChangeSource.current === 'scroll') {
      exploreTabChangeSource.current = 'manual';
      return;
    }

    const offset = exploreTab === 'events' ? 0 : SCREEN_WIDTH;
    explorePagerRef.current.scrollTo({ x: offset, animated: true });
  }, [activeTab, exploreTab]);

  const handleExploreMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      const nextTab = index === 0 ? 'events' : 'forum';
      if (nextTab !== exploreTab) {
        updateExploreTab(nextTab, 'scroll');
      }
    },
    [exploreTab, updateExploreTab]
  );

  const handleLogout = async () => {
    await logout();
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    // Clear search query when clicking marketplace icon (always clear when tab changes)
    setMarketplaceSearchQuery('');
    // TODO: Navigate to different screens based on tab
    console.log('Tab changed to:', tab);
  };

  const handleNotificationPress = () => {
    navigation?.navigate?.('Notification');
  };

  const handleMessagePress = () => {
    navigation?.navigate?.('Inbox');
  };

  const handleListingPress = (listing: ListingWithImages) => {
    if (!navigation) return;
    navigation.navigate('ListingDetail', {
      listingId: listing.id,
      initialListing: listing,
    });
  };

  const handleChatPress = async (listing: ListingWithImages) => {
    if (!navigation) return;
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in to chat with sellers.');
      return;
    }
    if (listing.user_id === user.id) {
      Alert.alert('Unavailable', 'You cannot chat with your own listing.');
      return;
    }
    await openChatWithUser({
      partnerId: listing.user_id,
      navigation,
      fallbackName: listing.model || listing.title,
      listing,
    });
  };

  const handleFavorite = (listingId: string) => {
    // TODO: Handle favorite action
    console.log('Favorite:', listingId);
  };

  const handleSearchPress = () => {
    // Switch to marketplace tab with search opened
    setActiveTab('marketplace');
    setMarketplaceSearchQuery('');
  };

  const handleSearchSubmit = (searchQuery: string) => {
    // Switch to marketplace tab with search query
    setActiveTab('marketplace');
    setMarketplaceSearchQuery(searchQuery);
  };

  const handleSeeMorePress = () => {
    // Switch to marketplace tab
    setActiveTab('marketplace');
    setMarketplaceSearchQuery('');
  };

  const handleEventPress = (eventId: string) => {
    // TODO: Navigate to event detail screen
    console.log('Event pressed:', eventId);
  };

  const handleEventFavorite = (eventId: string) => {
    // TODO: Handle event favorite action
    console.log('Event favorite:', eventId);
  };

  const handleEventsSeeMorePress = () => {
    setActiveTab('explore');
    updateExploreTab('events');
  };

  const handlePostPress = (postId: string) => {
    // TODO: Navigate to post detail screen
    console.log('Post pressed:', postId);
  };

  const handleForumSeeMorePress = () => {
    setActiveTab('explore');
    updateExploreTab('forum');
  };

  const handleCreateListingPress = () => {
    navigation?.navigate?.('CreateListing');
  };

  const handleCreateEventPress = () => {
    navigation?.navigate?.('CreateEvent');
  };

  const handleCreateForumPress = () => {
    navigation?.navigate?.('CreateForumPost');
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Refresh all sections
      await Promise.all(refreshFunctionsRef.current.map(fn => fn()));
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleListingsRefreshReady = useCallback((refreshFn: () => Promise<void>) => {
    refreshFunctionsRef.current[0] = refreshFn;
  }, []);

  const handleEventsRefreshReady = useCallback((refreshFn: () => Promise<void>) => {
    refreshFunctionsRef.current[1] = refreshFn;
  }, []);

  const handleForumRefreshReady = useCallback((refreshFn: () => Promise<void>) => {
    refreshFunctionsRef.current[2] = refreshFn;
  }, []);

  return (
    <View style={styles.container}>
      {/* Header - Hide on profile tab */}
      {activeTab !== 'profile' && (
        <DashboardHeader
          onNotificationPress={handleNotificationPress}
          onMessagePress={handleMessagePress}
        />
      )}

      {/* Show content based on active tab */}
      {activeTab === 'home' && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#DC143C"
            />
          }
        >
          <ListingsSection
            onListingPress={handleListingPress}
            onChatPress={handleChatPress}
            onFavorite={handleFavorite}
            onSearchPress={handleSearchPress}
            onSearchSubmit={handleSearchSubmit}
            onSeeMorePress={handleSeeMorePress}
            onRefreshReady={handleListingsRefreshReady}
          />
          <EventsSection
            onEventPress={handleEventPress}
            onFavorite={handleEventFavorite}
            onSeeMorePress={handleEventsSeeMorePress}
            onRefreshReady={handleEventsRefreshReady}
          />
          <ForumSection
            onPostPress={handlePostPress}
            onSeeMorePress={handleForumSeeMorePress}
            onRefreshReady={handleForumRefreshReady}
          />
          {/* More sections will be added here */}
        </ScrollView>
      )}

      {activeTab === 'marketplace' && (
        <MarketplaceScreen
          initialSearchQuery={marketplaceSearchQuery}
          onListingPress={handleListingPress}
          onChatPress={handleChatPress}
          onFavorite={handleFavorite}
        />
      )}

      {activeTab === 'create' && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.createScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.createCard}>
            <View style={styles.createCardRow}>
              <View style={styles.createIconContainer}>
                <Ionicons name="car-sport" size={26} color="#FFFFFF" />
              </View>
              <View style={styles.createCardBody}>
                <Text style={styles.createTitle}>List your GT-R</Text>
                <Text style={styles.createSubtitle}>
                  Photos, price, location, and specs in a few taps.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleCreateListingPress}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={18} color="#181920" />
              <Text style={styles.primaryButtonText}>Create listing</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.createCard}>
            <View style={styles.createCardRow}>
              <View style={[styles.createIconContainer, styles.createIconAccentCalendar]}>
                <Ionicons name="calendar-outline" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.createCardBody}>
                <Text style={styles.createTitle}>Host a GT-R event</Text>
                <Text style={styles.createSubtitle}>
                  Build track days, meetups, or rallies with RSVPs.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleCreateEventPress}
              activeOpacity={0.85}
            >
              <Ionicons name="flag-outline" size={18} color="#181920" />
              <Text style={styles.primaryButtonText}>Create event</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.createCard}>
            <View style={styles.createCardRow}>
              <View style={[styles.createIconContainer, styles.createIconAccentForum]}>
                <Ionicons name="chatbubbles-outline" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.createCardBody}>
                <Text style={styles.createTitle}>Start a forum thread</Text>
                <Text style={styles.createSubtitle}>
                  Share builds or questions with up to 12 gallery photos.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleCreateForumPress}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={18} color="#181920" />
              <Text style={styles.primaryButtonText}>Create post</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.createTipsCard}>
            <Text style={styles.createTipsTitle}>Tips</Text>
            <Text style={styles.createTip}>• Use bright, well-lit photos (max 12, under 10MB each).</Text>
            <Text style={styles.createTip}>• Include maintenance history and unique upgrades.</Text>
            <Text style={styles.createTip}>• Double-check location details for accurate search results.</Text>
          </View>
        </ScrollView>
      )}

      {activeTab === 'explore' && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#DC143C"
            />
          }
        >
          <View style={styles.exploreTabs}>
            <TouchableOpacity
              style={[
                styles.exploreTabButton,
                exploreTab === 'events' && styles.exploreTabButtonActive,
              ]}
              onPress={() => updateExploreTab('events')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.exploreTabLabel,
                  exploreTab === 'events' && styles.exploreTabLabelActive,
                ]}
              >
                Events
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.exploreTabButton,
                exploreTab === 'forum' && styles.exploreTabButtonActive,
              ]}
              onPress={() => updateExploreTab('forum')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.exploreTabLabel,
                  exploreTab === 'forum' && styles.exploreTabLabelActive,
                ]}
              >
                Forum
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={explorePagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.explorePager}
            onMomentumScrollEnd={handleExploreMomentumScrollEnd}
            scrollEventThrottle={16}
            bounces={false}
          >
            <View style={styles.explorePage}>
              <ExploreEventsList
                onEventPress={handleEventPress}
                onFavorite={handleEventFavorite}
                onRefreshReady={handleEventsRefreshReady}
              />
            </View>
            <View style={styles.explorePage}>
              <ExploreForumList
                onPostPress={handlePostPress}
                onRefreshReady={handleForumRefreshReady}
              />
            </View>
          </ScrollView>
        </ScrollView>
      )}

      {activeTab === 'profile' && (
        <ProfileScreen navigation={navigation} />
      )}

      {!['home', 'marketplace', 'profile', 'create', 'explore'].includes(activeTab) && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Text style={styles.contentText}>
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Screen
            </Text>
            <Text style={styles.placeholderText}>
              Content coming soon
            </Text>
          </View>
        </ScrollView>
      )}

      {/* Bottom Navigation */}
      <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />
    </View>
  );
};

interface ExploreEventsListProps {
  onEventPress?: (eventId: string) => void;
  onFavorite?: (eventId: string) => void;
  onRefreshReady?: (refreshFn: () => Promise<void>) => void;
}

const ExploreEventsList: React.FC<ExploreEventsListProps> = ({
  onEventPress,
  onFavorite,
  onRefreshReady,
}) => {
  const { user } = useAuth();
  const {
    data: events,
    loading,
    refresh,
  } = useDataFetch<EventWithCreator[]>({
    cacheKey: 'explore:events:20',
    fetchFn: () => eventsService.getUpcomingEvents(40),
    priority: RequestPriority.HIGH,
  });

  const eventIds = events?.map((event) => event.id) || [];
  const { data: rsvpsByEvent } = useDataFetch<Record<string, any[]>>({
    cacheKey: `explore:events:rsvps:${eventIds.join(',')}`,
    fetchFn: async () => {
      if (!events || events.length === 0) return {};
      const ids = events.map((event) => event.id);
      return eventsService.getBatchEventRSVPs(ids);
    },
    priority: RequestPriority.MEDIUM,
    enabled: !!events && events.length > 0,
  });

  useEffect(() => {
    onRefreshReady?.(refresh);
  }, [onRefreshReady, refresh]);

  if (loading && !events) {
    return (
      <View style={styles.exploreLoading}>
        <ActivityIndicator size="large" color="#DC143C" />
      </View>
    );
  }

  const visibleEvents =
    events?.filter((event) => (user?.id ? event.created_by !== user.id : true)) ?? [];

  if (visibleEvents.length === 0) {
    return (
      <View style={styles.exploreEmptyState}>
        <Ionicons name="calendar-outline" size={48} color="#808080" />
        <Text style={styles.exploreEmptyTitle}>No events yet</Text>
        <Text style={styles.exploreEmptySubtext}>
          Upcoming GT-R meetups and drives will show up here.
        </Text>
      </View>
    );
  }

  const eventsWithAttendees =
    visibleEvents.map((event) => {
      const rsvps = rsvpsByEvent?.[event.id] || [];
      const attendeeAvatars = rsvps
        .filter((rsvp: any) => rsvp.profiles?.avatar_url)
        .slice(0, 5)
        .map((rsvp: any) => rsvp.profiles!.avatar_url as string);
      return {
        ...event,
        attendeeAvatars,
        attendeeCount: rsvps.length,
      };
    }) ?? [];

  return (
    <View style={styles.exploreListContainer}>
      {eventsWithAttendees.map((event) => (
        <View style={styles.exploreCardWrapper} key={event.id}>
          <EventCardVertical
            event={event}
            onPress={() => onEventPress?.(event.id)}
            onFavorite={() => onFavorite?.(event.id)}
          />
        </View>
      ))}
    </View>
  );
};

interface ExploreForumListProps {
  onPostPress?: (postId: string) => void;
  onRefreshReady?: (refreshFn: () => Promise<void>) => void;
}

const ExploreForumList: React.FC<ExploreForumListProps> = ({
  onPostPress,
  onRefreshReady,
}) => {
  const { user } = useAuth();
  const {
    data: posts,
    loading,
    refresh,
  } = useDataFetch<ForumPostWithUser[]>({
    cacheKey: 'explore:forum:recent:20',
    fetchFn: () => forumService.getAllPosts(20),
    priority: RequestPriority.HIGH,
  });

  useEffect(() => {
    onRefreshReady?.(refresh);
  }, [onRefreshReady, refresh]);

  if (loading && !posts) {
    return (
      <View style={styles.exploreLoading}>
        <ActivityIndicator size="large" color="#DC143C" />
      </View>
    );
  }

  const visiblePosts =
    posts?.filter((post) => (user?.id ? post.user_id !== user.id : true)) ?? [];

  if (visiblePosts.length === 0) {
    return (
      <View style={styles.exploreEmptyState}>
        <Ionicons name="chatbubbles-outline" size={48} color="#808080" />
        <Text style={styles.exploreEmptyTitle}>No forum posts yet</Text>
        <Text style={styles.exploreEmptySubtext}>
          Builds, questions, and spotting threads will appear here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.exploreListContainer}>
      {visiblePosts.map((post) => (
        <View style={styles.exploreCardWrapper} key={post.id}>
          <ForumPostCardVertical post={post} onPress={() => onPostPress?.(post.id)} />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181920',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentText: {
    fontSize: 18,
    fontFamily: 'Rubik',
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#808080',
    textAlign: 'center',
  },
  createScrollContent: {
    flexGrow: 1,
    padding: 20,
    gap: 12,
  },
  createCard: {
    backgroundColor: '#1F222A',
    borderRadius: 20,
    padding: 16,
    marginBottom: 0,
  },
  createCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  createCardBody: {
    flex: 1,
  },
  createIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(220,20,60,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createIconAccentCalendar: {
    backgroundColor: 'rgba(0, 122, 255, 0.18)',
  },
  createIconAccentForum: {
    backgroundColor: 'rgba(155, 81, 224, 0.18)',
  },
  createTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  createSubtitle: {
    color: '#C7CAD7',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 0,
  },
  primaryButton: {
    marginTop: 4,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#181920',
  },
  createTipsCard: {
    backgroundColor: '#1A1D26',
    borderRadius: 20,
    padding: 16,
    marginTop: 8,
  },
  createTipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  createTip: {
    color: '#9CA0B8',
    fontSize: 14,
    marginBottom: 6,
  },
  exploreTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#232634',
  },
  exploreTabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  exploreTabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#FFFFFF',
  },
  exploreTabLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#72768A',
  },
  exploreTabLabelActive: {
    color: '#FFFFFF',
  },
  explorePager: {
    flexGrow: 0,
  },
  explorePage: {
    width: SCREEN_WIDTH,
  },
  exploreListContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 16,
  },
  exploreCardWrapper: {
    alignItems: 'center',
  },
  exploreCardFullWidth: {
    width: '100%',
    marginRight: 0,
  },
  exploreEmptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  exploreEmptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  exploreEmptySubtext: {
    color: '#9CA0B8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  exploreLoading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
});
