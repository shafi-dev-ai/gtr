import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { favoritesService } from '../services/favorites';
import { eventFavoritesService } from '../services/eventFavorites';
import { realtimeService } from '../services/realtime';
import dataManager from '../services/dataManager';

interface FavoritesContextType {
  // Listing favorites
  isListingFavorited: (listingId: string) => boolean;
  favoriteListings: Set<string>;
  refreshListingFavorites: () => Promise<void>;
  listingFavoritesVersion: number; // Version counter to trigger refreshes
  
  // Event favorites
  isEventFavorited: (eventId: string) => boolean;
  favoriteEvents: Set<string>;
  refreshEventFavorites: () => Promise<void>;
  eventFavoritesVersion: number; // Version counter to trigger refreshes
  
  // Toggle functions
  toggleListingFavorite: (listingId: string) => Promise<boolean>;
  toggleEventFavorite: (eventId: string) => Promise<boolean>;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [favoriteListings, setFavoriteListings] = useState<Set<string>>(new Set());
  const [favoriteEvents, setFavoriteEvents] = useState<Set<string>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Keep refresh functions in refs to avoid stale closures
  const refreshListingFavoritesRef = useRef<(() => Promise<void>) | null>(null);
  const refreshEventFavoritesRef = useRef<(() => Promise<void>) | null>(null);

  // Load initial favorites
  useEffect(() => {
    if (!user?.id || isInitialized) return;

    const loadFavorites = async () => {
      try {
        // Load listing favorites
        const listings = await favoritesService.getUserFavorites(1000, 0);
        setFavoriteListings(new Set(listings.map(l => l.id)));

        // Load event favorites
        const events = await eventFavoritesService.getUserFavoriteEvents(1000, 0);
        setFavoriteEvents(new Set(events.map(e => e.id)));

        setIsInitialized(true);
      } catch (error) {
        console.error('Error loading favorites:', error);
        setIsInitialized(true); // Set to true even on error to prevent retry loops
      }
    };

    loadFavorites();
  }, [user?.id, isInitialized]);

