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
}

export interface UpdateProfileData {
  username?: string;
  full_name?: string;
  bio?: string;
  avatar_url?: string;
  location?: string;
  phone_number?: string;
}

