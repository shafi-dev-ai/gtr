import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { authService } from '../services/auth';
import { initializationService } from '../services/initialization';
import { realtimeService } from '../services/realtime';
import { isRecoveryMode } from '../services/supabase';

interface AuthContextType {
  isAuthenticated: boolean;
  setIsAuthenticated: (value: boolean) => void;
  isLoading: boolean;
  isLoggingOut: boolean;
  logout: () => Promise<void>;
  session: Session | null;
  user: any;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<any>(null);

  const logout = async () => {
    setIsLoggingOut(true);
    try {
      // Clear cache and real-time subscriptions before logout
      initializationService.clearAll();
      realtimeService.cleanup();
      
      // Unregister device token for push notifications
      try {
        const { pushNotificationService } = await import('../services/pushNotifications');
        await pushNotificationService.unregisterDeviceToken();
        await pushNotificationService.clearAllNotifications();
      } catch (error) {
        console.error('Error unregistering push notifications:', error);
      }
      
      // Sign out
      const { error } = await authService.signOut();
      if (error) {
        console.error('Logout error:', error);
      } else {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Small delay to ensure cleanup completes
      setTimeout(() => {
        setIsLoggingOut(false);
      }, 500);
    }
  };

  useEffect(() => {
    // Get initial session
    authService.getSession().then((session) => {
      setSession(session);
      // Don't treat recovery sessions as authenticated - user needs to reset password first
      const isRecovery = isRecoveryMode();
      const isAuth = !!session && !!session.user?.email_confirmed_at && !isRecovery;
      setIsAuthenticated(isAuth);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = authService.onAuthStateChange(async (session) => {
      setSession(session);
      // Don't treat recovery sessions as authenticated - user needs to reset password first
      const isRecovery = isRecoveryMode();
      const isAuth = !!session && !!session.user?.email_confirmed_at && !isRecovery;
      setIsAuthenticated(isAuth);
      setUser(session?.user ?? null);
      setIsLoading(false);

      // Initialize critical data on login (but not for recovery sessions)
      if (isAuth && !isRecovery) {
        try {
          await initializationService.initializeCriticalData();
          // Register device for push notifications
          const { pushNotificationService } = await import('../services/pushNotifications');
          await pushNotificationService.registerDeviceToken();
        } catch (error) {
          console.error('Error initializing data:', error);
          // Don't block login if initialization fails
        }
      } else {
        // Clear cache and real-time subscriptions on logout or recovery
        // (Already done in logout function, but keep here as backup)
        initializationService.clearAll();
        realtimeService.cleanup();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, setIsAuthenticated, isLoading, isLoggingOut, logout, session, user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

