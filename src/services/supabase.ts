import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
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

// Handle deep links for email verification
const handleDeepLink = async (url: string) => {
  console.log('🔗 Deep link received:', url);
  
  if (!url) return;

  try {
    // Supabase email verification flow:
    // 1. User clicks link in email: https://your-project.supabase.co/auth/v1/verify?token=xxx&type=signup&redirect_to=gtr-marketplace://verify-email
    // 2. Supabase verifies server-side and redirects to: gtr-marketplace://verify-email?token=xxx&type=signup
    // 3. Our app receives the deep link - session should already be verified
    
    let token: string | null = null;
    let type: string | null = null;
    
    // Check if it's a Supabase redirect URL (contains supabase.co/auth)
    if (url.includes('supabase.co/auth')) {
      const urlObj = new URL(url);
      token = urlObj.searchParams.get('token');
      type = urlObj.searchParams.get('type');
      console.log('📧 Supabase redirect URL detected');
      console.log('🔑 Extracted token:', token ? `${token.substring(0, 10)}...` : 'none');
      console.log('📝 Extracted type:', type);
      
      // For Supabase redirect URLs, we need to verify the token
      if (token && type === 'signup') {
        console.log('✅ Verifying email with token from Supabase redirect...');
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'email',
        });
        
        if (error) {
          console.error('❌ Email verification error:', error);
          console.error('Error details:', JSON.stringify(error, null, 2));
        } else {
          console.log('✅ Email verified successfully!');
          console.log('Session:', data?.session ? 'Created' : 'Not created');
          console.log('User:', data?.user?.email);
        }
      }
    } else if (url.includes('gtr-marketplace://')) {
      // Direct deep link - Supabase already verified, just check session
      const urlObj = new URL(url);
      token = urlObj.searchParams.get('token');
      type = urlObj.searchParams.get('type');
      console.log('📱 Direct deep link detected');
      console.log('🔑 Extracted token:', token ? `${token.substring(0, 10)}...` : 'none');
      console.log('📝 Extracted type:', type);
      
      // Check if we have a valid session (Supabase should have verified already)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('❌ Error getting session:', sessionError);
      } else if (session && session.user?.email_confirmed_at) {
        console.log('✅ Email already verified! Session is valid.');
        console.log('User:', session.user.email);
      } else {
        console.log('⚠️ Session not found or email not confirmed');
        // Try to verify with token if we have one
        if (token && type === 'signup') {
          console.log('🔄 Attempting to verify with token...');
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'email',
          });
          
          if (error) {
            console.error('❌ Email verification error:', error);
          } else {
            console.log('✅ Email verified successfully!');
          }
        }
      }
    } else {
      console.log('⚠️ Unknown URL format:', url);
    }
  } catch (err: any) {
    console.error('❌ Error parsing deep link URL:', err);
    console.error('URL was:', url);
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
  }
};

// Handle deep links when app is already running
Linking.addEventListener('url', (event) => {
  console.log('🔔 URL event received (app running)');
  handleDeepLink(event.url);
});

// Handle initial URL when app opens from a link
Linking.getInitialURL().then((url) => {
  if (url) {
    console.log('🚀 Initial URL (app opened from link):', url);
    handleDeepLink(url);
  }
});
