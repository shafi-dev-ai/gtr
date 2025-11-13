import { supabase } from './supabase';
import { Profile, UpdateProfileData } from '../types/profile.types';

export const profilesService = {
  /**
   * Get current user's profile
   */
  async getCurrentUserProfile(): Promise<Profile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get a profile by user ID
   */
  async getProfileByUserId(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get multiple profiles by user IDs
   */
  async getProfilesByUserIds(userIds: string[]): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('id', userIds);

    if (error) throw error;
    return data || [];
  },

  /**
   * Update current user's profile
   */
  async updateProfile(updates: UpdateProfileData): Promise<Profile> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update avatar URL only
   */
  async updateAvatar(avatarUrl: string): Promise<Profile> {
    return this.updateProfile({ avatar_url: avatarUrl });
  },

  /**
   * Search profiles by username or name
   */
  async searchProfiles(searchTerm: string): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%`)
      .limit(20);

    if (error) throw error;
    return data || [];
  },
};

