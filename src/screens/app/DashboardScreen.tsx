import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Alert } from 'react-native';
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

interface DashboardScreenProps {
  navigation?: any;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const { logout, user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [marketplaceSearchQuery, setMarketplaceSearchQuery] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const refreshFunctionsRef = useRef<Array<() => Promise<void>>>([]);

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
    if (navigation) {
      navigation.navigate('Notification' as never);
    } else {
      console.log('Notifications pressed - navigation not available');
    }
  };

  const handleMessagePress = () => {
    if (navigation) {
      navigation.navigate('Inbox' as never);
    } else {
      console.log('Messages pressed - navigation not available');
    }
  };

  const handleListingPress = (listingId: string) => {
    // TODO: Navigate to listing detail screen
    console.log('Listing pressed:', listingId);
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
    // Switch to events tab
    setActiveTab('events');
  };

  const handlePostPress = (postId: string) => {
    // TODO: Navigate to post detail screen
    console.log('Post pressed:', postId);
  };

  const handleForumSeeMorePress = () => {
    // Switch to community tab
    setActiveTab('community');
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

      {activeTab === 'profile' && (
        <ProfileScreen navigation={navigation} />
      )}

      {activeTab !== 'home' && activeTab !== 'marketplace' && activeTab !== 'profile' && (
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
});
