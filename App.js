import React, { useEffect } from 'react';
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
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { conditionalStorage } from './src/services/sessionStorage';

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
    </Stack.Navigator>
  );
};

const RootNavigator = () => {
  const { isAuthenticated, isLoading, isLoggingOut } = useAuth();

  // Check if we need to navigate to ResetPassword when AuthStack becomes active
  React.useEffect(() => {
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

  if (isLoading || isLoggingOut) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC143C" />
        {isLoggingOut && (
          <Text style={styles.loadingText}>Logging out...</Text>
        )}
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {isAuthenticated ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default function App() {
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

    return () => {
      subscription.remove();
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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#181920',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Rubik',
    fontWeight: '500',
  },
});
