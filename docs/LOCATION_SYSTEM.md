# Location System Implementation Plan

## Overview

This document outlines the strategy for implementing a location-based system that uses device GPS location as the primary source and profile location as a fallback. This ensures accurate "nearby" listings and events while maintaining good performance and user experience.

---

## Strategy: Device Location Primary, Profile Location Fallback

### Priority Order

1. **Device GPS Location** (Primary)
   - Current, accurate location
   - Best for "nearby" features
   - Works automatically when traveling

2. **Profile Location** (Fallback)
   - Used when GPS unavailable
   - Used when permission denied
   - Used when GPS times out

3. **Default/All** (Last Resort)
   - Show all listings/events
   - When both location sources unavailable

---

## Why Device Location as Primary?

### Advantages

1. **Always Current**
   - Reflects where user is RIGHT NOW
   - No manual updates needed
   - Works automatically when traveling

2. **More Accurate "Nearby" Results**
   - Shows what's actually nearby
   - Better distance calculations
   - More relevant listings/events

3. **Better User Experience**
   - No need to update profile when moving
   - Works for users who travel frequently
   - Dynamic and responsive

4. **Real-World Use Cases**
   - User in NYC temporarily → sees NYC listings/events
   - User traveling for car show → sees nearby events
   - User moved but didn't update profile → still gets accurate results

### When Profile Location is Used (Fallback)

1. **Location Permission Denied**
   - User didn't grant permission
   - Use profile location instead

2. **GPS Unavailable**
   - No GPS signal (indoors, tunnels)
   - Device GPS disabled
   - Airplane mode

3. **Battery Saving Mode**
   - Location services disabled
   - Use cached or profile location

4. **User Preference**
   - Option to "Use my home location instead"
   - User wants to see listings from home location

5. **Offline Mode**
   - No internet connection
   - Use profile location

---

## Performance Considerations

### Potential Impact

#### GPS Location Timing
- **First Fix (Cold Start)**: 2-5 seconds
- **Subsequent Fixes (Warm Start)**: 0.5-2 seconds
- **Can Block UI** if we wait for it

#### Without Optimization
```
User opens app → Request GPS → Wait 2-5 seconds → Get location → Fetch listings
```
**Result**: 2-5 second delay before showing data ❌

#### With Optimization
```
User opens app → Show cached data immediately → Get GPS in background → Update when ready
```
**Result**: No perceived delay ✅

---

## Optimization Strategies

### 1. Non-Blocking Approach (Recommended)

**Strategy**: Show cached data immediately, fetch GPS in background

**Flow**:
```
1. User opens app
2. Show cached listings/events immediately (if available)
3. Request GPS location in background (non-blocking)
4. Update results when GPS location is available
```

**Benefits**:
- ✅ No perceived delay
- ✅ Instant results
- ✅ Smooth user experience
- ✅ Data updates automatically when location ready

**Implementation**:
- Use `useDataFetch` with `staleWhileRevalidate: true`
- Fetch GPS location with low priority
- Update cache when location is ready

---

### 2. Cache Last Known Location

**Strategy**: Store last GPS location with timestamp

**Flow**:
```
1. Check if cached location exists and is recent (< 5 minutes)
2. If yes → Use cached location immediately (instant)
3. If no → Request new GPS location
4. Update cache when new location received
```

**Benefits**:
- ✅ Instant results if location is cached
- ✅ Reduces GPS requests
- ✅ Better battery life
- ✅ Works offline

**Storage**:
- Store in `AsyncStorage` or `DataManager` cache
- Key: `location:device:last`
- Include: `{ latitude, longitude, timestamp, accuracy }`
- TTL: 5 minutes (consider fresh if < 5 min old)

---

### 3. Parallel Fetching

**Strategy**: Don't wait for GPS to start fetching data

**Flow**:
```
1. Start GPS request (async)
2. Start fetching listings with default radius (async)
3. When GPS ready → Refine results with accurate location
4. When listings ready → Show initial results
```

**Benefits**:
- ✅ Don't block on GPS
- ✅ Show data faster
- ✅ Refine results when location ready

**Implementation**:
- Use `Promise.all()` or parallel `useDataFetch` calls
- Fetch listings with default/wide radius first
- Refine when GPS location available

---

### 4. Timeout and Fallback

**Strategy**: Don't wait too long for GPS

**Flow**:
```
1. Request GPS location
2. Set timeout (2 seconds)
3. If timeout → Use profile location immediately
4. If GPS ready before timeout → Use GPS location
```

**Benefits**:
- ✅ Prevents long delays
- ✅ Graceful fallback
- ✅ Better UX

**Implementation**:
```typescript
const getLocationWithTimeout = async (timeout = 2000) => {
  return Promise.race([
    getCurrentPosition(),
    new Promise((resolve) => 
      setTimeout(() => resolve(null), timeout)
    )
  ]);
};
```

---

### 5. Optimistic Loading

**Strategy**: Start with profile location, upgrade to GPS

**Flow**:
```
1. Show listings with profile location (instant)
2. Request GPS location in background
3. When GPS ready → Update results
4. Smooth transition
```

**Benefits**:
- ✅ Instant results
- ✅ Better accuracy when GPS ready
- ✅ Smooth upgrade

---

## Recommended Implementation Approach

### Hybrid Strategy (Best Performance)

Combine multiple optimization strategies:

#### Step 1: Check Cache
```typescript
// Check if cached GPS location exists and is recent
const cachedLocation = getCachedLocation();
if (cachedLocation && isRecent(cachedLocation, 5 * 60 * 1000)) {
  // Use cached location immediately
  return cachedLocation;
}
```

