import { supabase } from './supabase';
import {
  Event,
  EventWithCreator,
  EventRSVP,
  EventRSVPWithUser,
  CreateEventData,
  UpdateRSVPData,
} from '../types/event.types';

const attachCreatorProfiles = async (events: EventWithCreator[]): Promise<EventWithCreator[]> => {
  if (!events?.length) return [];

  const creatorIds = Array.from(new Set(events.map(event => event.created_by).filter(Boolean)));
  if (!creatorIds.length) {
    return events.map(event => ({ ...event, profiles: event.profiles || null }));
  }

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .in('id', creatorIds);

  if (error) throw error;

  const profileMap = new Map(
    (profiles || []).map(profile => [
      profile.id,
      {
        username: profile.username,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
      },
    ])
  );

  return events.map(event => ({
    ...event,
    event_images: event.event_images || [],
    profiles: profileMap.get(event.created_by) || null,
  }));
};

export const eventsService = {
  /**
   * Get all upcoming events (optimized - only fetches required fields)
  */
  async getUpcomingEvents(limit: number = 50): Promise<EventWithCreator[]> {
    const now = new Date();
    const toleranceMs = 2 * 60 * 60 * 1000; // include events that started within last 2 hours
    const startThreshold = new Date(now.getTime() - toleranceMs).toISOString();

    const { data, error } = await supabase
      .from('events')
      .select(
        `
        *,
        event_images (*)
      `
      )
      .gte('start_date', startThreshold)
      .order('start_date', { ascending: true })
      .order('display_order', { foreignTable: 'event_images', ascending: true })
      .limit(limit);

    if (error) throw error;
    const events = (data || []) as EventWithCreator[];
    return attachCreatorProfiles(events);
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
        event_images (*)
      `
      )
      .order('start_date', { ascending: false })
      .order('display_order', { foreignTable: 'event_images', ascending: true })
      .limit(limit);

    if (error) throw error;
    const events = (data || []) as EventWithCreator[];
    return attachCreatorProfiles(events);
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
        event_images (*)
      `
      )
      .eq('id', eventId)
      .order('display_order', { foreignTable: 'event_images', ascending: true })
      .single();

    if (error) throw error;
    if (!data) return null;
    const [eventWithProfile] = await attachCreatorProfiles([data as EventWithCreator]);
    return eventWithProfile || null;
  },

  /**
   * Get events created by a user (optimized - only fetches required fields)
   */
  async getUserEvents(userId: string): Promise<EventWithCreator[]> {
    const { data, error } = await supabase
      .from('events')
      .select(
        `
        *,
        event_images (*)
      `
      )
      .eq('created_by', userId)
      .order('start_date', { ascending: false })
      .order('display_order', { foreignTable: 'event_images', ascending: true });

    if (error) throw error;
    const events = (data || []) as EventWithCreator[];
    return attachCreatorProfiles(events);
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
      const eventRSVPs = rsvps.filter(r => r.event_id === eventId).slice(0, 5); // Limit to 5 per event
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

  /**
   * Delete an event (only by creator)
   */
  async deleteEvent(eventId: string): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId)
      .eq('created_by', user.id);

    if (error) throw error;
  },

  /**
   * Update an event (only by creator)
   */
  async updateEvent(eventId: string, updates: Partial<CreateEventData>): Promise<Event> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('events')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', eventId)
      .eq('created_by', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
