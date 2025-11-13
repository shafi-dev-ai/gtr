import { RequestPriority, QueuedRequest, DataManagerConfig } from './types';
import PriorityQueue from './PriorityQueue';
import CacheManager from './CacheManager';
import RequestDeduplicator from './RequestDeduplicator';

const DEFAULT_CONFIG: DataManagerConfig = {
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 100,
  backgroundFetchDelay: 1000, // 1 second delay before background fetches
  requestTimeout: 30000, // 30 seconds
};

class DataManager {
  private priorityQueue: PriorityQueue;
  private cacheManager: CacheManager;
  private deduplicator: RequestDeduplicator;
  private config: DataManagerConfig;
  private requestIdCounter = 0;

  constructor(config: Partial<DataManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.priorityQueue = new PriorityQueue();
    this.cacheManager = new CacheManager(this.config);
    this.deduplicator = new RequestDeduplicator();
  }

  /**
   * Fetch data with caching and priority queue
   */
  async fetch<T>(
    cacheKey: string,
    fetchFn: () => Promise<T>,
    options: {
      priority?: RequestPriority;
      ttl?: number;
      skipCache?: boolean;
      deduplicate?: boolean;
    } = {}
  ): Promise<T> {
    const {
      priority = RequestPriority.HIGH,
      ttl,
      skipCache = false,
      deduplicate = true,
    } = options;

    // Check cache first (unless skipCache is true)
    if (!skipCache) {
      const cached = this.cacheManager.get<T>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    // Use deduplication if enabled
    if (deduplicate) {
      return this.deduplicator.execute(cacheKey, async () => {
        return this.executeFetch(cacheKey, fetchFn, priority, ttl);
      });
    }

    return this.executeFetch(cacheKey, fetchFn, priority, ttl);
  }

  /**
   * Execute fetch through priority queue
   */
  private async executeFetch<T>(
    cacheKey: string,
    fetchFn: () => Promise<T>,
    priority: RequestPriority,
    ttl?: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const requestId = `req_${++this.requestIdCounter}_${Date.now()}`;

      const queuedRequest: QueuedRequest<T> = {
        id: requestId,
        priority,
        fetchFn: async () => {
          const result = await this.withTimeout(fetchFn(), this.config.requestTimeout);
          // Cache the result
          this.cacheManager.set(cacheKey, result, ttl);
          return result;
        },
        resolve,
        reject,
        timestamp: Date.now(),
      };

      this.priorityQueue.enqueue(queuedRequest);
    });
  }

  /**
   * Fetch with stale-while-revalidate pattern
   */
  async fetchWithStale<T>(
    cacheKey: string,
    fetchFn: () => Promise<T>,
    options: {
      priority?: RequestPriority;
      ttl?: number;
      onStale?: (data: T) => void;
    } = {}
  ): Promise<T> {
    const { priority = RequestPriority.MEDIUM, ttl, onStale } = options;

    // Return stale data immediately if available
    const staleData = this.cacheManager.getStale<T>(cacheKey);
    if (staleData !== null) {
      if (onStale) {
        onStale(staleData);
      }
      // Check if stale (expired)
      if (!this.cacheManager.has(cacheKey)) {
        // Fetch fresh data in background (low priority)
        this.fetch(cacheKey, fetchFn, {
          priority: RequestPriority.LOW,
          ttl,
          skipCache: true,
        }).catch(() => {
          // Silently fail background refresh
        });
      }
      return staleData;
    }

    // No stale data, fetch fresh
    return this.fetch(cacheKey, fetchFn, { priority, ttl });
  }

  /**
   * Execute critical user action (pauses background fetches)
   */
  async executeCritical<T>(
    cacheKey: string,
    fetchFn: () => Promise<T>,
    options: {
      invalidateCache?: string | string[];
      ttl?: number;
    } = {}
  ): Promise<T> {
    const { invalidateCache, ttl } = options;

    // Pause background fetches
    this.priorityQueue.pause();

    try {
      const result = await this.fetch(cacheKey, fetchFn, {
        priority: RequestPriority.CRITICAL,
        ttl,
        skipCache: true,
        deduplicate: false,
      });

      // Invalidate related cache
      if (invalidateCache) {
        const keys = Array.isArray(invalidateCache) ? invalidateCache : [invalidateCache];
        keys.forEach(key => {
          this.cacheManager.invalidatePattern(key);
        });
      }

      return result;
    } finally {
      // Resume background fetches after a short delay
      setTimeout(() => {
        this.priorityQueue.resume();
      }, 100);
    }
  }

  /**
   * Prefetch data in background (low priority)
   */
  prefetch<T>(
    cacheKey: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): void {
    // Check if already cached
    if (this.cacheManager.has(cacheKey)) {
      return;
    }

    // Delay background fetch
    setTimeout(() => {
      this.fetch(cacheKey, fetchFn, {
        priority: RequestPriority.MEDIUM,
        ttl,
        deduplicate: true,
      }).catch(() => {
        // Silently fail background prefetch
      });
    }, this.config.backgroundFetchDelay);
  }

  /**
   * Invalidate cache
   */
  invalidateCache(pattern: string | RegExp): void {
    this.cacheManager.invalidatePattern(pattern);
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cacheManager.clear();
  }

  /**
   * Cancel pending requests
   */
  cancelRequests(pattern?: string): void {
    if (pattern) {
      // Cancel requests matching pattern (would need to track request keys)
      this.priorityQueue.cancelByPriority(RequestPriority.LOW);
    } else {
      this.priorityQueue.clear();
    }
  }

  /**
   * Get cache entry
   */
  getCache<T>(key: string): T | null {
    return this.cacheManager.get<T>(key);
  }

  /**
   * Set cache entry manually
   */
  setCache<T>(key: string, data: T, ttl?: number): void {
    this.cacheManager.set(key, data, ttl);
  }

  /**
   * Check if cache has key
   */
  hasCache(key: string): boolean {
    return this.cacheManager.has(key);
  }

  /**
   * Add timeout to promise
   */
  private async withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      ),
    ]);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      cache: this.cacheManager.getStats(),
      queueSize: this.priorityQueue.size(),
      pendingRequests: this.deduplicator.getPendingCount(),
      isProcessing: this.priorityQueue.isProcessing(),
      isPaused: this.priorityQueue.isPaused(),
    };
  }
}

export default DataManager;

