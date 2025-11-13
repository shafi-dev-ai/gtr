import { supabase } from './supabase';
import { ListingWithImages } from '../types/listing.types';

export interface SearchFilters {
  searchText?: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  priceMin?: number;
  priceMax?: number;
  city?: string;
  state?: string;
  condition?: string;
  transmission?: string;
}

export const searchService = {
  /**
   * Search listings using the search_listings function
   */
  async searchListings(
    filters: SearchFilters,
    limit: number = 15,
    offset: number = 0
  ): Promise<ListingWithImages[]> {
    const { data, error } = await supabase.rpc('search_listings', {
      search_query: filters.searchText || null,
      model_filter: filters.model || null,
      year_min: filters.yearMin || null,
      year_max: filters.yearMax || null,
      price_min: filters.priceMin || null,
      price_max: filters.priceMax || null,
      city_filter: filters.city || null,
      state_filter: filters.state || null,
      condition_filter: filters.condition || null,
      transmission_filter: filters.transmission || null,
      limit_count: limit,
      offset_count: offset,
    });

    if (error) throw error;

    // The RPC returns basic listing data, we need to fetch images separately
    if (data && data.length > 0) {
      const listingIds = data.map((l: any) => l.id);
      const { data: imagesData } = await supabase
        .from('listing_images')
        .select('*')
        .in('listing_id', listingIds);

      // Attach images to listings
      return data.map((listing: any) => ({
        ...listing,
        listing_images: imagesData?.filter((img: any) => img.listing_id === listing.id) || [],
      }));
    }

    return data || [];
  },

  /**
   * Direct query approach (alternative to RPC)
   */
  async searchListingsDirect(
    filters: SearchFilters,
    limit: number = 15,
    offset: number = 0
  ): Promise<ListingWithImages[]> {
    let query = supabase
      .from('listings')
      .select(
        `
        *,
        listing_images (*)
      `
      )
      .eq('status', 'active');

    // Full-text search
    if (filters.searchText) {
      query = query.textSearch('search_vector', filters.searchText, {
        type: 'plain',
        config: 'english',
      });
    }

    // Model filter
    if (filters.model) {
      query = query.eq('model', filters.model);
    }

    // Year range
    if (filters.yearMin) {
      query = query.gte('year', filters.yearMin);
    }
    if (filters.yearMax) {
      query = query.lte('year', filters.yearMax);
    }

    // Price range
    if (filters.priceMin) {
      query = query.gte('price', filters.priceMin);
    }
    if (filters.priceMax) {
      query = query.lte('price', filters.priceMax);
    }

    // Location filters
    if (filters.city) {
      query = query.ilike('city', `%${filters.city}%`);
    }
    if (filters.state) {
      query = query.ilike('state', `%${filters.state}%`);
    }

    // Condition filter
    if (filters.condition) {
      query = query.eq('condition', filters.condition);
    }

    // Transmission filter
    if (filters.transmission) {
      query = query.eq('transmission', filters.transmission);
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    // Order by
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },
};