#### Step 2: Show Cached Data
```typescript
// Show cached listings/events immediately
const { data: listings } = useDataFetch({
  cacheKey: 'listings:nearby',
  fetchFn: () => fetchListings(cachedLocation || profileLocation),
  staleWhileRevalidate: true,
});
```

#### Step 3: Request GPS (Non-Blocking)
```typescript
// Request GPS location in background
const requestGPSLocation = async () => {
  try {
    const location = await getLocationWithTimeout(2000);
    if (location) {
      // Update cache
      cacheLocation(location);
      // Refresh listings with new location
      refreshListings(location);
    } else {
      // Timeout - use profile location
      useProfileLocation();
    }
  } catch (error) {
    // Permission denied or error - use profile location
    useProfileLocation();
  }
};

// Call in background (don't await)
requestGPSLocation();
```

#### Step 4: Update When Ready
```typescript
// When GPS location is ready, update results
useEffect(() => {
  if (gpsLocation) {
    // Invalidate cache and refresh
    dataManager.invalidateCache('listings:nearby');
    refreshListings(gpsLocation);
  }
}, [gpsLocation]);
```

---

## Performance Impact Summary

### With Optimization
- **Delay**: 0-0.5 seconds (using cached location)
- **Perceived Delay**: Minimal (showing cached data immediately)
- **User Experience**: Smooth, instant results

### Without Optimization
- **Delay**: 2-5 seconds (waiting for GPS)
- **Perceived Delay**: Noticeable, blocking
- **User Experience**: Slow, frustrating

---

## Implementation Details

### Location Service Structure

```typescript
// src/services/location.ts

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
}

class LocationService {
  // Get location with priority: GPS → Profile → Default
  async getLocation(): Promise<LocationData | null>
  
  // Get cached GPS location
  getCachedLocation(): LocationData | null
  
  // Cache GPS location
  cacheLocation(location: LocationData): void
  
  // Request GPS location with timeout
  async requestGPSLocation(timeout?: number): Promise<LocationData | null>
  
  // Get profile location
  async getProfileLocation(): Promise<LocationData | null>
  
  // Geocode location (optional)
  async geocodeLocation(lat: number, lng: number): Promise<string>
}
```

### Integration Points

1. **ListingsSection** (`src/components/home/ListingsSection.tsx`)
   - Use location for "nearby" listings
   - Sort by distance

2. **EventsSection** (`src/components/home/EventsSection.tsx`)
   - Use location for "nearby" events
   - Sort by distance

3. **MarketplaceScreen** (`src/screens/marketplace/MarketplaceScreen.tsx`)
   - Use location for filtering
   - Show distance in listings

4. **ProfileScreen** (`src/screens/profile/ProfileScreen.tsx`)
   - Option to update profile location from GPS
   - Show current location vs profile location

---

## Additional Features

### User Preferences

1. **Toggle Option**
   - "Use my current location" (default)
   - "Use my home location" (profile location)

2. **Location Accuracy Indicator**
   - Show if using GPS or profile location
   - Show accuracy radius

3. **Auto-Update Profile**
   - Option to "Update my profile location" when GPS location changes
   - Ask user before updating

4. **Location Permission Handling**
   - Request permission when needed
   - Show explanation why location is needed
   - Handle denied permission gracefully

---

## Privacy & Permissions

### Location Permission

- **Request**: Only when needed (not on app start)
- **Explain**: Why location is needed ("to show nearby listings")
- **Handle**: Gracefully if denied (use profile location)

### Data Storage

- **Cache**: Store last known location locally
- **Profile**: User's home location (optional)
- **Don't Store**: Historical location data (unless user opts in)

### User Control

- **Toggle**: Allow user to disable location services
- **Clear**: Option to clear cached location
- **Update**: User can manually update profile location

---

## Testing Considerations

### Test Cases

1. **GPS Available**
   - Should use GPS location
   - Should cache location
   - Should show accurate nearby results

2. **GPS Unavailable**
   - Should fallback to profile location
   - Should still show results
   - Should not block UI

3. **Permission Denied**
   - Should use profile location
   - Should not request permission again
   - Should show results

4. **Cached Location**
   - Should use cached location if recent
   - Should refresh in background
   - Should update when new location available

5. **Timeout**
   - Should timeout after 2 seconds
   - Should fallback to profile location
   - Should not block UI

---

## Dependencies

### Required Packages

```bash
npx expo install expo-location
```

### Package Usage

```typescript
import * as Location from 'expo-location';

// Request permission
const { status } = await Location.requestForegroundPermissionsAsync();

// Get current position
const location = await Location.getCurrentPositionAsync({
  accuracy: Location.Accuracy.Balanced,
});
```

---

## Next Steps

1. **Create Location Service** (`src/services/location.ts`)
   - Implement location fetching with priority
   - Add caching logic
   - Add timeout handling

2. **Update ListingsSection**
   - Integrate location service
   - Sort by distance
   - Show distance in listings

3. **Update EventsSection**
   - Integrate location service
   - Sort by distance
   - Show distance in events

4. **Add User Preferences**
   - Toggle for location source
   - Location accuracy indicator
   - Auto-update profile option

5. **Testing**
   - Test with GPS available
   - Test with GPS unavailable
   - Test permission denied
   - Test cached location

---

## Notes

- **Performance**: With optimization, minimal impact (0-0.5s delay)
- **UX**: Show cached data immediately, update in background
- **Accuracy**: GPS location provides better "nearby" results
- **Fallback**: Profile location ensures it always works
- **Privacy**: Request permission only when needed, handle gracefully

---

## Last Updated

**Date**: Day 3 - Location System Planning
**Status**: Planning phase - Ready for implementation

