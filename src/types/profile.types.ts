// Profile Types
export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  phone_verified: boolean;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
  favorite_listings_count?: number;
  favorite_events_count?: number;
  listings_count?: number;
  events_count?: number;
  posts_count?: number;
  garage_count?: number;
}

export interface UpdateProfileData {
  username?: string;
  full_name?: string;
  bio?: string;
  avatar_url?: string;
  location?: string;
  phone_number?: string;
}
