// ============================================================================
// Location Data Utility
// Provides countries and states/provinces data for location selection
// ============================================================================

export interface Country {
  code: string; // ISO country code (e.g., 'US', 'CA', 'GB')
  name: string; // Display name
}

export interface State {
  code: string; // State code (e.g., 'CA', 'NY', 'TX')
  name: string; // Display name
}

// Countries list (extendable)
export const COUNTRIES: Country[] = [
  { code: 'US', name: 'United States' },
  // Add more countries as needed:
  // { code: 'CA', name: 'Canada' },
  // { code: 'GB', name: 'United Kingdom' },
  // { code: 'AU', name: 'Australia' },
];

// States/Provinces by country code
export const STATES_BY_COUNTRY: Record<string, State[]> = {
  US: [
    { code: 'AL', name: 'Alabama' },
    { code: 'AK', name: 'Alaska' },
    { code: 'AZ', name: 'Arizona' },
    { code: 'AR', name: 'Arkansas' },
    { code: 'CA', name: 'California' },
    { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' },
    { code: 'DE', name: 'Delaware' },
    { code: 'FL', name: 'Florida' },
    { code: 'GA', name: 'Georgia' },
    { code: 'HI', name: 'Hawaii' },
    { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' },
    { code: 'IN', name: 'Indiana' },
    { code: 'IA', name: 'Iowa' },
    { code: 'KS', name: 'Kansas' },
    { code: 'KY', name: 'Kentucky' },
    { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' },
    { code: 'MD', name: 'Maryland' },
    { code: 'MA', name: 'Massachusetts' },
    { code: 'MI', name: 'Michigan' },
    { code: 'MN', name: 'Minnesota' },
    { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' },
    { code: 'MT', name: 'Montana' },
    { code: 'NE', name: 'Nebraska' },
    { code: 'NV', name: 'Nevada' },
    { code: 'NH', name: 'New Hampshire' },
    { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' },
    { code: 'NY', name: 'New York' },
    { code: 'NC', name: 'North Carolina' },
    { code: 'ND', name: 'North Dakota' },
    { code: 'OH', name: 'Ohio' },
    { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' },
    { code: 'PA', name: 'Pennsylvania' },
    { code: 'RI', name: 'Rhode Island' },
    { code: 'SC', name: 'South Carolina' },
    { code: 'SD', name: 'South Dakota' },
    { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' },
    { code: 'UT', name: 'Utah' },
    { code: 'VT', name: 'Vermont' },
    { code: 'VA', name: 'Virginia' },
    { code: 'WA', name: 'Washington' },
    { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' },
    { code: 'WY', name: 'Wyoming' },
    { code: 'DC', name: 'District of Columbia' },
  ],
  // Add more countries as needed:
  // CA: [
  //   { code: 'AB', name: 'Alberta' },
  //   { code: 'BC', name: 'British Columbia' },
  //   // ... more provinces
  // ],
};

export interface CitySuggestion {
  state: string;
  name: string;
}

export const CITY_SUGGESTIONS_US: CitySuggestion[] = [
  { state: 'AL', name: 'Birmingham' },
  { state: 'AK', name: 'Anchorage' },
  { state: 'AZ', name: 'Phoenix' },
  { state: 'AZ', name: 'Scottsdale' },
  { state: 'CA', name: 'Los Angeles' },
  { state: 'CA', name: 'San Diego' },
  { state: 'CA', name: 'San Francisco' },
  { state: 'CA', name: 'San Jose' },
  { state: 'CO', name: 'Denver' },
  { state: 'CT', name: 'Hartford' },
  { state: 'DC', name: 'Washington' },
  { state: 'FL', name: 'Miami' },
  { state: 'FL', name: 'Orlando' },
  { state: 'FL', name: 'Tampa' },
  { state: 'GA', name: 'Atlanta' },
  { state: 'IL', name: 'Chicago' },
  { state: 'MA', name: 'Boston' },
  { state: 'MI', name: 'Detroit' },
  { state: 'MN', name: 'Minneapolis' },
  { state: 'MO', name: 'St. Louis' },
  { state: 'NC', name: 'Charlotte' },
  { state: 'NC', name: 'Raleigh' },
  { state: 'NJ', name: 'Newark' },
  { state: 'NV', name: 'Las Vegas' },
  { state: 'NY', name: 'New York' },
  { state: 'NY', name: 'Buffalo' },
  { state: 'OH', name: 'Columbus' },
  { state: 'OR', name: 'Portland' },
  { state: 'PA', name: 'Philadelphia' },
  { state: 'PA', name: 'Pittsburgh' },
  { state: 'TN', name: 'Nashville' },
  { state: 'TX', name: 'Austin' },
  { state: 'TX', name: 'Dallas' },
  { state: 'TX', name: 'Houston' },
  { state: 'UT', name: 'Salt Lake City' },
  { state: 'WA', name: 'Seattle' },
  { state: 'WI', name: 'Milwaukee' },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all available countries
 */
export const getCountries = (): Country[] => {
  return COUNTRIES;
};

/**
 * Get states/provinces for a specific country
 */
export const getStatesByCountry = (countryCode: string): State[] => {
  return STATES_BY_COUNTRY[countryCode] || [];
};

/**
 * Get country name by code
 */
export const getCountryName = (countryCode: string): string | null => {
  const country = COUNTRIES.find(c => c.code === countryCode);
  return country ? country.name : null;
};

/**
 * Get state name by code and country
 */
export const getStateName = (countryCode: string, stateCode: string): string | null => {
  const states = getStatesByCountry(countryCode);
  const state = states.find(s => s.code === stateCode);
  return state ? state.name : null;
};

/**
 * Get full location string (for display)
 * Format: "City, State, Country" or "Street Address, City, State, Country"
 */
export const formatLocation = (data: {
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}): string => {
  const parts: string[] = [];

  if (data.street_address) {
    parts.push(data.street_address);
  }

  if (data.city) {
    parts.push(data.city);
  }

  if (data.state && data.country) {
    const stateName = getStateName(data.country, data.state);
    if (stateName) {
      parts.push(stateName);
    } else {
      parts.push(data.state);
    }
  } else if (data.state) {
    parts.push(data.state);
  }

  if (data.country) {
    const countryName = getCountryName(data.country);
    if (countryName) {
      parts.push(countryName);
    } else {
      parts.push(data.country);
    }
  }

  return parts.join(', ') || 'Location not specified';
};

/**
 * Validate if a country code exists
 */
export const isValidCountry = (countryCode: string): boolean => {
  return COUNTRIES.some(c => c.code === countryCode);
};

/**
 * Validate if a state code exists for a country
 */
export const isValidState = (countryCode: string, stateCode: string): boolean => {
  const states = getStatesByCountry(countryCode);
  return states.some(s => s.code === stateCode);
};

export const getCitySuggestions = (
  countryCode: string,
  stateCode?: string,
  query?: string
): CitySuggestion[] => {
  if (countryCode !== 'US') return [];
  let suggestions = CITY_SUGGESTIONS_US;
  if (stateCode) {
    suggestions = suggestions.filter(city => city.state === stateCode);
  }
  if (query && query.trim()) {
    suggestions = suggestions.filter(city =>
      city.name.toLowerCase().includes(query.trim().toLowerCase())
    );
  }
  return suggestions.slice(0, 8);
};
