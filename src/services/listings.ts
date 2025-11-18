import { supabase } from './supabase';
import { Listing, ListingWithImages, CreateListingData } from '../types/listing.types';

export const listingsService = {
  /**
   * Get all active listings with images (optimized - only fetches required fields)
   */
  async getAllListings(limit?: number): Promise<ListingWithImages[]> {
    const { data, error } = await supabase
      .from('listings')
      .select(
        `
        id,
        user_id,
        title,
        model,
        year,
        price,
        mileage,
        condition,
        transmission,
        country,
        city,
        state,
        zip_code,
        street_address,
        location,
        description,
        vin,
        color,
        status,
        created_at,
        updated_at,
        sold_at,
        listing_images (id, listing_id, image_url, storage_path, is_primary, display_order, created_at)
      `
      )
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit || 1000);

    if (error) throw error;
    return data || [];
  },

  /**
   * Get a single listing by ID with images
   */
  async getListingById(id: string): Promise<ListingWithImages | null> {
    const { data, error } = await supabase
      .from('listings')
      .select(
        `
        *,
        listing_images (*)
      `
      )
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get listings for a specific user
   */
  async getUserListings(userId: string): Promise<ListingWithImages[]> {
    const { data, error } = await supabase
      .from('listings')
      .select(
        `
        *,
        listing_images (*)
      `
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get active listings for a specific user
   */
  async getUserActiveListings(userId: string): Promise<ListingWithImages[]> {
    const { data, error } = await supabase
      .from('listings')
      .select(
        `
        *,
        listing_images (*)
      `
      )
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new listing
   */
  async createListing(listingData: CreateListingData): Promise<Listing> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('listings')
      .insert({
        ...listingData,
        user_id: user.id,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update a listing
   */
  async updateListing(listingId: string, updates: Partial<CreateListingData>): Promise<Listing> {
    const { data, error } = await supabase
      .from('listings')
      .update(updates)
      .eq('id', listingId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete a listing (soft delete by setting status to 'sold' or hard delete)
   */
  async deleteListing(listingId: string, softDelete: boolean = true): Promise<void> {
    if (softDelete) {
      const { error } = await supabase
        .from('listings')
        .update({ status: 'sold', sold_at: new Date().toISOString() })
        .eq('id', listingId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('listings').delete().eq('id', listingId);
      if (error) throw error;
    }
  },

  /**
   * Get listings by model (optimized - only fetches required fields)
   */
  async getListingsByModel(model: string, limit?: number): Promise<ListingWithImages[]> {
    const { data, error } = await supabase
      .from('listings')
      .select(
        `
        id,
        user_id,
        title,
        model,
        year,
        price,
        mileage,
        condition,
        transmission,
        country,
        city,
        state,
        zip_code,
        street_address,
        location,
        description,
        vin,
        color,
        status,
        created_at,
        updated_at,
        sold_at,
        listing_images (id, listing_id, image_url, storage_path, is_primary, display_order, created_at)
      `
      )
      .eq('model', model)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit || 1000);

    if (error) throw error;
    return data || [];
  },
};
