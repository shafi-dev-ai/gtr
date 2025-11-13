# Folder Structure

## Overview
Future-proof folder structure for GT-R marketplace iOS app.

## Root Structure

```
gtr/
├── App.js                    # Main app entry
├── app.json                  # Expo config
├── package.json
├── index.js
├── assets/                   # Static assets
│   ├── images/
│   ├── fonts/
│   └── icons/
├── src/
│   ├── components/          # Reusable components
│   ├── screens/            # Screen components
│   ├── navigation/          # Navigation setup
│   ├── services/           # API & business logic
│   ├── hooks/              # Custom React hooks
│   ├── context/            # React Context providers
│   ├── types/              # TypeScript types
│   ├── theme/              # Design system
│   ├── utils/              # Helper functions
│   └── constants/          # App constants
└── docs/                    # Documentation
```

## Detailed Structure

### `/src/components/`
```
components/
├── common/                  # Shared UI components
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Card.tsx
│   ├── LoadingSpinner.tsx
│   ├── ErrorMessage.tsx
│   └── Image.tsx
├── auth/                    # Auth-specific components
│   ├── LoginForm.tsx
│   ├── RegisterForm.tsx
│   └── PhoneVerification.tsx
├── marketplace/            # Marketplace components
│   ├── ListingCard.tsx
│   ├── ListingForm.tsx
│   ├── ImagePicker.tsx
│   └── SearchBar.tsx
└── profile/                 # Profile components
    ├── ProfileHeader.tsx
    └── ProfileEditForm.tsx
```

### `/src/screens/`
```
screens/
├── auth/
│   ├── WelcomeScreen.tsx      # First screen for non-logged users
│   ├── LoginScreen.tsx
│   ├── RegisterScreen.tsx
│   └── PasswordResetScreen.tsx
├── app/
│   ├── LoadingScreen.tsx       # App loading/initialization
│   └── DashboardScreen.tsx    # Main dashboard after login
├── marketplace/
│   ├── ListingsFeedScreen.tsx
│   ├── ListingDetailScreen.tsx
│   ├── CreateListingScreen.tsx
│   └── SearchScreen.tsx
└── profile/
    ├── ProfileScreen.tsx
    ├── ProfileEditScreen.tsx
    └── SettingsScreen.tsx
```

### `/src/navigation/`
```
navigation/
├── AppNavigator.tsx          # Root navigator
├── AuthNavigator.tsx         # Auth flow navigation
├── MainNavigator.tsx         # Main app navigation (tabs)
└── types.ts                  # Navigation type definitions
```

### `/src/services/`
```
services/
├── supabase.ts              # Supabase client
├── auth.ts                  # Auth service
├── listings.ts              # Listings API
├── profiles.ts              # Profile API
└── storage.ts               # Image/file upload
```

### `/src/hooks/`
```
hooks/
├── useAuth.ts               # Auth state hook
├── useListings.ts           # Listings data hook
├── useProfile.ts            # Profile data hook
└── useImagePicker.ts        # Image picker hook
```

### `/src/context/`
```
context/
├── AuthContext.tsx          # Auth state context
└── ThemeContext.tsx         # Theme context
```

### `/src/types/`
```
types/
├── database.types.ts        # Supabase generated types
├── listing.types.ts         # Listing types
├── user.types.ts            # User/profile types
└── navigation.types.ts      # Navigation types
```

### `/src/theme/`
```
theme/
├── colors.ts                # Color palette
├── typography.ts            # Font styles
├── spacing.ts               # Spacing scale
└── index.ts                 # Theme exports
```

### `/src/utils/`
```
utils/
├── formatters.ts            # Date, price, etc formatters
├── validators.ts            # Form validation helpers
├── storage.ts               # AsyncStorage helpers
└── helpers.ts               # General utilities
```

### `/src/constants/`
```
constants/
├── config.ts                # App config
├── modelYears.ts            # GT-R model constants
└── routes.ts                # Route names
```

## Future Additions

When adding new features, follow this pattern:

- **New feature screens** → `/src/screens/[feature]/`
- **Feature components** → `/src/components/[feature]/`
- **Feature services** → `/src/services/[feature].ts`
- **Feature hooks** → `/src/hooks/use[Feature].ts`
- **Feature types** → `/src/types/[feature].types.ts`

Examples:
- Forum → `screens/forum/`, `components/forum/`, `services/forum.ts`
- Events → `screens/events/`, `components/events/`, `services/events.ts`
- Messages → `screens/messages/`, `components/messages/`, `services/messages.ts`

## Notes

- Keep components small and focused
- Use TypeScript for type safety
- Group related files by feature
- Keep common/shared code in `/common/` folders
- Services handle all API calls
- Hooks manage component state and side effects

