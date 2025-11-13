import { supabase } from './supabase';
import { EventWithCreator } from '../types/event.types';

export interface FavoriteEvent extends EventWithCreator {
  favorited_at: string;
}

class EventFavoritesService {
  /**
   * Get all favorite events for the current user
   */
  async getUserFavoriteEvents(limit: number = 50, offset: number = 0): Promise<FavoriteEvent[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .rpc('get_user_favorite_events', {
        p_user_id: user.id,
        p_limit: limit,
        p_offset: offset,
      });

    if (error) throw error;

    return (data || []) as FavoriteEvent[];
  }

  /**
   * Check if the current user has favorited an event
   */
  async hasUserFavorited(eventId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .rpc('has_user_favorited_event', {
        p_user_id: user.id,
        p_event_id: eventId,
      });

    if (error) {
      console.error('Error checking favorite status:', error);
      return false;
    }

    return data === true;
  }

  /**
   * Favorite an event
   */
  async favoriteEvent(eventId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('event_favorites')
      .insert({
        event_id: eventId,
        user_id: user.id,
      });

    if (error) {
      // If it's a unique constraint error, the event is already favorited
      if (error.code === '23505') {
        return; // Already favorited, no error
      }
      throw error;
    }
  }

  /**
   * Unfavorite an event
   */
  async unfavoriteEvent(eventId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('event_favorites')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', user.id);

    if (error) throw error;
  }

  /**
   * Toggle favorite status (favorite if not favorited, unfavorite if favorited)
   */
  async toggleFavorite(eventId: string): Promise<boolean> {
    const isFavorited = await this.hasUserFavorited(eventId);
    
    if (isFavorited) {
      await this.unfavoriteEvent(eventId);
      return false;
    } else {
      await this.favoriteEvent(eventId);
      return true;
    }
  }

  /**
   * Get favorite count for a specific event
   */
  async getEventFavoriteCount(eventId: string): Promise<number> {
    const { count, error } = await supabase
      .from('event_favorites')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Get user's favorite events count from profile
   */
  async getUserFavoriteCount(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { data, error } = await supabase
      .from('profiles')
      .select('favorite_events_count')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return data?.favorite_events_count || 0;
  }

  /**
   * Subscribe to favorite changes for an event
   */
  subscribeToEventFavorites(
    eventId: string,
    callback: (count: number) => void
  ) {
    const channel = supabase
      .channel(`event_favorites_${eventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_favorites',
          filter: `event_id=eq.${eventId}`,
        },
        async () => {
          const count = await this.getEventFavoriteCount(eventId);
          callback(count);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * Subscribe to user's favorite events changes
   */
  async subscribeToUserFavoriteEvents(
    callback: (favorites: FavoriteEvent[]) => void
  ): Promise<() => void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return () => {};

    const channel = supabase
      .channel(`user_favorite_events_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_favorites',
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          const favorites = await this.getUserFavoriteEvents();
          callback(favorites);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export const eventFavoritesService = new EventFavoritesService();

