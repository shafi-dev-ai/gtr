import { CacheEntry, DataManagerConfig } from './types';

class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private config: DataManagerConfig;

  constructor(config: DataManagerConfig) {
    this.config = config;
  }

  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.ttl;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cache entry with optional custom TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.config.maxCacheSize) {
      const oldestKey = this.getOldestKey();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.cacheTTL,
    });
  }

  /**
   * Check if cache entry exists and is valid (not expired)
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.ttl;

    if (isExpired) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Check if cache entry exists but might be stale (expired)
   */
  hasStale(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get stale data (even if expired) for stale-while-revalidate pattern
   */
  getStale<T>(key: string): T | null {
    const entry = this.cache.get(key);
    return entry ? (entry.data as T) : null;
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    const keysToDelete: string[] = [];

    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get oldest cache key (for LRU eviction)
   */
  private getOldestKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    this.cache.forEach((entry, key) => {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    });

    return oldestKey;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      keys: Array.from(this.cache.keys()),
    };
  }
}

export default CacheManager;

