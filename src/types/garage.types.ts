// User Garage Types
export interface UserGarage {
  id: string;
  user_id: string;
  model: string;
  year: number | null;
  nickname: string | null;
  description: string | null;
  cover_image_url: string | null;
  mods: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateGarageData {
  model: string;
  year?: number;
  nickname?: string;
  description?: string;
  cover_image_url?: string;
  mods?: string[];
}

export interface UpdateGarageData {
  model?: string;
  year?: number;
  nickname?: string;
  description?: string;
  cover_image_url?: string;
  mods?: string[];
}

