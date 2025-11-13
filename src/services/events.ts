import { supabase } from './supabase';
import {
  Event,
  EventWithCreator,
  EventRSVP,
  EventRSVPWithUser,
  CreateEventData,
  UpdateRSVPData,
} from '../types/event.types';

export const eventsService = {
  /**
   * Get all upcoming events (optimized - only fetches required fields)
   */
  async getUpcomingEvents(limit: number = 50): Promise<EventWithCreator[]> {
    const { data, error } = await supabase
      .from('events')
      .select('id, created_by, title, description, event_type, location, start_date, end_date, rsvp_count, cover_image_url, created_at')
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return (data || []) as EventWithCreator[];
  },

  /**
   * Get all events (past and upcoming)
   */
  async getAllEvents(limit: number = 50): Promise<EventWithCreator[]> {
    const { data, error } = await supabase
      .from('events')
      .select(
        `
        *,
        profiles:created_by (
          username,
          full_name,
          avatar_url
        )
      `
      )
      .order('start_date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  /**
   * Get a single event by ID with creator profile
   */
  async getEventById(eventId: string): Promise<EventWithCreator | null> {
    const { data, error } = await supabase
      .from('events')
      .select(
        `
        *,
        profiles:created_by (
          username,
          full_name,
          avatar_url
        )
      `
      )
      .eq('id', eventId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get events created by a user (optimized - only fetches required fields)
   */
  async getUserEvents(userId: string): Promise<EventWithCreator[]> {
    // Fetch events without creator profile join first (only required fields)
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, created_by, title, description, event_type, location, start_date, end_date, rsvp_count, cover_image_url, created_at')
      .eq('created_by', userId)
      .order('start_date', { ascending: false });

    if (eventsError) throw eventsError;
    if (!events || events.length === 0) return [];

    // Fetch creator profiles separately
    const creatorIds = [...new Set(events.map(event => event.created_by))];
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', creatorIds);

    if (profilesError) throw profilesError;

    // Combine events with profiles
    return events.map(event => {
      const profile = profiles?.find(p => p.id === event.created_by);
      return {
        ...event,
        profiles: profile ? {
          username: profile.username,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
        } : undefined,
      };
    }) as EventWithCreator[];
  },

  /**
   * Create a new event
   */
  async createEvent(eventData: CreateEventData): Promise<Event> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('events')
      .insert({
        ...eventData,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get RSVPs for an event (optimized - only fetches required fields)
   */
  async getEventRSVPs(eventId: string, limit?: number): Promise<EventRSVPWithUser[]> {
    // First fetch RSVPs (only going status for avatars, limit to 3)
    const { data: rsvps, error: rsvpsError } = await supabase
      .from('event_rsvps')
      .select('id, event_id, user_id, status, created_at')
      .eq('event_id', eventId)
      .eq('status', 'going')
      .order('created_at', { ascending: true })
      .limit(limit || 100);

    if (rsvpsError) throw rsvpsError;
    if (!rsvps || rsvps.length === 0) return [];

    // Then fetch user profiles for each RSVP (only avatar_url needed)
    const userIds = rsvps.map(rsvp => rsvp.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', userIds);

    if (profilesError) throw profilesError;

    // Combine RSVPs with profiles
    return rsvps.map(rsvp => {
      const profile = profiles?.find(p => p.id === rsvp.user_id);
      return {
        ...rsvp,
        profiles: profile ? {
          username: profile.username,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
        } : undefined,
      };
    }) as EventRSVPWithUser[];
  },

  /**
   * Batch get RSVPs for multiple events (optimized for EventsSection)
   */
  async getBatchEventRSVPs(eventIds: string[]): Promise<Record<string, EventRSVPWithUser[]>> {
    if (eventIds.length === 0) return {};

    // Fetch all RSVPs for these events in one query
    const { data: rsvps, error: rsvpsError } = await supabase
      .from('event_rsvps')
      .select('id, event_id, user_id, status, created_at')
      .in('event_id', eventIds)
      .eq('status', 'going')
      .order('created_at', { ascending: true })
      .limit(500); // Limit total RSVPs fetched

    if (rsvpsError) throw rsvpsError;
    if (!rsvps || rsvps.length === 0) return {};

    // Get unique user IDs
    const userIds = [...new Set(rsvps.map(rsvp => rsvp.user_id))];
    
    // Fetch profiles in one query
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', userIds);

    if (profilesError) throw profilesError;

    // Group RSVPs by event_id and combine with profiles
    const result: Record<string, EventRSVPWithUser[]> = {};
    
    eventIds.forEach(eventId => {
      const eventRSVPs = rsvps.filter(r => r.event_id === eventId).slice(0, 3); // Limit to 3 per event
      result[eventId] = eventRSVPs.map(rsvp => {
        const profile = profiles?.find(p => p.id === rsvp.user_id);
        return {
          ...rsvp,
          profiles: profile ? {
            username: profile.username,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
          } : undefined,
        };
      }) as EventRSVPWithUser[];
    });

    return result;
  },

  /**
   * RSVP to an event
   */
  async rsvpToEvent(eventId: string, status: 'going' | 'maybe' | 'not_going' = 'going'): Promise<EventRSVP> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('event_rsvps')
      .upsert(
        {
          event_id: eventId,
          user_id: user.id,
          status,
        },
        {
          onConflict: 'event_id,user_id',
        }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update RSVP status
   */
  async updateRSVP(eventId: string, status: 'going' | 'maybe' | 'not_going'): Promise<EventRSVP> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('event_rsvps')
      .update({ status })
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Cancel RSVP (delete)
   */
  async cancelRSVP(eventId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('event_rsvps')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', user.id);

    if (error) throw error;
  },

  /**
   * Get current user's RSVP status for an event
   */
  async getUserRSVPStatus(eventId: string): Promise<EventRSVP | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('event_rsvps')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    return data || null;
  },
};

