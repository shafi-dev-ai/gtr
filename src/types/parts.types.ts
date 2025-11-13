// Parts Listing Types
export interface PartsListing {
  id: string;
  user_id: string;
  title: string;
  part_name: string;
  part_number: string | null;
  compatible_models: string[];
  price: number;
  condition: string | null;
  description: string | null;
  image_urls: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PartsListingWithUser extends PartsListing {
  profiles?: {
    username: string | null;
    avatar_url: string | null;
  };
}

export interface CreatePartsListingData {
  title: string;
  part_name: string;
  part_number?: string;
  compatible_models: string[];
  price: number;
  condition?: string;
  description?: string;
  image_urls?: string[];
}

