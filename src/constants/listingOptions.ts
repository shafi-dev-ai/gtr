export interface ListingModelOption {
  label: string;
  value: string;
}

export interface ListingColorOption {
  name: string;
  hex: string;
}

export const GTR_MODEL_OPTIONS: ListingModelOption[] = [
  { label: 'GT-R Track Edition', value: 'Nissan GT-R Track Edition' },
  { label: 'GT-R Nismo', value: 'Nissan GT-R Nismo' },
  { label: 'GT-R R35 (2009-2024)', value: 'Nissan GT-R R35' },
  { label: 'GT-R R34 (1999-2002)', value: 'Nissan GT-R R34' },
  { label: 'GT-R R33 (1995-1998)', value: 'Nissan GT-R R33' },
  { label: 'GT-R R32 (1989-1994)', value: 'Nissan GT-R R32' },
  
  
  
  
  
];

export const LISTING_CONDITION_OPTIONS = ['Poor', 'Average', 'Good', 'Excellent'];

export const COLOR_PRESETS: ListingColorOption[] = [
  { name: 'Jet Black Pearl', hex: '#0C0D11' },
  { name: 'Gun Metallic', hex: '#4C505B' },
  { name: 'Pearl White', hex: '#FFFFFF' },
  { name: 'Super Silver', hex: '#A7B1C0' },
  { name: 'Bayside Blue', hex: '#1F5FBF' },
  { name: 'Blaze Red', hex: '#B11B2D' },
  { name: 'Midnight Purple', hex: '#352C60' },
];
