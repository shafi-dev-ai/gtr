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
    // Switch to events tab
    setActiveTab('events');
  };

  const handlePostPress = (postId: string) => {
    // TODO: Navigate to post detail screen
    console.log('Post pressed:', postId);
  };

  const handleForumSeeMorePress = () => {
    Alert.alert('Community coming soon', 'The community hub is on its way. Stay tuned!');
  };

  const handleCreateListingPress = () => {
    navigation?.navigate?.('CreateListing');
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
            <View style={styles.createIconContainer}>
              <Ionicons name="car-sport" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.createTitle}>List your GT-R</Text>
            <Text style={styles.createSubtitle}>
              Add photos, pricing, and location in a few steps. Buyers around the world are waiting.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleCreateListingPress}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={18} color="#181920" />
              <Text style={styles.primaryButtonText}>Create new listing</Text>
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

      {activeTab === 'profile' && (
        <ProfileScreen navigation={navigation} />
      )}

      {activeTab !== 'home' && activeTab !== 'marketplace' && activeTab !== 'profile' && activeTab !== 'create' && (
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
  createScrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  createCard: {
    backgroundColor: '#1F222A',
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
  },
  createIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(220,20,60,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  createTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  createSubtitle: {
    color: '#C7CAD7',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  primaryButton: {
    height: 52,
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
    padding: 20,
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
});
