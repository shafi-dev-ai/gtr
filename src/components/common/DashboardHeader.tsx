import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { profilesService } from '../../services/profiles';
import { Profile } from '../../types/profile.types';
import { useDataFetch } from '../../hooks/useDataFetch';
import { RequestPriority } from '../../services/dataManager';
import { notificationsService } from '../../services/notifications';
import { messagesService } from '../../services/messages';
import { realtimeService } from '../../services/realtime';

interface DashboardHeaderProps {
  onNotificationPress?: () => void;
  onMessagePress?: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  onNotificationPress,
  onMessagePress,
}) => {
  const { user } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);

  // Fetch unread notification count
  const { data: unreadCount, refresh: refreshNotificationCount } = useDataFetch<number>({
    cacheKey: 'notifications:unread_count',
    fetchFn: () => notificationsService.getUnreadCount(),
    priority: RequestPriority.MEDIUM,
    enabled: !!user,
    ttl: 60 * 1000, // refresh badge at least once per minute
  });

  const { data: unreadMessagesCount, refresh: refreshMessageCount } = useDataFetch<number>({
    cacheKey: 'messages:unread_count',
    fetchFn: () => messagesService.getUnreadCount(),
    priority: RequestPriority.MEDIUM,
    enabled: !!user,
    ttl: 60 * 1000,
  });

  useFocusEffect(
    useCallback(() => {
      if (user) {
        refreshNotificationCount();
        refreshMessageCount();
      }
    }, [user, refreshNotificationCount, refreshMessageCount])
  );

  // Subscribe to real-time notification updates
  useEffect(() => {
    if (!user) return;

    let unsubscribe: (() => void) | null = null;

    const setupSubscription = async () => {
      unsubscribe = await realtimeService.subscribeToNotifications(() => {
        refreshNotificationCount();
      });
    };

    setupSubscription();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, refreshNotificationCount]);

  useEffect(() => {
    if (!user) return;

    let unsubscribe: (() => void) | null = null;

    const setupSubscription = async () => {
      unsubscribe = await realtimeService.subscribeToConversations(() => {
        refreshMessageCount();
      });
    };

    setupSubscription();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, refreshMessageCount]);

  // Refresh badge when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && user) {
        refreshNotificationCount();
        refreshMessageCount();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user, refreshNotificationCount, refreshMessageCount]);

  // Update notification count when data changes
  useEffect(() => {
    if (typeof unreadCount === 'number') {
      setNotificationCount(unreadCount);
      // Update badge count on app icon (only if push notifications are available)
      const updateBadge = async () => {
        try {
          const { pushNotificationService } = await import('../../services/pushNotifications');
          if (pushNotificationService.isAvailable()) {
            await pushNotificationService.setBadgeCount(unreadCount);
          }
        } catch (error) {
          // Silently fail - push notifications may not be available in Expo Go
          console.warn('Badge count update skipped (push notifications not available)');
        }
      };
      updateBadge();
    }
  }, [unreadCount]);

  useEffect(() => {
    if (typeof unreadMessagesCount === 'number') {
      setMessageCount(unreadMessagesCount);
    }
  }, [unreadMessagesCount]);

  // Fetch profile using DataManager cache
  const { data: profile } = useDataFetch<Profile | null>({
    cacheKey: 'profile:current',
    fetchFn: () => profilesService.getCurrentUserProfile(),
    priority: RequestPriority.HIGH,
    enabled: !!user,
  });

  const displayName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || '';
  const avatarUrl = profile?.avatar_url || null;

  return (
    <View style={styles.container}>
      {/* Left Section - User Info */}
      <View style={styles.userSection}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={32} color="#808080" />
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{displayName}</Text>
        </View>
      </View>

      {/* Right Section - Icons */}
      <View style={styles.iconsSection}>
        {/* Notification Icon */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onNotificationPress}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
          {notificationCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {notificationCount > 9 ? '9+' : notificationCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Message Icon */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onMessagePress}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubble-outline" size={24} color="#FFFFFF" />
          {messageCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {messageCount > 9 ? '9+' : messageCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#181920',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 28,
    marginRight: 12,
    backgroundColor: '#1F222A',
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1F222A',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontFamily: 'Rubik',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  iconsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  iconButton: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#DC143C',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#181920',
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Rubik',
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
