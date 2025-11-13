import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { WelcomeScreen } from './src/screens/auth/WelcomeScreen';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { RegisterScreen } from './src/screens/auth/RegisterScreen';
import { EmailVerificationScreen } from './src/screens/auth/EmailVerificationScreen';
import { ForgotPasswordScreen } from './src/screens/auth/ForgotPasswordScreen';
import { VerifyOTPScreen } from './src/screens/auth/VerifyOTPScreen';
import { ResetPasswordScreen } from './src/screens/auth/ResetPasswordScreen';
import { DashboardScreen } from './src/screens/app/DashboardScreen';
import { AccountSettingsScreen } from './src/screens/profile/AccountSettingsScreen';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
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
      <Stack.Screen name="VerifyOTP" component={VerifyOTPScreen} />
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
    </Stack.Navigator>
  );
};

const RootNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#DC143C" />
      </View>
    );
  }

  return (
    <NavigationContainer>
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
        <RootNavigator />
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
});
