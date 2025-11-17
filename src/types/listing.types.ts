// Listing Types
export interface Listing {
  id: string;
  user_id: string;
  title: string;
  model: string;
  year: number;
  price: number;
  mileage: number | null;
  description: string | null;
  condition: string | null;
  country: string | null; // ISO country code (e.g., 'US', 'CA', 'GB')
  state: string | null; // State/Province (dependent on country)
  city: string | null;
  zip_code: string | null;
  street_address: string | null; // Custom street address
  location: string | null; // Full location string (kept for backward compatibility)
  vin: string | null;
  color: string | null;
  transmission: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  sold_at: string | null;
}

export interface ListingImage {
  id: string;
  listing_id: string;
  image_url: string;
  storage_path: string;
  is_primary: boolean;
  display_order: number;
  created_at: string;
}

export interface ListingWithImages extends Listing {
  listing_images: ListingImage[];
  profiles?: {
    username: string | null;
    avatar_url: string | null;
  };
}

export interface CreateListingData {
  title: string;
  model: string;
  year: number;
  price: number;
  mileage?: number;
  description?: string;
  condition?: string;
  country?: string; // ISO country code (e.g., 'US', 'CA', 'GB')
  state?: string; // State/Province (dependent on country)
  city?: string;
  zip_code?: string;
  street_address?: string; // Custom street address
  location?: string; // Full location string (kept for backward compatibility)
  vin?: string;
  color?: string;
  transmission?: string;
}

