import { ImageSource } from 'expo-image';

export const FALLBACK_AVATAR: ImageSource = require('../../assets/placeholders/avatar_placeholder.png');
export const FALLBACK_CARD: ImageSource = require('../../assets/placeholders/card_placeholder.jpg');
export const FALLBACK_HERO: ImageSource = require('../../assets/placeholders/hero_placeholder.png');

export const pickImageSource = (uri?: string | null, fallback: ImageSource = FALLBACK_CARD): ImageSource => {
  return uri ? { uri } : fallback;
};

export const pickAvatarSource = (uri?: string | null): ImageSource => pickImageSource(uri, FALLBACK_AVATAR);
