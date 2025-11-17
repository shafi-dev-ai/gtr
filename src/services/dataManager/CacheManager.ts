import { CacheEntry, DataManagerConfig } from './types';
import { persistentCache } from '../persistentCache';

class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private config: DataManagerConfig;
  private persistentCacheEnabled: boolean = true;
  private readonly persistedKeyPatterns = [
    /^profile:current$/,
    /^profile:stats:/,
    /^home:listings/,
    /^home:events/,
    /^home:forum/,
    /^notifications:unread_count$/,
    /^messages:unread_count$/,
    /^messages:conversations/,
  ];

  constructor(config: DataManagerConfig) {
    this.config = config;
    // Load critical cache from persistent storage on startup (non-blocking)
    this.loadPersistentCache().catch(() => {
      // Silently fail - app can work without persistent cache
    });
  }

  /**
   * Load critical cache entries from persistent storage
   */
  private async loadPersistentCache(): Promise<void> {
    if (!this.persistentCacheEnabled) return;

    try {
      // Load critical cache keys
      const criticalKeys = [
        'profile:current',
        'home:listings:nearby:5',
        'home:events:upcoming:5',
        'home:forum:recent:3',
        'messages:conversations',
        'messages:unread_count',
      ];

      for (const key of criticalKeys) {
        const data = await persistentCache.get(key);
        if (data !== null) {
          this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: this.config.cacheTTL,
          });
        }
      }
    } catch (error) {
      console.error('Error loading persistent cache:', error);
    }
  }

  /**
   * Get cached data if available and not expired
   * Also checks persistent cache if in-memory cache misses
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (entry) {
      const now = Date.now();
      const isExpired = now - entry.timestamp > entry.ttl;

      if (isExpired) {
        this.cache.delete(key);
        // Try persistent cache as fallback
        if (this.persistentCacheEnabled) {
          const persistentData = await persistentCache.get<T>(key);
          if (persistentData !== null) {
            // Restore to in-memory cache
            this.cache.set(key, {
              data: persistentData,
              timestamp: Date.now(),
              ttl: this.config.cacheTTL,
            });
            return persistentData;
          }
        }
        return null;
      }

      return entry.data as T;
    }

    // Check persistent cache if in-memory cache misses
    if (this.persistentCacheEnabled) {
      const persistentData = await persistentCache.get<T>(key);
      if (persistentData !== null) {
        // Restore to in-memory cache
        this.cache.set(key, {
          data: persistentData,
          timestamp: Date.now(),
          ttl: this.config.cacheTTL,
        });
        return persistentData;
      }
    }

    return null;
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

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.cacheTTL,
    };

    this.cache.set(key, entry);

    // Persist critical cache entries
    if (this.persistentCacheEnabled && this.isCriticalKey(key)) {
      persistentCache.set(key, data).catch(error => {
        console.error('Error persisting cache:', error);
      });
    }
  }

  /**
   * Check if key is critical and should be persisted
   */
  private isCriticalKey(key: string): boolean {
    return this.persistedKeyPatterns.some(pattern => pattern.test(key));
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

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      // Also remove from persistent cache
      if (this.persistentCacheEnabled) {
        persistentCache.remove(key).catch(() => {});
      }
    });

    // Also invalidate persistent cache pattern
    if (this.persistentCacheEnabled) {
      persistentCache.removePattern(regex).catch(() => {});
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    if (this.persistentCacheEnabled) {
      persistentCache.clear().catch(() => {});
    }
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
