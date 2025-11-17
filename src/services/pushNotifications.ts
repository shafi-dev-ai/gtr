import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Safely import expo-notifications (may fail in Expo Go)
let Notifications: any = null;
let isNotificationsAvailable = false;
const isExpoGo = Constants.executionEnvironment === 'storeClient';

try {
  // Dynamic import to avoid crash if module not available
  Notifications = require('expo-notifications');
  
  if (!isExpoGo && Notifications) {
    // Configure notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    isNotificationsAvailable = true;
  }
} catch (error) {
  console.warn('Push notifications not available (likely running in Expo Go):', error);
  isNotificationsAvailable = false;
  Notifications = null;
}

export const pushNotificationService = {
  /**
   * Check if push notifications are available
   */
  isAvailable(): boolean {
    return isNotificationsAvailable && !isExpoGo;
  },

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    if (!this.isAvailable()) {
      console.warn('Push notifications not available (Expo Go or native module not loaded)');
      return false;
    }

    try {
      if (!Notifications) return false;
      
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Failed to get push notification permissions!');
        return false;
      }

      return true;
    } catch (error) {
      console.warn('Error requesting notification permissions:', error);
      return false;
    }
  },

  /**
   * Get device push token
   */
  async getDeviceToken(): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      if (!Notifications) return null;
      
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return null;

      let token: string | null = null;

      if (Platform.OS === 'android') {
        // Android: Get FCM token via Expo
        const tokenData = await Notifications.getDevicePushTokenAsync();
        token = tokenData.data as string;
      } else if (Platform.OS === 'ios') {
        // iOS: Get APNs token
        const tokenData = await Notifications.getDevicePushTokenAsync();
        token = tokenData.data as string;
      }

      return token;
    } catch (error) {
      console.warn('Error getting device token (push notifications may not be available):', error);
      return null;
    }
  },

  /**
   * Register device token with Supabase
   */
  async registerDeviceToken(): Promise<void> {
    if (!this.isAvailable()) {
      console.log('Skipping device token registration (push notifications not available)');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const token = await this.getDeviceToken();
      if (!token) {
        console.warn('No device token available');
        return;
      }

      // Store device token in database
      const { error } = await supabase
        .from('user_device_tokens')
        .upsert(
          {
            user_id: user.id,
            device_token: token,
            platform: Platform.OS,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id,device_token',
          }
        );

      if (error) {
        console.error('Error registering device token:', error);
        throw error;
      }
    } catch (error) {
      console.warn('Error registering device token (push notifications may not be available):', error);
      // Don't throw - allow app to continue without push notifications
    }
  },

  /**
   * Unregister device token (on logout)
   */
  async unregisterDeviceToken(): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const token = await this.getDeviceToken();
      if (!token) return;

      const { error } = await supabase
        .from('user_device_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('device_token', token);

      if (error) {
        console.error('Error unregistering device token:', error);
      }
    } catch (error) {
      console.warn('Error unregistering device token:', error);
      // Don't throw - allow logout to continue
    }
  },

  /**
   * Set up notification listeners
   */
  setupNotificationListeners(
    onNotificationReceived: (notification: any) => void,
    onNotificationTapped: (response: any) => void
  ): () => void {
    if (!this.isAvailable()) {
      // Return no-op cleanup function
      return () => {};
    }

    try {
      if (!Notifications) return () => {};
      
      // Listener for notifications received while app is foregrounded
      const receivedListener = Notifications.addNotificationReceivedListener(
        onNotificationReceived
      );

      // Listener for when user taps on notification
      const responseListener = Notifications.addNotificationResponseReceivedListener(
        onNotificationTapped
      );

      // Return cleanup function
      return () => {
        try {
          if (Notifications) {
            Notifications.removeNotificationSubscription(receivedListener);
            Notifications.removeNotificationSubscription(responseListener);
          }
        } catch (error) {
          console.warn('Error removing notification listeners:', error);
        }
      };
    } catch (error) {
      console.warn('Error setting up notification listeners:', error);
      return () => {};
    }
  },

  /**
   * Get notification badge count
   */
  async getBadgeCount(): Promise<number> {
    if (!this.isAvailable()) {
      return 0;
    }

    try {
      if (!Notifications) return 0;
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      console.warn('Error getting badge count:', error);
      return 0;
    }
  },

  /**
   * Set notification badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      if (!Notifications) return;
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.warn('Error setting badge count:', error);
    }
  },

  /**
   * Clear all notifications
   */
  async clearAllNotifications(): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      if (!Notifications) return;
      await Notifications.dismissAllNotificationsAsync();
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.warn('Error clearing notifications:', error);
    }
  },
};
