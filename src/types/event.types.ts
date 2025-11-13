// Event Types
export interface Event {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  event_type: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  start_date: string;
  end_date: string | null;
  rsvp_count: number;
  max_attendees: number | null;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventWithCreator extends Event {
  profiles?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface EventRSVP {
  id: string;
  event_id: string;
  user_id: string;
  status: 'going' | 'maybe' | 'not_going';
  checked_in: boolean;
  checked_in_at: string | null;
  created_at: string;
}

export interface EventRSVPWithUser extends EventRSVP {
  profiles?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface CreateEventData {
  title: string;
  description?: string;
  event_type: string;
  location: string;
  latitude?: number;
  longitude?: number;
  start_date: string;
  end_date?: string;
  max_attendees?: number;
  cover_image_url?: string;
}

export interface UpdateRSVPData {
  status: 'going' | 'maybe' | 'not_going';
}

