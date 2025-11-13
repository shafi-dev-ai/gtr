# Data Management System Documentation

## Overview

The GT-R Marketplace app now uses a corporate-level data management system that optimizes API calls, implements intelligent caching, and provides a smooth user experience even with millions of records.

## Architecture

### Core Components

1. **DataManager** (`src/services/dataManager/DataManager.ts`)
   - Centralized data fetching with priority queue
   - Automatic caching with TTL
   - Request deduplication
   - Stale-while-revalidate pattern

2. **CacheManager** (`src/services/dataManager/CacheManager.ts`)
   - LRU cache with configurable TTL
   - Pattern-based cache invalidation
   - Stale data retrieval for instant UI updates

3. **PriorityQueue** (`src/services/dataManager/PriorityQueue.ts`)
   - Priority-based request execution
   - Pause/resume for critical actions
   - Request cancellation

4. **RequestDeduplicator** (`src/services/dataManager/RequestDeduplicator.ts`)
   - Prevents duplicate API calls
   - Returns existing promise for duplicate requests

5. **BackgroundSync** (`src/services/dataManager/BackgroundSync.ts`)
   - Low-priority background prefetching
   - Non-blocking data loading

### Request Priorities

```typescript
enum RequestPriority {
  CRITICAL = 1,  // User actions (save, like, comment)
  HIGH = 2,      // Critical data (home screen)
  MEDIUM = 3,   // Background pre-fetch (other tabs)
  LOW = 4,      // Stale data refresh (pull-to-refresh)
}
```

## Data Flow

### On Login/Signup

1. **Phase 1: Critical Data (Blocking)**
   - Home screen forum posts (3)
   - Nearby listings (5)
   - Upcoming events (5)
   - User profile stats
   - User profile data

2. **Phase 2: Background Prefetch (Non-blocking)**
   - Marketplace listings (10)
   - Community forum posts (20)
   - Events (20)
   - User's own content (listings, events, posts)

### On Tab Switch

1. Check cache → Show immediately if available
2. If stale → Fetch fresh data in background
3. Update UI when fresh data arrives

### On User Action

1. Pause background fetches
2. Execute action (CRITICAL priority)
3. Invalidate related cache
4. Resume background fetches

## Usage

### Basic Data Fetching

```typescript
import { useDataFetch } from '../../hooks/useDataFetch';
import { RequestPriority } from '../../services/dataManager';

const { data, loading, error, refresh } = useDataFetch({
  cacheKey: 'home:listings:nearby:5',
  fetchFn: () => listingsService.getAllListings(5),
  priority: RequestPriority.HIGH,
  ttl: 2 * 60 * 1000, // 2 minutes
  staleWhileRevalidate: true,
});
```

### Critical Actions

```typescript
import { useCriticalAction } from '../../hooks/useCriticalAction';

const { execute, loading } = useCriticalAction({
  cacheKey: 'listing:favorite',
  actionFn: () => favoritesService.toggleFavorite(listingId),
  invalidateCache: ['home:listings', 'marketplace:listings'],
});
```

### Pull-to-Refresh

```typescript
<ScrollView
  refreshControl={
    <RefreshControl
      refreshing={loading && data.length > 0}
      onRefresh={refresh}
      tintColor="#DC143C"
    />
  }
>
  {/* Content */}
</ScrollView>
```

## Cache Keys Convention

```
{section}:{type}:{params}
Examples:
- home:listings:nearby:5
- home:forum:recent:3
- home:events:upcoming:5
- marketplace:listings:10
- profile:current
- profile:stats:{userId}
```

## Performance Optimizations

1. **Request Deduplication**: Prevents duplicate API calls
2. **Batch Fetching**: Combines multiple queries into one
3. **Selective Fields**: Only fetches required columns
4. **Stale-While-Revalidate**: Shows cached data immediately, updates in background
5. **Priority Queue**: Ensures critical actions execute first
6. **Background Sync**: Prefetches data without blocking UI

## Cache Invalidation

Cache is automatically invalidated when:
- User performs actions (like, comment, favorite)
- Pull-to-refresh is triggered
- TTL expires (stale-while-revalidate kicks in)

Manual invalidation:
```typescript
import dataManager from '../services/dataManager';

// Invalidate specific cache
dataManager.invalidateCache('home:listings');

// Invalidate pattern
dataManager.invalidateCache(/^home:/);
```

## Best Practices

1. **Use appropriate priorities**: CRITICAL for user actions, HIGH for visible data
2. **Set reasonable TTLs**: 2-5 minutes for frequently changing data, 10+ minutes for stable data
3. **Use stale-while-revalidate**: For better perceived performance
4. **Invalidate related cache**: When user actions affect multiple views
5. **Use pull-to-refresh**: For manual data refresh

## Monitoring

Get system statistics:
```typescript
import dataManager from '../services/dataManager';

const stats = dataManager.getStats();
console.log('Cache size:', stats.cache.size);
console.log('Queue size:', stats.queueSize);
console.log('Pending requests:', stats.pendingRequests);
```

## Future Enhancements

- [ ] Offline support with queue
- [ ] Request retry logic
- [ ] Analytics integration
- [ ] Performance metrics
- [ ] Cache size optimization

