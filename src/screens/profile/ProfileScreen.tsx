import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/auth';
import { profilesService } from '../../services/profiles';
import { favoritesService } from '../../services/favorites';
import { eventFavoritesService } from '../../services/eventFavorites';
import { storageService } from '../../services/storage';
import { supabase } from '../../services/supabase';
import { Profile } from '../../types/profile.types';
import { Alert, ActionSheetIOS, Platform } from 'react-native';
import { useDataFetch } from '../../hooks/useDataFetch';
import { RequestPriority } from '../../services/dataManager';
import dataManager from '../../services/dataManager';

interface ProfileScreenProps {
  navigation?: any;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { user, setIsAuthenticated } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch profile using DataManager - always fetch on mount if no cache
  const { data: profile, loading: profileLoading, refresh: refreshProfile } = useDataFetch<Profile | null>({
    cacheKey: 'profile:current',
    fetchFn: () => profilesService.getCurrentUserProfile(),
    priority: RequestPriority.HIGH,
    ttl: 10 * 60 * 1000, // 10 minutes
    staleWhileRevalidate: true,
    skipCache: false, // Use cache if available, but fetch if not
  });


  // Fetch stats using DataManager - always fetch on mount if no cache
  const statsCacheKey = user ? `profile:stats:${user.id}` : 'profile:stats:disabled';
  const { data: stats, loading: statsLoading, refresh: refreshStats } = useDataFetch({
    cacheKey: statsCacheKey,
    fetchFn: async () => {
      if (!user) {
        throw new Error('User not available');
      }
      
      try {
        // Try to use optimized RPC function first
        const { data, error } = await supabase.rpc('get_user_stats', {
          p_user_id: user.id,
        });

        if (!error && data) {
          return {
            listings: data.listings_count || 0,
            events: data.events_count || 0,
            posts: data.posts_count || 0,
            garage: data.garage_count || 0,
            likedListings: data.liked_listings_count || 0,
            likedEvents: data.liked_events_count || 0,
          };
        }

        // Fallback: fetch counts directly
        const [
          listingsResult,
          eventsResult,
          postsResult,
          garageResult,
          likedListingsCount,
          likedEventsCount,
        ] = await Promise.all([
          supabase
            .from('listings')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('status', 'active'),
          supabase
            .from('events')
            .select('id', { count: 'exact', head: true })
            .eq('created_by', user.id),
          supabase
            .from('forum_posts')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id),
          supabase
            .from('user_garage')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id),
          favoritesService.getUserFavoriteCount(),
          eventFavoritesService.getUserFavoriteCount(),
        ]);

        return {
          listings: listingsResult.count || 0,
          events: eventsResult.count || 0,
          posts: postsResult.count || 0,
          garage: garageResult.count || 0,
          likedListings: likedListingsCount,
          likedEvents: likedEventsCount,
        };
      } catch (error) {
        console.error('Error loading user stats:', error);
        return {
          listings: 0,
          events: 0,
          posts: 0,
          garage: 0,
          likedListings: 0,
          likedEvents: 0,
        };
      }
    },
    priority: RequestPriority.HIGH,
    ttl: 5 * 60 * 1000, // 5 minutes
    staleWhileRevalidate: true,
    enabled: !!user,
  });

  const loading = profileLoading || statsLoading;
  const defaultStats = {
    listings: 0,
    events: 0,
    posts: 0,
    garage: 0,
    likedListings: 0,
    likedEvents: 0,
  };
  const displayStats = stats || defaultStats;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshProfile(), refreshStats()]);
    } catch (error) {
      console.error('Error refreshing profile:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshProfile, refreshStats]);

  const handleEditProfile = () => {
    // TODO: Navigate to edit profile screen
    console.log('Edit profile');
  };

  const handleAvatarPress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library', 'Remove Photo'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 3,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) {
            await handleUpdateAvatar('camera');
          } else if (buttonIndex === 2) {
            await handleUpdateAvatar('library');
          } else if (buttonIndex === 3) {
            await handleRemoveAvatar();
          }
        }
      );
    } else {
      Alert.alert(
        'Update Profile Picture',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: () => handleUpdateAvatar('camera') },
          { text: 'Choose from Library', onPress: () => handleUpdateAvatar('library') },
          { text: 'Remove Photo', style: 'destructive', onPress: handleRemoveAvatar },
        ]
      );
    }
  };

  const handleUpdateAvatar = async (source: 'camera' | 'library') => {
    try {
      let publicUrl: string | null = null;

      if (source === 'camera') {
        publicUrl = await storageService.uploadAvatarFromCamera();
      } else {
        publicUrl = await storageService.uploadAvatarFromLibrary();
      }

      if (!publicUrl) {
        // User cancelled
        return;
      }

      // Update profile with new avatar URL
      const updatedProfile = await profilesService.updateAvatar(publicUrl);
      
      // Update cache and refresh
      dataManager.setCache('profile:current', updatedProfile, 10 * 60 * 1000);
      await refreshProfile();

      // Show success message
      Alert.alert('Success', 'Profile picture updated successfully');
    } catch (error: any) {
      console.error('Error updating avatar:', error);
      Alert.alert(
        'Error',
        'Failed to update profile picture. Please try again.'
      );
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      Alert.alert(
        'Remove Profile Picture',
        'Are you sure you want to remove your profile picture?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                // Delete from storage
                await storageService.deleteAvatar();

                // Update profile to remove avatar URL
                const updatedProfile = await profilesService.updateAvatar('');
                
                // Update cache and refresh
                dataManager.setCache('profile:current', updatedProfile, 10 * 60 * 1000);
                await refreshProfile();

                Alert.alert('Success', 'Profile picture removed successfully');
              } catch (error: any) {
                console.error('Error removing avatar:', error);
                Alert.alert(
                  'Error',
                  'Failed to remove profile picture. Please try again.'
                );
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error in remove avatar handler:', error);
    }
  };

  const handleMyListings = () => {
    // TODO: Navigate to my listings screen
    console.log('My listings');
  };

  const handleMyEvents = () => {
    // TODO: Navigate to my events screen
    console.log('My events');
  };

  const handleMyPosts = () => {
    // TODO: Navigate to my posts screen
    console.log('My posts');
  };

  const handleMyGarage = () => {
    // TODO: Navigate to my garage screen
    console.log('My garage');
  };

  const handleLikedListings = () => {
    // TODO: Navigate to liked listings screen
    console.log('Liked listings');
  };

  const handleLikedEvents = () => {
    // TODO: Navigate to liked events screen
    console.log('Liked events');
  };

  const handleSavedSearches = () => {
    // TODO: Navigate to saved searches screen
    console.log('Saved searches');
  };

  const handleAccountSettings = () => {
    if (navigation) {
      navigation.navigate('AccountSettings');
    } else {
      console.log('Account settings - navigation not available');
    }
  };

  const handleNotificationSettings = () => {
    // TODO: Navigate to notification settings screen
    console.log('Notification settings');
  };

  const handlePrivacySettings = () => {
    // TODO: Navigate to privacy settings screen
    console.log('Privacy settings');
  };

  const handleHelpSupport = () => {
    // TODO: Navigate to help & support screen
    console.log('Help & support');
  };

  const handleLogout = async () => {
    try {
      const { error } = await authService.signOut();
      if (error) {
        console.error('Logout error:', error);
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Show profile header immediately (don't wait for loading)
  const avatarUrl = profile?.avatar_url || null;
  const displayName = profile?.full_name || profile?.username || 'User';
  const username = profile?.username ? `@${profile.username}` : '';
  const location = profile?.location || 'Location not set';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView 
        style={styles.container} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#DC143C"
          />
        }
      >
        {/* Profile Header */}
        <View style={styles.header}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={handleAvatarPress}
          activeOpacity={0.8}
        >
          {avatarUrl ? (
            <ExpoImage
              source={{ uri: avatarUrl }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={64} color="#808080" />
            </View>
          )}
          <View style={styles.editButton}>
            <Ionicons name="camera" size={16} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
        
        <Text style={styles.name}>{displayName}</Text>
        {username && <Text style={styles.username}>{username}</Text>}
        
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={16} color="#808080" />
          <Text style={styles.location}>{location}</Text>
        </View>

        {profile?.bio && (
          <Text style={styles.bio} numberOfLines={3}>
            {profile.bio}
          </Text>
        )}
      </View>

      {/* Stats Row */}
      <View style={styles.statsContainer}>
        <TouchableOpacity style={styles.statItem} onPress={handleMyListings}>
          {loading ? (
            <ActivityIndicator size="small" color="#808080" />
          ) : (
            <Text style={styles.statNumber}>{displayStats.listings}</Text>
          )}
          <Text style={styles.statLabel}>Listings</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity style={styles.statItem} onPress={handleMyEvents}>
          {loading ? (
            <ActivityIndicator size="small" color="#808080" />
          ) : (
            <Text style={styles.statNumber}>{displayStats.events}</Text>
          )}
          <Text style={styles.statLabel}>Events</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity style={styles.statItem} onPress={handleMyPosts}>
          {loading ? (
            <ActivityIndicator size="small" color="#808080" />
          ) : (
            <Text style={styles.statNumber}>{displayStats.posts}</Text>
          )}
          <Text style={styles.statLabel}>Posts</Text>
        </TouchableOpacity>
        <View style={styles.statDivider} />
        <TouchableOpacity style={styles.statItem} onPress={handleMyGarage}>
          {loading ? (
            <ActivityIndicator size="small" color="#808080" />
          ) : (
            <Text style={styles.statNumber}>{displayStats.garage}</Text>
          )}
          <Text style={styles.statLabel}>Garage</Text>
        </TouchableOpacity>
      </View>

      {/* My Content Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Content</Text>
        
        <MenuItem
          icon="car-outline"
          label="My Listings"
          onPress={handleMyListings}
        />
        <MenuItem
          icon="calendar-outline"
          label="My Events"
          onPress={handleMyEvents}
        />
        <MenuItem
          icon="chatbubbles-outline"
          label="My Forum Posts"
          onPress={handleMyPosts}
        />
        <MenuItem
          icon="garage-outline"
          label="My Garage"
          onPress={handleMyGarage}
        />
      </View>

      {/* Saved Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Saved</Text>
        
        <MenuItem
          icon="heart"
          label="Liked Listings"
          onPress={handleLikedListings}
        />
        <MenuItem
          icon="heart"
          label="Liked Events"
          onPress={handleLikedEvents}
        />
        <MenuItem
          icon="search-outline"
          label="Saved Searches"
          onPress={handleSavedSearches}
        />
      </View>

      {/* Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        
        <MenuItem
          icon="person-outline"
          label="Account Settings"
          onPress={handleAccountSettings}
        />
        <MenuItem
          icon="notifications-outline"
          label="Notification Preferences"
          onPress={handleNotificationSettings}
        />
        <MenuItem
          icon="lock-closed-outline"
          label="Privacy Settings"
          onPress={handlePrivacySettings}
        />
        <MenuItem
          icon="help-circle-outline"
          label="Help & Support"
          onPress={handleHelpSupport}
        />
        <MenuItem
          icon="log-out-outline"
          label="Logout"
          onPress={handleLogout}
          isDestructive
          showChevron={false}
        />
      </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

interface MenuItemProps {
  icon: string;
  label: string;
  onPress: () => void;
  badge?: number;
  isDestructive?: boolean;
  showChevron?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  label,
  onPress,
  badge,
  isDestructive = false,
  showChevron = true,
}) => {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.menuItemLeft}>
        <Ionicons
          name={icon as any}
          size={24}
          color={isDestructive ? '#DC143C' : '#FFFFFF'}
        />
        <Text style={[styles.menuItemLabel, isDestructive && styles.destructiveText]}>
          {label}
        </Text>
      </View>
      <View style={styles.menuItemRight}>
        {badge !== undefined && badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
        {showChevron && (
          <Ionicons
            name="chevron-forward"
            size={20}
            color="#808080"
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#13141C',
  },
  container: {
    flex: 1,
    backgroundColor: '#13141C',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#13141C',
  },
  header: {
    alignItems: 'center',
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#333333',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1F222A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  editButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DC143C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#13141C',
  },
  name: {
    fontSize: 24,
    fontFamily: 'Rubik',
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#808080',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  location: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#808080',
  },
  bio: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#1F222A',
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 16,
    paddingVertical: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontFamily: 'Rubik',
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#808080',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#2A2D35',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Rubik',
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#1F222A',
    marginBottom: 1,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  menuItemLabel: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FFFFFF',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badge: {
    backgroundColor: '#DC143C',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'Rubik',
    fontWeight: '600',
    color: '#FFFFFF',
  },
  destructiveText: {
    color: '#DC143C',
  },
  bottomSpacer: {
    height: 32,
  },
});

