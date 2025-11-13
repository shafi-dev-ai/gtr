export enum RequestPriority {
  CRITICAL = 1,      // User actions (save, like, comment)
  HIGH = 2,          // Critical data (home screen)
  MEDIUM = 3,        // Background pre-fetch (other tabs)
  LOW = 4,           // Stale data refresh (pull-to-refresh)
}

export interface QueuedRequest<T = any> {
  id: string;
  priority: RequestPriority;
  fetchFn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
  timestamp: number;
  cancelled?: boolean;
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export interface DataManagerConfig {
  cacheTTL: number; // Default TTL in milliseconds (5 minutes)
  maxCacheSize: number; // Maximum number of cached entries
  backgroundFetchDelay: number; // Delay before starting background fetches (ms)
  requestTimeout: number; // Request timeout in milliseconds
}

