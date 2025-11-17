import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { CommonActions } from '@react-navigation/native';
import { navigationRef } from '../navigation/RootNavigation';
import { conditionalStorage } from './sessionStorage';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables.');
  console.error('Supabase URL:', supabaseUrl ? 'Set' : 'Missing');
  console.error('Supabase Key:', supabaseAnonKey ? 'Set' : 'Missing');
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Initialize conditional storage
conditionalStorage.initialize();

// Create storage adapter using conditional storage
const storageAdapter = {
  getItem: (key: string) => conditionalStorage.getItem(key),
  setItem: (key: string, value: string) => conditionalStorage.setItem(key, value),
  removeItem: (key: string) => conditionalStorage.removeItem(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: storageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Global flag to track if we need to navigate to ResetPassword
let shouldNavigateToResetPassword = false;

// Global flag to indicate we're in password recovery mode (session should not be treated as authenticated)
let isRecoverySession = false;

// Helper function to navigate to ResetPassword screen
const navigateToResetPassword = () => {
  shouldNavigateToResetPassword = true;
  
  const attemptNavigation = (retries = 0) => {
    if (navigationRef.isReady()) {
      try {
        const currentRoute = navigationRef.getCurrentRoute();
        const routeName = currentRoute?.name;
        
        // If we're on AppStack (Dashboard, etc.), wait for AuthStack to become active
        const isOnAppStack = routeName === 'Dashboard' || routeName === 'AccountSettings' || 
                            routeName === 'MyListings' || routeName === 'MyEvents' ||
                            routeName === 'MyForumPosts' || routeName === 'MyGarage' ||
                            routeName === 'LikedListings' || routeName === 'LikedEvents';
        
        if (isOnAppStack) {
          // Wait for AuthContext to switch to AuthStack (recovery mode should make isAuthenticated = false)
          if (retries < 20) {
            setTimeout(() => attemptNavigation(retries + 1), 500);
          } else {
            console.error('AuthStack never became active after setting recovery session');
            // Fallback: RootNavigator should handle this
          }
          return;
        }
        
        // We're on AuthStack now, try to navigate
        // Use CommonActions.reset to ensure we're on the right stack
        try {
          navigationRef.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'ResetPassword' as never }],
            })
          );
          shouldNavigateToResetPassword = false;
        } catch (resetError) {
          // Fallback to regular navigate
          navigationRef.navigate('ResetPassword' as never);
          shouldNavigateToResetPassword = false;
        }
      } catch (navError: any) {
        // If navigation fails, wait and retry
        if (retries < 20) {
          setTimeout(() => attemptNavigation(retries + 1), 500);
        } else {
          console.error('Failed to navigate to ResetPassword after multiple attempts');
          // RootNavigator should handle this as fallback
        }
      }
    } else {
      // Navigation not ready yet, retry
      if (retries < 20) {
        setTimeout(() => attemptNavigation(retries + 1), 500);
      } else {
        console.error('Navigation never became ready');
      }
    }
  };
  
  // Wait a bit for AuthContext to process the recovery session and switch stacks
  setTimeout(() => attemptNavigation(), 1000);
};

// Export function to check if we should navigate (used by RootNavigator)
export const shouldNavigateToResetPasswordScreen = () => {
  return shouldNavigateToResetPassword;
};

// Export function to clear the flag
export const clearResetPasswordNavigationFlag = () => {
  shouldNavigateToResetPassword = false;
};

// Export function to check if we're in recovery mode
export const isRecoveryMode = () => {
  return isRecoverySession;
};

// Export function to clear recovery mode
export const clearRecoveryMode = () => {
  isRecoverySession = false;
};

