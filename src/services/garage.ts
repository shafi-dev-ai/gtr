import { supabase } from './supabase';
import { UserGarage, CreateGarageData, UpdateGarageData } from '../types/garage.types';

export const garageService = {
  /**
   * Get current user's garage
   */
  async getCurrentUserGarage(): Promise<UserGarage[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('user_garage')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get garage for a specific user
   */
  async getUserGarage(userId: string): Promise<UserGarage[]> {
    const { data, error } = await supabase
      .from('user_garage')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get a single garage entry by ID
   */
  async getGarageById(garageId: string): Promise<UserGarage | null> {
    const { data, error } = await supabase
      .from('user_garage')
      .select('*')
      .eq('id', garageId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Create a new garage entry
   */
  async createGarageEntry(garageData: CreateGarageData): Promise<UserGarage> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('user_garage')
      .insert({
        ...garageData,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update a garage entry
   */
  async updateGarageEntry(garageId: string, updates: UpdateGarageData): Promise<UserGarage> {
    const { data, error } = await supabase
      .from('user_garage')
      .update(updates)
      .eq('id', garageId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete a garage entry
   */
  async deleteGarageEntry(garageId: string): Promise<void> {
    const { error } = await supabase.from('user_garage').delete().eq('id', garageId);
    if (error) throw error;
  },
};

