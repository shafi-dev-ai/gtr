import { supabase } from './supabase';
import { Session, User } from '@supabase/supabase-js';

export interface SignUpData {
  email: string;
  password: string;
  phoneNumber: string;
}

export interface SignInData {
  email: string;
  password: string;
  persistSession?: boolean;
}

export const authService = {
  async signUp(data: SignUpData) {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          phone_number: data.phoneNumber,
        },
        emailRedirectTo: 'gtr-marketplace://verify-email',
      },
    });

    // If signup successful and we have a user, update the profile with phone number
    if (!error && authData?.user && data.phoneNumber) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ phone_number: data.phoneNumber })
        .eq('id', authData.user.id);

      if (profileError) {
        console.log('Error updating profile with phone number:', profileError);
        // Don't fail the signup if profile update fails, just log it
      }
    }

    return { data: authData, error };
  },

  async signIn(data: SignInData) {
    // Set session persistence based on keepSignedIn checkbox
    const persistSession = data.persistSession !== false; // Default to true if not specified
    
    // Import conditional storage to set preference
    const { conditionalStorage } = await import('./sessionStorage');
    
    // Set persistence preference before login
    conditionalStorage.setPersistPreference(persistSession);
    
    // If not persisting, clear any existing persisted session
    if (!persistSession) {
      await conditionalStorage.removeItem('sb-auth-token');
    }
    
    // Sign in - storage adapter will use the correct storage based on preference
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    return { data: authData, error, persistSession };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  async getSession(): Promise<Session | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  },

  async getUser(): Promise<User | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  },

  onAuthStateChange(callback: (session: Session | null) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
  },

  async resendVerificationEmail(email: string) {
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: 'gtr-marketplace://verify-email',
      },
    });
    return { data, error };
  },

  async resetPasswordForEmail(email: string) {
    // Use signInWithOtp to send OTP code directly (no email template configuration needed)
    // This sends a 6-digit OTP code to the email
    const { data, error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: false, // Don't create user if doesn't exist
        emailRedirectTo: 'gtr-marketplace://reset-password', // Not used for OTP but required
      },
    });
    return { data, error };
  },

  async verifyOTP(email: string, token: string) {
    // Verify OTP for password recovery
    // After verification, user will be authenticated and can update password
    const { data, error } = await supabase.auth.verifyOtp({
      email: email,
      token: token,
      type: 'email', // Use 'email' type for signInWithOtp verification
    });
    return { data, error };
  },

  async updatePassword(newPassword: string) {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { data, error };
  },
};