// Handle deep links for email verification and password reset
const handleDeepLink = async (url: string) => {
  if (!url) return;

  try {
    let token: string | null = null;
    let type: string | null = null;
    
    // Check if it's a Supabase redirect URL (contains supabase.co/auth)
    if (url.includes('supabase.co/auth')) {
      const urlObj = new URL(url);
      token = urlObj.searchParams.get('token');
      type = urlObj.searchParams.get('type');
      
      // For Supabase redirect URLs, we need to verify the token
      if (type === 'recovery') {
        // Set recovery flag FIRST, before establishing session
        isRecoverySession = true;
        
        const { data, error } = await supabase.auth.exchangeCodeForSession(url);

        if (error) {
          console.error('Password recovery session error:', error);
        } else if (data.session) {
          navigateToResetPassword();
        }
      } else if (token && type === 'signup') {
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'email',
        });
        
        if (error) {
          console.error('Email verification error:', error);
        }
      }
    } else if (url.includes('gtr-marketplace://')) {
      // Direct deep link - handle both email verification and password recovery
      const urlObj = new URL(url);
      
      // Supabase sends tokens in hash fragment (#access_token=...) not query params
      // Parse both query params and hash fragment
      token = urlObj.searchParams.get('token');
      type = urlObj.searchParams.get('type');
      const code = urlObj.searchParams.get('code');
      
      // Parse hash fragment (Supabase OAuth-style redirects use hash)
      const hashMatch = url.match(/#(.+)/);
      let hashParams: { [key: string]: string } = {};
      if (hashMatch && hashMatch[1]) {
        hashMatch[1].split('&').forEach(param => {
          const [key, value] = param.split('=');
          if (key && value) {
            hashParams[key] = decodeURIComponent(value);
          }
        });
      }
      
      // Extract from hash if not in query params
      const accessToken = hashParams.access_token || token;
      const hashType = hashParams.type || type;
      const hashCode = hashParams.code || code;
      
      // Extract path (before # or ?)
      const pathMatch = url.match(/gtr-marketplace:\/\/([^?#]+)/);
      const path = pathMatch ? pathMatch[1] : '';
      
      // Handle password recovery
      if (path.includes('reset-password') || hashType === 'recovery' || hashCode || accessToken) {
        // Set recovery flag FIRST, before establishing session
        // This ensures AuthContext treats the session as unauthenticated
        isRecoverySession = true;
        
        // Supabase sends access_token in hash - use it to set session manually
        if (accessToken) {
          try {
            const refreshToken = hashParams.refresh_token;
            
            if (!refreshToken) {
              console.error('No refresh_token found in hash');
              // Try getSession anyway - Supabase might have set it
              const { data: { session } } = await supabase.auth.getSession();
              if (session) {
                navigateToResetPassword();
              }
            } else {
              // Manually set the session using access_token and refresh_token
              const { data, error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              
              if (error) {
                console.error('Error setting session:', error);
                // Fallback: try getSession - Supabase might have auto-set it
                const { data: { session: fallbackSession } } = await supabase.auth.getSession();
                if (fallbackSession) {
                  navigateToResetPassword();
                }
              } else if (data.session) {
                navigateToResetPassword();
              } else {
                console.error('setSession succeeded but no session returned');
              }
            }
          } catch (tokenError: any) {
            console.error('Error with access_token recovery:', tokenError);
            // Last resort: try getSession
            try {
              const { data: { session: lastResortSession } } = await supabase.auth.getSession();
              if (lastResortSession) {
                navigateToResetPassword();
              }
            } catch (e) {
              console.error('All session recovery methods failed');
            }
          }
        } else if (hashCode) {
          // Try code-based recovery
          try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(hashCode);
            
            if (error) {
              console.error('Password recovery session error:', error);
            } else if (data?.session) {
              navigateToResetPassword();
            }
          } catch (exchangeError: any) {
            console.error('Error exchanging code:', exchangeError);
          }
        } else {
          // Fallback: check if we already have a recovery session
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            navigateToResetPassword();
          } else {
            // Set flag anyway - Supabase might set session asynchronously
            navigateToResetPassword();
          }
        }
      } else if (type === 'signup' || path.includes('verify-email')) {
        // Email verification flow
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error getting session:', sessionError);
        } else if (!session || !session.user?.email_confirmed_at) {
          // Try to verify with token if we have one
          if (token && type === 'signup') {
            const { error } = await supabase.auth.verifyOtp({
              token_hash: token,
              type: 'email',
            });
            
            if (error) {
              console.error('Email verification error:', error);
            }
          }
        }
      }
    }
  } catch (err: any) {
    console.error('Error parsing deep link URL:', err);
  }
};

// Handle deep links when app is already running
Linking.addEventListener('url', (event) => {
  handleDeepLink(event.url);
});

// Handle initial URL when app opens from a link
Linking.getInitialURL().then((url) => {
  if (url) {
    handleDeepLink(url);
  }
});
