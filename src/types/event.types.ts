// Event Types
export interface EventImage {
  id: string;
  event_id: string;
  image_url: string;
  storage_path: string;
  is_primary: boolean;
  display_order: number;
  created_at: string;
}

export interface Event {
  id: string;
  created_by: string;
  title: string;
  description: string | null;
  event_type: string;
  location: string;
  country: string | null;
  state: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  start_date: string;
  end_date: string | null;
  rsvp_count: number;
  max_attendees: number | null;
  created_at: string;
  updated_at: string;
  event_images?: EventImage[];
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
  country?: string | null;
  state?: string | null;
  city?: string;
  latitude?: number;
  longitude?: number;
  start_date: string;
  end_date?: string;
  max_attendees?: number;
}

export interface UpdateRSVPData {
  status: 'going' | 'maybe' | 'not_going';
}
