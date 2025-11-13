import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { authService } from '../services/auth';
import { initializationService } from '../services/initialization';

interface AuthContextType {
  isAuthenticated: boolean;
  setIsAuthenticated: (value: boolean) => void;
  isLoading: boolean;
  session: Session | null;
  user: any;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Get initial session
    authService.getSession().then((session) => {
      setSession(session);
      setIsAuthenticated(!!session && !!session.user?.email_confirmed_at);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = authService.onAuthStateChange(async (session) => {
      setSession(session);
      const isAuth = !!session && !!session.user?.email_confirmed_at;
      setIsAuthenticated(isAuth);
      setUser(session?.user ?? null);
      setIsLoading(false);

      // Initialize critical data on login
      if (isAuth) {
        try {
          await initializationService.initializeCriticalData();
        } catch (error) {
          console.error('Error initializing data:', error);
          // Don't block login if initialization fails
        }
      } else {
        // Clear cache on logout
        initializationService.clearAll();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, setIsAuthenticated, isLoading, session, user }}>
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

