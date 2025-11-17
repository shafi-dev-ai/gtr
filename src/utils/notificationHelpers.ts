// ============================================================================
// Notification Helper Functions
// ============================================================================

import { Notification, NotificationGroup, NotificationType } from '../types/notification.types';
import { Ionicons } from '@expo/vector-icons';

/**
 * Get icon name for notification type
 */
export const getNotificationIcon = (type: NotificationType): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case 'listing_favorited':
      return 'heart';
    case 'event_rsvp':
      return 'people';
    case 'event_favorited':
      return 'calendar';
    case 'forum_comment':
      return 'chatbubble';
    case 'forum_reply':
      return 'arrow-undo';
    case 'forum_like':
      return 'thumbs-up';
    case 'saved_search_match':
      return 'search';
    case 'message':
      return 'mail';
    default:
      return 'notifications';
  }
};

/**
 * Group notifications by date
 */
export const groupNotificationsByDate = (notifications: Notification[]): NotificationGroup[] => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: NotificationGroup[] = [];
  const todayNotifications: Notification[] = [];
  const yesterdayNotifications: Notification[] = [];
  const olderNotifications: Map<string, Notification[]> = new Map();

  notifications.forEach((notification) => {
    const notificationDate = new Date(notification.created_at);
    const notificationDay = new Date(
      notificationDate.getFullYear(),
      notificationDate.getMonth(),
      notificationDate.getDate()
    );

    if (notificationDay.getTime() === today.getTime()) {
      todayNotifications.push(notification);
    } else if (notificationDay.getTime() === yesterday.getTime()) {
      yesterdayNotifications.push(notification);
    } else {
      const dateKey = formatDateKey(notificationDate);
      if (!olderNotifications.has(dateKey)) {
        olderNotifications.set(dateKey, []);
      }
      olderNotifications.get(dateKey)!.push(notification);
    }
  });

  // Add today
  if (todayNotifications.length > 0) {
    groups.push({ date: 'Today', notifications: todayNotifications });
  }

  // Add yesterday
  if (yesterdayNotifications.length > 0) {
    groups.push({ date: 'Yesterday', notifications: yesterdayNotifications });
  }

  // Add older notifications (sorted by date, newest first)
  const sortedOlderDates = Array.from(olderNotifications.keys()).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  sortedOlderDates.forEach((dateKey) => {
    const notifications = olderNotifications.get(dateKey)!;
    groups.push({ date: formatDateDisplay(dateKey), notifications });
  });

  return groups;
};

/**
 * Format date key for grouping (YYYY-MM-DD)
 */
const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Format date for display (e.g., "November 15, 2025")
 */
const formatDateDisplay = (dateKey: string): string => {
  const date = new Date(dateKey);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  
  return `${month} ${day}, ${year}`;
};

/**
 * Check if notification has action button
 */
export const hasActionButton = (type: NotificationType): boolean => {
  return [
    'listing_favorited',
    'event_rsvp',
    'event_favorited',
    'forum_comment',
    'forum_reply',
    'saved_search_match',
    'message',
  ].includes(type);
};

/**
 * Get action button label
 */
export const getActionLabel = (type: NotificationType): string => {
  switch (type) {
    case 'listing_favorited':
    case 'event_favorited':
      return 'View Details';
    case 'event_rsvp':
      return 'View Event';
    case 'forum_comment':
    case 'forum_reply':
      return 'View Post';
    case 'saved_search_match':
      return 'View Listing';
    case 'message':
      return 'Open Chat';
    default:
      return 'View';
  }
};

