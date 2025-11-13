import { supabase } from './supabase';
import { ListingWithImages } from '../types/listing.types';

export interface FavoriteListing extends ListingWithImages {
  favorited_at: string;
}

class FavoritesService {
  /**
   * Get all favorite listings for the current user
   */
  async getUserFavorites(limit: number = 50, offset: number = 0): Promise<FavoriteListing[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .rpc('get_user_favorite_listings', {
        p_user_id: user.id,
        p_limit: limit,
        p_offset: offset,
      });

    if (error) throw error;

    if (!data || data.length === 0) return [];

    // Fetch images for each listing
    const listingsWithImages = await Promise.all(
      data.map(async (listing) => {
        const { data: images } = await supabase
          .from('listing_images')
          .select('*')
          .eq('listing_id', listing.id)
          .order('display_order', { ascending: true });

        return {
          ...listing,
          images: images || [],
        } as FavoriteListing;
      })
    );

    return listingsWithImages;
  }

  /**
   * Check if the current user has favorited a listing
   */
  async hasUserFavorited(listingId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .rpc('has_user_favorited_listing', {
        p_user_id: user.id,
        p_listing_id: listingId,
      });

    if (error) {
      console.error('Error checking favorite status:', error);
      return false;
    }

    return data === true;
  }

  /**
   * Favorite a listing
   */
  async favoriteListing(listingId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('listing_favorites')
      .insert({
        listing_id: listingId,
        user_id: user.id,
      });

    if (error) {
      // If it's a unique constraint error, the listing is already favorited
      if (error.code === '23505') {
        return; // Already favorited, no error
      }
      throw error;
    }
  }

  /**
   * Unfavorite a listing
   */
  async unfavoriteListing(listingId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('listing_favorites')
      .delete()
      .eq('listing_id', listingId)
      .eq('user_id', user.id);

    if (error) throw error;
  }

  /**
   * Toggle favorite status (favorite if not favorited, unfavorite if favorited)
   */
  async toggleFavorite(listingId: string): Promise<boolean> {
    const isFavorited = await this.hasUserFavorited(listingId);
    
    if (isFavorited) {
      await this.unfavoriteListing(listingId);
      return false;
    } else {
      await this.favoriteListing(listingId);
      return true;
    }
  }

  /**
   * Get favorite count for a specific listing
   */
  async getListingFavoriteCount(listingId: string): Promise<number> {
    const { count, error } = await supabase
      .from('listing_favorites')
      .select('*', { count: 'exact', head: true })
      .eq('listing_id', listingId);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Get user's favorite count from profile
   */
  async getUserFavoriteCount(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { data, error } = await supabase
      .from('profiles')
      .select('favorite_listings_count')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return data?.favorite_listings_count || 0;
  }

  /**
   * Subscribe to favorite changes for a listing
   */
  subscribeToListingFavorites(
    listingId: string,
    callback: (count: number) => void
  ) {
    const channel = supabase
      .channel(`listing_favorites_${listingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'listing_favorites',
          filter: `listing_id=eq.${listingId}`,
        },
        async () => {
          const count = await this.getListingFavoriteCount(listingId);
          callback(count);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * Subscribe to user's favorite listings changes
   */
  async subscribeToUserFavorites(
    callback: (favorites: FavoriteListing[]) => void
  ): Promise<() => void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return () => {};

    const channel = supabase
      .channel(`user_favorites_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'listing_favorites',
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          const favorites = await this.getUserFavorites();
          callback(favorites);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export const favoritesService = new FavoritesService();

