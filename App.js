import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import { navigationRef } from './src/navigation/RootNavigation';
import { shouldNavigateToResetPasswordScreen, clearResetPasswordNavigationFlag } from './src/services/supabase';
import { WelcomeScreen } from './src/screens/auth/WelcomeScreen';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { RegisterScreen } from './src/screens/auth/RegisterScreen';
import { EmailVerificationScreen } from './src/screens/auth/EmailVerificationScreen';
import { ForgotPasswordScreen } from './src/screens/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from './src/screens/auth/ResetPasswordScreen';
import { DashboardScreen } from './src/screens/app/DashboardScreen';
import { AccountSettingsScreen } from './src/screens/profile/AccountSettingsScreen';
import { MyListingsScreen } from './src/screens/profile/MyListingsScreen';
import { MyEventsScreen } from './src/screens/profile/MyEventsScreen';
import { MyForumPostsScreen } from './src/screens/profile/MyForumPostsScreen';
import { MyGarageScreen } from './src/screens/profile/MyGarageScreen';
import { LikedListingsScreen } from './src/screens/profile/LikedListingsScreen';
import { LikedEventsScreen } from './src/screens/profile/LikedEventsScreen';
import { LikedForumPostsScreen } from './src/screens/profile/LikedForumPostsScreen';
import { ForumDetailScreen } from './src/screens/forum/ForumDetailScreen';
import { NotificationScreen } from './src/screens/notifications/NotificationScreen';
import { conditionalStorage } from './src/services/sessionStorage';
import { InboxScreen } from './src/screens/messages/InboxScreen';
import { ChatScreen } from './src/screens/messages/ChatScreen';
import { ListingDetailScreen } from './src/screens/listings/ListingDetailScreen';
import { CreateListingScreen } from './src/screens/listings/CreateListingScreen';
import { CreateEventScreen } from './src/screens/events/CreateEventScreen';
import { EventDetailScreen } from './src/screens/events/EventDetailScreen';
import { CreateForumPostScreen } from './src/screens/forum/CreateForumPostScreen';
import { BrandSplash } from './src/components/common/BrandSplash';

const Stack = createNativeStackNavigator();

const AuthStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
    </Stack.Navigator>
  );
};

const AppStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
      <Stack.Screen name="MyListings" component={MyListingsScreen} />
      <Stack.Screen name="MyEvents" component={MyEventsScreen} />
      <Stack.Screen name="MyForumPosts" component={MyForumPostsScreen} />
      <Stack.Screen name="MyGarage" component={MyGarageScreen} />
      <Stack.Screen name="LikedListings" component={LikedListingsScreen} />
      <Stack.Screen name="LikedEvents" component={LikedEventsScreen} />
      <Stack.Screen name="LikedForumPosts" component={LikedForumPostsScreen} />
      <Stack.Screen name="Notification" component={NotificationScreen} />
      <Stack.Screen name="Inbox" component={InboxScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="ListingDetail" component={ListingDetailScreen} />
      <Stack.Screen name="CreateListing" component={CreateListingScreen} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="CreateForumPost" component={CreateForumPostScreen} />
      <Stack.Screen name="ForumDetail" component={ForumDetailScreen} />
    </Stack.Navigator>
  );
};

const RootNavigator = () => {
  const { isAuthenticated, isLoading, isLoggingOut } = useAuth();
  const [showStartupSplash, setShowStartupSplash] = useState(true);

  useEffect(() => {
    if (!isLoading) {
      const timeout = setTimeout(() => setShowStartupSplash(false), 500);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [isLoading]);

  // Check if we need to navigate to ResetPassword when AuthStack becomes active
  useEffect(() => {
    if (!isLoading && !isAuthenticated && navigationRef.isReady()) {
      // We're on AuthStack now, check if we should navigate to ResetPassword
      if (shouldNavigateToResetPasswordScreen()) {
        setTimeout(() => {
          try {
            // Use CommonActions.reset to ensure we navigate to ResetPassword
            const { CommonActions } = require('@react-navigation/native');
            navigationRef.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'ResetPassword' }],
              })
            );
            clearResetPasswordNavigationFlag();
          } catch (error) {
            console.error('Failed to navigate to ResetPassword:', error);
            // Fallback to regular navigate
            try {
              navigationRef.navigate('ResetPassword');
              clearResetPasswordNavigationFlag();
            } catch (fallbackError) {
              console.error('Fallback navigation also failed:', fallbackError);
            }
          }
        }, 500); // Small delay to ensure stack is fully mounted
      }
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading || isLoggingOut || showStartupSplash) {
    return <BrandSplash message={isLoggingOut ? 'Logging out...' : undefined} />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {isAuthenticated ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default function App() {
  const notificationListener = useRef(null);
  const responseListener = useRef(null);
  useEffect(() => {
    // Handle app state changes to clear non-persistent sessions
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Check if session should not persist
        conditionalStorage.getItem('persist_session_preference').then((preference) => {
          if (preference === 'false') {
            // Clear in-memory session when app goes to background
            conditionalStorage.clearMemoryStorage();
          }
        });
      }
    });

    // Set up push notification listeners (only if available)
    const setupNotifications = async () => {
      try {
        const Notifications = require('expo-notifications');
        
        notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
          console.log('Notification received:', notification);
          // You can handle foreground notifications here
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
          console.log('Notification tapped:', response);
          const data = response.notification.request.content.data;
          
          // Navigate based on notification data
          if (navigationRef.isReady() && data) {
            if (data.listing_id) {
              // TODO: Navigate to listing detail
              console.log('Navigate to listing:', data.listing_id);
            } else if (data.event_id) {
              // TODO: Navigate to event detail
              console.log('Navigate to event:', data.event_id);
            } else if (data.post_id) {
              // TODO: Navigate to forum post
              console.log('Navigate to forum post:', data.post_id);
            } else if (data.conversation_id) {
              // TODO: Navigate to conversation
              console.log('Navigate to conversation:', data.conversation_id);
            }
          }
        });
      } catch (error) {
        console.warn('Push notifications not available (likely Expo Go):', error);
        // App will continue to work without push notifications
      }
    };
    
    setupNotifications();

    return () => {
      subscription.remove();
      if (notificationListener.current) {
        try {
          const Notifications = require('expo-notifications');
          Notifications.removeNotificationSubscription(notificationListener.current);
        } catch (error) {
          // Ignore - notifications not available
        }
      }
      if (responseListener.current) {
        try {
          const Notifications = require('expo-notifications');
          Notifications.removeNotificationSubscription(responseListener.current);
        } catch (error) {
          // Ignore - notifications not available
        }
      }
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <FavoritesProvider>
          <RootNavigator />
        </FavoritesProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
