# Days 1-3 Setup Guide: Marketplace Basics (Option A)

This guide covers setting up your Expo iOS app for Days 1-3, focusing on Marketplace Basics functionality.

## Table of Contents

1. [Project Initialization](#project-initialization)
2. [Dependencies Installation](#dependencies-installation)
3. [Project Structure](#project-structure)
4. [Authentication Setup](#authentication-setup)
5. [Navigation Structure](#navigation-structure)
6. [Design System & Theme](#design-system--theme)
7. [Marketplace Features](#marketplace-features)
8. [Testing Checklist](#testing-checklist)

---

## Project Initialization

### Step 1: Create Expo Project

```bash
# Install Expo CLI globally (if not already installed)
npm install -g expo-cli

# Create new Expo project
npx create-expo-app gtr-marketplace --template blank-typescript

# Navigate to project
cd gtr-marketplace
```

### Step 2: Initialize Git Repository

```bash
git init
git add .
git commit -m "Initial commit: Expo project setup"
```

### Step 3: Create Environment File

Create `.env` file in project root:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

Create `.env.example`:

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Add `.env` to `.gitignore`:

```
.env
node_modules/
.expo/
dist/
```

---

## Dependencies Installation

### Core Dependencies

```bash
# Supabase client
npm install @supabase/supabase-js

# Navigation
npm install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack
npx expo install react-native-screens react-native-safe-area-context

# Image handling
npx expo install expo-image-picker expo-image-manipulator

# Forms & validation
npm install react-hook-form @hookform/resolvers zod

# UI Components
npm install react-native-paper  # Material Design components
# OR
npm install native-base  # Alternative UI library
# OR use custom components (recommended for GT-R branding)

# Icons
npm install @expo/vector-icons

# Async storage (for caching)
npx expo install @react-native-async-storage/async-storage

# Date handling
npm install date-fns

# Environment variables
npm install react-native-dotenv
```

### Development Dependencies

```bash
# TypeScript types
npm install --save-dev @types/react @types/react-native

# Linting & formatting
npm install --save-dev eslint prettier @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

---

## Project Structure

Create the following folder structure:

```
gtr-marketplace/
├── .env
├── .env.example
├── .gitignore
├── app.json
├── package.json
├── tsconfig.json
├── App.tsx
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   └── ErrorMessage.tsx
│   │   ├── marketplace/
│   │   │   ├── ListingCard.tsx
│   │   │   ├── ListingForm.tsx
│   │   │   └── ImagePicker.tsx
│   │   └── auth/
│   │       ├── LoginForm.tsx
│   │       ├── SignupForm.tsx
│   │       └── PasswordResetForm.tsx
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── SignupScreen.tsx
│   │   │   └── PasswordResetScreen.tsx
│   │   ├── marketplace/
│   │   │   ├── ListingsFeedScreen.tsx
│   │   │   ├── ListingDetailScreen.tsx
│   │   │   └── CreateListingScreen.tsx
│   │   └── profile/
│   │       └── ProfileScreen.tsx
│   ├── navigation/
│   │   ├── AppNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   └── MainNavigator.tsx
│   ├── services/
│   │   ├── supabase.ts
│   │   ├── auth.ts
│   │   └── listings.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useListings.ts
│   │   └── useImagePicker.ts
│   ├── types/
│   │   ├── database.types.ts
│   │   ├── listing.types.ts
│   │   └── user.types.ts
│   ├── theme/
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   ├── spacing.ts
│   │   └── index.ts
│   ├── utils/
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   └── storage.ts
│   └── constants/
│       ├── config.ts
│       └── modelYears.ts
└── assets/
    ├── images/
    └── fonts/
```

---

## Authentication Setup

### Step 1: Configure Supabase Client

Create `src/services/supabase.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

const supabaseUrl =
  Constants.expoConfig?.extra?.supabaseUrl ||
  process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### Step 2: Create Auth Service

Create `src/services/auth.ts`:

```typescript
import { supabase } from "./supabase";
import { Session, User } from "@supabase/supabase-js";

export interface SignupData {
  email: string;
  password: string;
  fullName?: string;
  username?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export const authService = {
  async signUp(data: SignupData) {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          username: data.username,
        },
      },
    });
    return { data: authData, error };
  },

  async signIn(data: LoginData) {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    return { data: authData, error };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  async resetPassword(email: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "gtr-marketplace://reset-password",
    });
    return { data, error };
  },

  async getSession(): Promise<Session | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  },

  async getUser(): Promise<User | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  },

  onAuthStateChange(callback: (session: Session | null) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
  },
};
```

### Step 3: Create Auth Hook

Create `src/hooks/useAuth.ts`:

```typescript
import { useState, useEffect } from "react";
import { Session, User } from "@supabase/supabase-js";
import { authService } from "../services/auth";

export const useAuth = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    authService.getSession().then((session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = authService.onAuthStateChange((session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    user,
    loading,
    isAuthenticated: !!session,
  };
};
```

### Step 4: Create Auth Screens

You'll need to create:

- `src/screens/auth/LoginScreen.tsx`
- `src/screens/auth/SignupScreen.tsx`
- `src/screens/auth/PasswordResetScreen.tsx`

These screens should include:

- Form validation using react-hook-form and zod
- Error handling and display
- Loading states
- Navigation to other auth screens
- Proper error messages for common issues (wrong password, email not confirmed, etc.)

---

## Navigation Structure

### Step 1: Install Navigation Dependencies

Already covered in dependencies section.

### Step 2: Create Navigation Structure

Create `src/navigation/AppNavigator.tsx`:

```typescript
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { useAuth } from "../hooks/useAuth";
import { AuthNavigator } from "./AuthNavigator";
import { MainNavigator } from "./MainNavigator";
import { LoadingSpinner } from "../components/common/LoadingSpinner";

export const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};
```

Create `src/navigation/AuthNavigator.tsx`:

```typescript
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { SignupScreen } from "../screens/auth/SignupScreen";
import { PasswordResetScreen } from "../screens/auth/PasswordResetScreen";

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  PasswordReset: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName="Login"
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="PasswordReset" component={PasswordResetScreen} />
    </Stack.Navigator>
  );
};
```

Create `src/navigation/MainNavigator.tsx`:

```typescript
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

// Screens
import { ListingsFeedScreen } from "../screens/marketplace/ListingsFeedScreen";
import { ListingDetailScreen } from "../screens/marketplace/ListingDetailScreen";
import { CreateListingScreen } from "../screens/marketplace/CreateListingScreen";
import { ProfileScreen } from "../screens/profile/ProfileScreen";

export type MainTabParamList = {
  Marketplace: undefined;
  Profile: undefined;
};

export type MarketplaceStackParamList = {
  Feed: undefined;
  Detail: { listingId: string };
  Create: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const MarketplaceStack =
  createNativeStackNavigator<MarketplaceStackParamList>();

const MarketplaceNavigator = () => {
  return (
    <MarketplaceStack.Navigator>
      <MarketplaceStack.Screen
        name="Feed"
        component={ListingsFeedScreen}
        options={{ title: "GT-R Marketplace" }}
      />
      <MarketplaceStack.Screen
        name="Detail"
        component={ListingDetailScreen}
        options={{ title: "Listing Details" }}
      />
      <MarketplaceStack.Screen
        name="Create"
        component={CreateListingScreen}
        options={{ title: "Post Your GT-R" }}
      />
    </MarketplaceStack.Navigator>
  );
};

export const MainNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Marketplace"
        component={MarketplaceNavigator}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="car-sport" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};
```

---

## Design System & Theme

### Step 1: Create Theme Files

Create `src/theme/colors.ts`:

```typescript
// GT-R Brand Colors: Aggressive, performance-focused
// Dark theme with black/red accents

export const colors = {
  // Primary colors (GT-R Red)
  primary: "#DC143C", // Crimson Red
  primaryDark: "#B71C1C",
  primaryLight: "#FF5252",

  // Background colors
  background: "#000000", // Pure black
  backgroundSecondary: "#0A0A0A", // Slightly lighter black
  backgroundTertiary: "#1A1A1A",

  // Text colors
  text: "#FFFFFF",
  textSecondary: "#B0B0B0",
  textTertiary: "#808080",

  // Accent colors
  accent: "#FFD700", // Gold for highlights
  success: "#00FF00",
  warning: "#FFA500",
  error: "#FF0000",

  // Border colors
  border: "#333333",
  borderLight: "#1A1A1A",

  // Overlay
  overlay: "rgba(0, 0, 0, 0.8)",

  // Card colors
  cardBackground: "#0F0F0F",
  cardBorder: "#2A2A2A",
};
```

Create `src/theme/typography.ts`:

```typescript
export const typography = {
  // Headings - Bold, aggressive
  h1: {
    fontSize: 32,
    fontWeight: "900" as const,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 24,
    fontWeight: "800" as const,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 20,
    fontWeight: "700" as const,
    letterSpacing: -0.2,
  },
  h4: {
    fontSize: 18,
    fontWeight: "700" as const,
  },

  // Body text
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: "400" as const,
    lineHeight: 20,
  },

  // Special
  price: {
    fontSize: 24,
    fontWeight: "900" as const,
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 12,
    fontWeight: "600" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  },
};
```

Create `src/theme/spacing.ts`:

```typescript
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
```

Create `src/theme/index.ts`:

```typescript
export { colors } from "./colors";
export { typography } from "./typography";
export { spacing } from "./spacing";
```

### Step 2: Create Common UI Components

Create `src/components/common/Button.tsx`:

- Primary button with GT-R red
- Secondary button variant
- Loading state
- Disabled state
- Sharp, angular design

Create `src/components/common/Input.tsx`:

- Text input with GT-R styling
- Error state display
- Label support
- Dark theme styling

Create `src/components/common/Card.tsx`:

- Card component for listings
- Dark background with subtle border
- Shadow effects

Create `src/components/common/LoadingSpinner.tsx`:

- Loading indicator with GT-R theme

Create `src/components/common/ErrorMessage.tsx`:

- Error message display component

---

## Marketplace Features

### Step 1: Create Types

Create `src/types/listing.types.ts`:

```typescript
export type ModelYear = "R32" | "R33" | "R34" | "R35" | "R36";

export type Condition = "excellent" | "good" | "fair" | "needs_work";

export type Transmission = "manual" | "automatic" | "dct";

export type ListingStatus = "active" | "sold" | "pending" | "draft";

export interface Listing {
  id: string;
  user_id: string;
  title: string;
  model: ModelYear;
  year: number;
  price: number;
  mileage?: number;
  description?: string;
  condition?: Condition;
  city?: string;
  state?: string;
  zip_code?: string;
  location?: string; // Full address or general location (kept for backward compatibility)
  vin?: string;
  color?: string;
  transmission?: Transmission;
  status: ListingStatus;
  created_at: string;
  updated_at: string;
  sold_at?: string;
}

export interface ListingImage {
  id: string;
  listing_id: string;
  image_url: string;
  storage_path: string;
  is_primary: boolean;
  display_order: number;
}

export interface ListingWithImages extends Listing {
  images: ListingImage[];
  user?: {
    username?: string;
    avatar_url?: string;
  };
}

export interface CreateListingData {
  title: string;
  model: ModelYear;
  year: number;
  price: number;
  mileage?: number;
  description?: string;
  condition?: Condition;
  city?: string;
  state?: string;
  zip_code?: string;
  location?: string; // Full address or general location
  vin?: string;
  color?: string;
  transmission?: Transmission;
  images: string[]; // Array of image URIs
}
```

Create `src/constants/modelYears.ts`:

```typescript
export const MODEL_YEARS = ["R32", "R33", "R34", "R35", "R36"] as const;

export const MODEL_YEAR_INFO = {
  R32: { years: "1989-1994", name: "Skyline GT-R R32" },
  R33: { years: "1995-1998", name: "Skyline GT-R R33" },
  R34: { years: "1999-2002", name: "Skyline GT-R R34" },
  R35: { years: "2007-present", name: "Nissan GT-R R35" },
  R36: { years: "TBA", name: "Nissan GT-R R36" },
};
```

### Step 2: Create Listings Service

Create `src/services/listings.ts`:

```typescript
import { supabase } from "./supabase";
import {
  Listing,
  ListingWithImages,
  CreateListingData,
} from "../types/listing.types";

export const listingsService = {
  async getAllListings(): Promise<ListingWithImages[]> {
    const { data, error } = await supabase
      .from("listings")
      .select(
        `
        *,
        listing_images (*),
        profiles:user_id (
          username,
          avatar_url
        )
      `
      )
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getListingById(id: string): Promise<ListingWithImages | null> {
    const { data, error } = await supabase
      .from("listings")
      .select(
        `
        *,
        listing_images (*),
        profiles:user_id (
          username,
          avatar_url
        )
      `
      )
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  async createListing(listingData: CreateListingData): Promise<Listing> {
    // First, create the listing
    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .insert({
        title: listingData.title,
        model: listingData.model,
        year: listingData.year,
        price: listingData.price,
        mileage: listingData.mileage,
        description: listingData.description,
        condition: listingData.condition,
        city: listingData.city,
        state: listingData.state,
        zip_code: listingData.zip_code,
        location: listingData.location,
        vin: listingData.vin,
        color: listingData.color,
        transmission: listingData.transmission,
        status: "active",
      })
      .select()
      .single();

    if (listingError) throw listingError;
    if (!listing) throw new Error("Failed to create listing");

    // Then, upload images and create image records
    // This will be handled in the CreateListingScreen

    return listing;
  },

  async getUserListings(userId: string): Promise<ListingWithImages[]> {
    const { data, error } = await supabase
      .from("listings")
      .select(
        `
        *,
        listing_images (*)
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  },
};
```

### Step 2.5: Create Search Service (Optional - for future search functionality)

Create `src/services/search.ts`:

```typescript
import { supabase } from "./supabase";
import { ListingWithImages } from "../types/listing.types";

export interface SearchFilters {
  searchText?: string; // Full-text search query
  model?: string;
  yearMin?: number;
  yearMax?: number;
  priceMin?: number;
  priceMax?: number;
  city?: string;
  state?: string;
  condition?: string;
  transmission?: string;
  limit?: number;
  offset?: number;
}

export const searchService = {
  // Using the search_listings function from backend
  async searchListings(filters: SearchFilters): Promise<ListingWithImages[]> {
    const { data, error } = await supabase.rpc("search_listings", {
      search_query: filters.searchText || null,
      model_filter: filters.model || null,
      year_min: filters.yearMin || null,
      year_max: filters.yearMax || null,
      price_min: filters.priceMin || null,
      price_max: filters.priceMax || null,
      city_filter: filters.city || null,
      state_filter: filters.state || null,
      condition_filter: filters.condition || null,
      transmission_filter: filters.transmission || null,
      limit_count: filters.limit || 50,
      offset_count: filters.offset || 0,
    });

    if (error) throw error;
    return data || [];
  },

  // Alternative: Direct query approach (more flexible)
  async searchListingsDirect(
    filters: SearchFilters
  ): Promise<ListingWithImages[]> {
    let query = supabase
      .from("listings")
      .select(
        `
        *,
        listing_images (*),
        profiles:user_id (
          username,
          avatar_url
        )
      `
      )
      .eq("status", "active");

    // Full-text search
    if (filters.searchText) {
      query = query.textSearch("search_vector", filters.searchText, {
        type: "plain",
        config: "english",
      });
    }

    // Model filter
    if (filters.model) {
      query = query.eq("model", filters.model);
    }

    // Year range
    if (filters.yearMin) {
      query = query.gte("year", filters.yearMin);
    }
    if (filters.yearMax) {
      query = query.lte("year", filters.yearMax);
    }

    // Price range
    if (filters.priceMin) {
      query = query.gte("price", filters.priceMin);
    }
    if (filters.priceMax) {
      query = query.lte("price", filters.priceMax);
    }

    // Location filters
    if (filters.city) {
      query = query.ilike("city", `%${filters.city}%`);
    }
    if (filters.state) {
      query = query.ilike("state", `%${filters.state}%`);
    }

    // Condition filter
    if (filters.condition) {
      query = query.eq("condition", filters.condition);
    }

    // Transmission filter
    if (filters.transmission) {
      query = query.eq("transmission", filters.transmission);
    }

    // Pagination
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    query = query.range(offset, offset + limit - 1);

    // Order by
    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },
};
```

**Note**: Search functionality can be added later. For Days 1-3, focus on basic listing creation and display. The search service above is ready to use when you want to implement search features.

### Step 3: Create Image Upload Utility

Create `src/utils/storage.ts`:

```typescript
import { supabase } from "../services/supabase";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

export const imageService = {
  async pickImage(): Promise<string | null> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      throw new Error("Permission to access media library is required");
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0].uri;
  },

  async compressImage(uri: string): Promise<string> {
    const manipulatedImage = await manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: SaveFormat.JPEG }
    );
    return manipulatedImage.uri;
  },

  async uploadListingImage(
    listingId: string,
    imageUri: string,
    userId: string,
    isPrimary: boolean = false
  ): Promise<string> {
    // Compress image first
    const compressedUri = await this.compressImage(imageUri);

    // Convert to blob
    const response = await fetch(compressedUri);
    const blob = await response.blob();

    // Generate unique filename
    const fileExt = compressedUri.split(".").pop();
    const fileName = `${listingId}/${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("listing-images")
      .upload(filePath, blob, {
        contentType: `image/${fileExt}`,
      });

    if (error) throw error;

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("listing-images").getPublicUrl(filePath);

    // Create image record in database
    const { error: dbError } = await supabase.from("listing_images").insert({
      listing_id: listingId,
      image_url: publicUrl,
      storage_path: filePath,
      is_primary: isPrimary,
    });

    if (dbError) throw dbError;

    return publicUrl;
  },
};
```

### Step 4: Create Marketplace Screens

#### ListingsFeedScreen (`src/screens/marketplace/ListingsFeedScreen.tsx`)

Features to implement:

- Fetch all active listings using `listingsService.getAllListings()`
- Display listings in a scrollable list/grid
- Use `ListingCard` component for each listing
- Show loading state while fetching
- Show error state if fetch fails
- Pull-to-refresh functionality
- Navigate to detail screen on card tap
- Floating action button to create new listing

#### ListingDetailScreen (`src/screens/marketplace/ListingDetailScreen.tsx`)

Features to implement:

- Fetch listing by ID
- Display all listing images in carousel/swiper
- Show listing details (price, model, year, mileage, etc.)
- Show seller information
- Contact seller button (future feature)
- Share listing button
- Loading and error states

#### CreateListingScreen (`src/screens/marketplace/CreateListingScreen.tsx`)

Features to implement:

- Form with fields:
  - Title (required)
  - Model dropdown (R32-R36)
  - Year (number input)
  - Price (number input)
  - Mileage (optional number input)
  - Description (text area)
  - Condition dropdown
  - City (text input, for search)
  - State (text input or dropdown, for search)
  - Zip Code (optional text input)
  - Location (optional text input - full address or general location)
  - VIN (optional text input)
  - Color (text input)
  - Transmission dropdown
- Image picker component (multiple images)
- Primary image selection
- Form validation using react-hook-form and zod
- Submit button that:
  1. Creates listing
  2. Uploads images
  3. Creates image records
  4. Navigates back to feed
- Loading state during submission
- Error handling

### Step 5: Create Marketplace Components

#### ListingCard (`src/components/marketplace/ListingCard.tsx`)

Features to implement:

- Display primary image
- Show price prominently (GT-R styling)
- Show model year and year
- Show location
- Show mileage
- Show condition badge
- Tap to navigate to detail screen
- Card styling with GT-R theme

#### ListingForm (`src/components/marketplace/ListingForm.tsx`)

Features to implement:

- Reusable form component
- All form fields
- Validation
- Error display
- Submit handler

#### ImagePicker (`src/components/marketplace/ImagePicker.tsx`)

Features to implement:

- Button to pick images
- Display selected images in grid
- Remove image functionality
- Set primary image
- Image preview
- Maximum image limit (e.g., 10 images)

---

## Testing Checklist

### Authentication

- [ ] User can sign up with email/password
- [ ] User receives confirmation email (if enabled)
- [ ] User can log in
- [ ] User can reset password
- [ ] User stays logged in after app restart
- [ ] User can log out
- [ ] Error messages display correctly

### Navigation

- [ ] Unauthenticated users see auth screens
- [ ] Authenticated users see main tabs
- [ ] Bottom tabs navigate correctly
- [ ] Stack navigation works (feed → detail → back)
- [ ] Create listing screen accessible

### Marketplace - Listings Feed

- [ ] Listings load on screen open
- [ ] Listings display correctly in cards
- [ ] Pull-to-refresh works
- [ ] Loading state shows while fetching
- [ ] Error state shows on failure
- [ ] Tapping card navigates to detail

### Marketplace - Listing Detail

- [ ] Listing details load correctly
- [ ] Images display in carousel
- [ ] All listing information shows
- [ ] Seller info displays
- [ ] Loading state shows
- [ ] Error handling works

### Marketplace - Create Listing

- [ ] Form fields work correctly
- [ ] Validation works (required fields, number formats)
- [ ] Image picker opens and selects images
- [ ] Images display in preview
- [ ] Can remove images
- [ ] Can set primary image
- [ ] Form submission creates listing
- [ ] Images upload successfully
- [ ] Navigation back to feed after success
- [ ] Error handling works

### Design & Theme

- [ ] GT-R colors applied throughout
- [ ] Dark theme consistent
- [ ] Typography matches design system
- [ ] Spacing consistent
- [ ] Buttons styled correctly
- [ ] Cards styled correctly

---

## Next Steps After Days 1-3

Once Days 1-3 are complete, you can move on to:

- Days 5-6: Profile & Polish
- Option B: Community Feed
- Additional marketplace features (search, filters)
- Integration with external APIs (Cars.com, Autotrader)

---

## Development Tips

1. **Test on Real Device**: Use Expo Go app or build for iOS simulator
2. **Error Handling**: Always handle errors gracefully with user-friendly messages
3. **Loading States**: Show loading indicators for all async operations
4. **Image Optimization**: Compress images before uploading to save storage
5. **Form Validation**: Validate on both client and server side
6. **Type Safety**: Use TypeScript types throughout
7. **Code Organization**: Keep components small and focused
8. **Performance**: Use React.memo for expensive components
9. **Accessibility**: Add accessibility labels to interactive elements

---

## Common Issues & Solutions

### Issue: Supabase connection fails

- Check environment variables are set correctly
- Verify Supabase URL and keys are correct
- Check network connectivity

### Issue: Images not uploading

- Verify storage bucket exists and is public
- Check RLS policies on storage bucket
- Verify file size is within limits

### Issue: RLS policy blocking queries

- Check user is authenticated
- Verify RLS policies are set correctly
- Test policies in Supabase dashboard

### Issue: Navigation not working

- Verify navigation dependencies installed
- Check screen names match exactly
- Ensure NavigationContainer wraps app

---

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript/introduction)
- [React Hook Form](https://react-hook-form.com/)
- [Zod Validation](https://zod.dev/)
