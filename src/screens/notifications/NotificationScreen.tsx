import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Notification, NotificationGroup } from '../../types/notification.types';
import { notificationsService } from '../../services/notifications';
import { useDataFetch } from '../../hooks/useDataFetch';
import { RequestPriority } from '../../services/dataManager';
import { realtimeService } from '../../services/realtime';
import {
  getNotificationIcon,
  groupNotificationsByDate,
} from '../../utils/notificationHelpers';

export const NotificationScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [refreshing, setRefreshing] = useState(false);

  const { data: notifications, loading, refresh } = useDataFetch<Notification[]>({
    cacheKey: 'notifications:all',
    fetchFn: () => notificationsService.getNotifications(200),
    priority: RequestPriority.HIGH,
    ttl: 60 * 1000, // refresh list at least once per minute
  });

  // Keep notifications fresh whenever screen is focused
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Subscribe to real-time notification updates
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupSubscription = async () => {
      unsubscribe = await realtimeService.subscribeToNotifications(() => {
        refresh();
      });
    };

    setupSubscription();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [refresh]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationsService.markAsRead(notificationId);
      await refresh();
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [refresh]);

  const handleActionPress = useCallback((notification: Notification) => {
    // Mark as read when action is pressed
    if (!notification.is_read) {
      handleMarkAsRead(notification.id);
    }

    // Navigate based on notification type
    if (notification.data) {
      if (notification.type === 'listing_favorited' && notification.data.listing_id) {
        // TODO: Navigate to listing detail
        console.log('Navigate to listing:', notification.data.listing_id);
      } else if (
        (notification.type === 'event_rsvp' || notification.type === 'event_favorited') &&
        notification.data.event_id
      ) {
        // TODO: Navigate to event detail
        console.log('Navigate to event:', notification.data.event_id);
      } else if (
        (notification.type === 'forum_comment' || notification.type === 'forum_reply') &&
        notification.data.post_id
      ) {
        // TODO: Navigate to forum post
        console.log('Navigate to forum post:', notification.data.post_id);
      } else if (notification.type === 'message' && notification.data.conversation_id) {
        // TODO: Navigate to conversation
        console.log('Navigate to conversation:', notification.data.conversation_id);
      }
    }
  }, [handleMarkAsRead]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await notificationsService.markAllAsRead();
      await refresh();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [refresh]);

  const groupedNotifications = notifications
    ? groupNotificationsByDate(notifications)
    : [];

  if (loading && !notifications) {
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
          <Text style={styles.headerTitle}>Notification</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#DC143C" />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification</Text>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={handleMarkAllRead}
          activeOpacity={0.7}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      {groupedNotifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-outline" size={64} color="#808080" />
          <Text style={styles.emptyText}>No notifications yet</Text>
          <Text style={styles.emptySubtext}>
            You'll see notifications here when someone interacts with your content
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#DC143C"
            />
          }
        >
          {groupedNotifications.map((group, groupIndex) => (
            <View key={groupIndex} style={styles.groupContainer}>
              {/* Date Header */}
              <Text style={styles.dateHeader}>{group.date}</Text>

              {/* Notifications in this group */}
              {group.notifications.map((notification) => {
                const iconName = getNotificationIcon(notification.type);

                return (
                  <TouchableOpacity
                    key={notification.id}
                    style={[
                      styles.notificationCard,
                      !notification.is_read && styles.unreadCard,
                    ]}
                    onPress={() => handleActionPress(notification)}
                    activeOpacity={0.8}
                  >
                    {/* Icon */}
                    <View style={styles.iconContainer}>
                      <Ionicons name={iconName} size={20} color="#808080" />
                    </View>

                    {/* Content */}
                    <View style={styles.contentContainer}>
                      <Text style={styles.notificationTitle}>{notification.title}</Text>
                      <Text style={styles.notificationBody}>{notification.body}</Text>

                      {/* Action Button removed per requirements */}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#13141C',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2D3A',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    marginLeft: -20,
  },
  menuButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    width: 44,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#808080',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  groupContainer: {
    marginBottom: 32,
  },
  dateHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#808080',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#1F222A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  unreadCard: {
    borderLeftColor: '#DC143C',
    backgroundColor: '#252830',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2A2D3A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    fontFamily: 'Rubik',
  },
  notificationBody: {
    fontSize: 14,
    color: '#808080',
    marginBottom: 12,
    lineHeight: 20,
    fontFamily: 'Rubik',
  },
  actionButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#2A2D3A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Rubik',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
    fontFamily: 'Rubik',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#808080',
    textAlign: 'center',
    fontFamily: 'Rubik',
  },
});
