import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Safely import expo-notifications (may fail in Expo Go)
let Notifications: any = null;
let isNotificationsAvailable = false;
const isExpoGo = Constants.executionEnvironment === 'storeClient';
const expoProjectId =
  Constants?.expoConfig?.extra?.eas?.projectId ||
  Constants?.expoConfig?.projectId ||
  Constants?.easConfig?.projectId ||
  null;
const isAndroidWithoutExpoProject = Platform.OS === 'android' && !expoProjectId;
let hasLoggedMissingFcmWarning = false;

const isMissingFcmSetupError = (error: any) => {
  if (!error) return false;
  const message = typeof error === 'string' ? error : error?.message;
  if (!message || typeof message !== 'string') {
    return false;
  }
  return (
    message.includes('Default FirebaseApp is not initialized') ||
    message.includes('FCM') ||
    message.includes('FirebaseApp')
  );
};

const logMissingFcmWarningOnce = () => {
  if (hasLoggedMissingFcmWarning) return;
  hasLoggedMissingFcmWarning = true;
  console.warn(
    'Push notifications: missing Expo project ID/FCM credentials; skipping device token registration on Android.'
  );
};

let permissionPromise: Promise<boolean> | null = null;
let cachedPermissionGranted = false;
let tokenPromise: Promise<string | null> | null = null;
let cachedToken: string | null = null;

try {
  // Dynamic import to avoid crash if module not available
  Notifications = require('expo-notifications');
  
  if (!isExpoGo && Notifications?.setNotificationHandler) {
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

    if (cachedPermissionGranted) {
      return true;
    }

    if (permissionPromise) {
      return permissionPromise;
    }

    permissionPromise = (async () => {
      try {
        if (!Notifications) return false;
        
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        cachedPermissionGranted = finalStatus === 'granted';

        if (!cachedPermissionGranted) {
          console.warn('Failed to get push notification permissions!');
        }

        return cachedPermissionGranted;
      } catch (error) {
        console.warn('Error requesting notification permissions:', error);
        return false;
      } finally {
        permissionPromise = null;
      }
    })();

    return permissionPromise;
  },

  /**
   * Get device push token
   */
  async getDeviceToken(): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }

    if (isAndroidWithoutExpoProject) {
      logMissingFcmWarningOnce();
      return null;
    }

    if (cachedToken) {
      return cachedToken;
    }

    if (tokenPromise) {
      return tokenPromise;
    }

    tokenPromise = (async () => {
      try {
        if (!Notifications) return null;
        
        const hasPermission = await this.requestPermissions();
        if (!hasPermission) return null;

        if (expoProjectId && Notifications.getExpoPushTokenAsync) {
          const expoToken = await Notifications.getExpoPushTokenAsync({ projectId: expoProjectId });
          cachedToken = expoToken?.data ?? null;
        } else {
          const tokenData = await Notifications.getDevicePushTokenAsync();
          cachedToken = (tokenData?.data as string) || null;
        }

        return cachedToken;
      } catch (error) {
        if (isMissingFcmSetupError(error)) {
          logMissingFcmWarningOnce();
        } else {
          console.warn('Error getting device token (push notifications may not be available):', error);
        }
        return null;
      } finally {
        tokenPromise = null;
      }
    })();

    return tokenPromise;
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
        if (__DEV__) {
          console.info('Push notifications: no device token available (likely missing permissions or credentials).');
        }
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
      cachedToken = null;
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

    const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;

    try {
      if (!Notifications?.setBadgeCountAsync) return;
      await Notifications.setBadgeCountAsync(safeCount);
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
      await this.setBadgeCount(0);
    } catch (error) {
      console.warn('Error clearing notifications:', error);
    }
  },
};