  // Refresh listing favorites
  const refreshListingFavorites = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const listings = await favoritesService.getUserFavorites(1000, 0);
      setFavoriteListings(new Set(listings.map(l => l.id)));
    } catch (error) {
      console.error('Error refreshing listing favorites:', error);
    }
  }, [user?.id]);

  // Refresh event favorites
  const refreshEventFavorites = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const events = await eventFavoritesService.getUserFavoriteEvents(1000, 0);
      setFavoriteEvents(new Set(events.map(e => e.id)));
    } catch (error) {
      console.error('Error refreshing event favorites:', error);
    }
  }, [user?.id]);

  // Store refresh functions in refs
  useEffect(() => {
    refreshListingFavoritesRef.current = refreshListingFavorites;
    refreshEventFavoritesRef.current = refreshEventFavorites;
  }, [refreshListingFavorites, refreshEventFavorites]);

  // Track refresh triggers for screens
  const [listingFavoritesVersion, setListingFavoritesVersion] = useState(0);
  const [eventFavoritesVersion, setEventFavoritesVersion] = useState(0);

  // Subscribe to real-time updates for listing favorites
  useEffect(() => {
    if (!user?.id) return;

    let unsubscribe: (() => void) | null = null;

    const setupSubscription = async () => {
      unsubscribe = await realtimeService.subscribeToUserFavorites(async () => {
        // Invalidate cache
        dataManager.invalidateCache(/^user:favorites/);
        dataManager.invalidateCache(/^home:listings/);
        dataManager.invalidateCache(/^marketplace:listings/);
        
        // Refresh favorites list
        if (refreshListingFavoritesRef.current) {
          await refreshListingFavoritesRef.current();
          // Trigger refresh in screens
          setListingFavoritesVersion(prev => prev + 1);
        }
      });
    };

    setupSubscription();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.id]);

  // Subscribe to real-time updates for event favorites
  useEffect(() => {
    if (!user?.id) return;

    let unsubscribe: (() => void) | null = null;

    const setupSubscription = async () => {
      unsubscribe = await realtimeService.subscribeToUserEventFavorites(async () => {
        // Invalidate cache
        dataManager.invalidateCache(/^user:favorites:events/);
        dataManager.invalidateCache(/^home:events/);
        
        // Refresh favorites list
        if (refreshEventFavoritesRef.current) {
          await refreshEventFavoritesRef.current();
          // Trigger refresh in screens
          setEventFavoritesVersion(prev => prev + 1);
        }
      });
    };

    setupSubscription();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.id]);

  // Clear favorites on logout
  useEffect(() => {
    if (!user) {
      setFavoriteListings(new Set());
      setFavoriteEvents(new Set());
      setIsInitialized(false);
    }
  }, [user]);

  // Check if listing is favorited
  const isListingFavorited = useCallback((listingId: string): boolean => {
    return favoriteListings.has(listingId);
  }, [favoriteListings]);

  // Check if event is favorited
  const isEventFavorited = useCallback((eventId: string): boolean => {
    return favoriteEvents.has(eventId);
  }, [favoriteEvents]);

  // Toggle listing favorite
  const toggleListingFavorite = useCallback(async (listingId: string): Promise<boolean> => {
    const wasFavorited = favoriteListings.has(listingId);
    
    // Optimistic update
    const newSet = new Set(favoriteListings);
    if (wasFavorited) {
      newSet.delete(listingId);
    } else {
      newSet.add(listingId);
    }
    setFavoriteListings(newSet);
    
    // Immediately trigger refresh in screens (don't wait for real-time)
    setListingFavoritesVersion(prev => prev + 1);

    try {
      const result = await favoritesService.toggleFavorite(listingId);
      // Real-time subscription will update the set, but update immediately for better UX
      if (result) {
        setFavoriteListings(prev => new Set([...prev, listingId]));
      } else {
        setFavoriteListings(prev => {
          const updated = new Set(prev);
          updated.delete(listingId);
          return updated;
        });
      }
      // Trigger another refresh after API call completes
      setListingFavoritesVersion(prev => prev + 1);
      return result;
    } catch (error) {
      console.error('Error toggling listing favorite:', error);
      // Revert optimistic update
      setFavoriteListings(favoriteListings);
      setListingFavoritesVersion(prev => prev + 1); // Trigger refresh to revert UI
      throw error;
    }
  }, [favoriteListings]);

  // Toggle event favorite
  const toggleEventFavorite = useCallback(async (eventId: string): Promise<boolean> => {
    const wasFavorited = favoriteEvents.has(eventId);
    
    // Optimistic update
    const newSet = new Set(favoriteEvents);
    if (wasFavorited) {
      newSet.delete(eventId);
    } else {
      newSet.add(eventId);
    }
    setFavoriteEvents(newSet);
    
    // Immediately trigger refresh in screens (don't wait for real-time)
    setEventFavoritesVersion(prev => prev + 1);

    try {
      const result = await eventFavoritesService.toggleFavorite(eventId);
      // Real-time subscription will update the set, but update immediately for better UX
      if (result) {
        setFavoriteEvents(prev => new Set([...prev, eventId]));
      } else {
        setFavoriteEvents(prev => {
          const updated = new Set(prev);
          updated.delete(eventId);
          return updated;
        });
      }
      // Trigger another refresh after API call completes
      setEventFavoritesVersion(prev => prev + 1);
      return result;
    } catch (error) {
      console.error('Error toggling event favorite:', error);
      // Revert optimistic update
      setFavoriteEvents(favoriteEvents);
      setEventFavoritesVersion(prev => prev + 1); // Trigger refresh to revert UI
      throw error;
    }
  }, [favoriteEvents]);

  return (
    <FavoritesContext.Provider
      value={{
        isListingFavorited,
        favoriteListings,
        refreshListingFavorites,
        listingFavoritesVersion,
        isEventFavorited,
        favoriteEvents,
        refreshEventFavorites,
        eventFavoritesVersion,
        toggleListingFavorite,
        toggleEventFavorite,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
};

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};

