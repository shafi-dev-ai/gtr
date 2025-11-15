import AsyncStorage from '@react-native-async-storage/async-storage';

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  version: string;
}

const CACHE_VERSION = '1.0.0';
const CACHE_PREFIX = 'gtr_cache_';
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB max cache size

class PersistentCache {
  /**
   * Get cached data
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cacheKey = `${CACHE_PREFIX}${key}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      
      if (!cached) return null;

      const entry: CacheEntry<T> = JSON.parse(cached);
      
      // Check version mismatch
      if (entry.version !== CACHE_VERSION) {
        await this.remove(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error('Error reading from persistent cache:', error);
      return null;
    }
  }

  /**
   * Set cached data
   */
  async set<T>(key: string, data: T): Promise<void> {
    try {
      const cacheKey = `${CACHE_PREFIX}${key}`;
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        version: CACHE_VERSION,
      };

      await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
      
      // Check cache size and clean up if needed
      await this.cleanupIfNeeded();
    } catch (error) {
      console.error('Error writing to persistent cache:', error);
      // If storage is full, try to clean up and retry
      try {
        await this.cleanupOldEntries();
        await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({
          data,
          timestamp: Date.now(),
          version: CACHE_VERSION,
        }));
      } catch (retryError) {
        console.error('Error retrying cache write:', retryError);
      }
    }
  }

  /**
   * Remove cached data
   */
  async remove(key: string): Promise<void> {
    try {
      const cacheKey = `${CACHE_PREFIX}${key}`;
      await AsyncStorage.removeItem(cacheKey);
    } catch (error) {
      console.error('Error removing from persistent cache:', error);
    }
  }

  /**
   * Remove all cached data matching a pattern
   */
  async removePattern(pattern: RegExp): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      
      const keysToRemove = cacheKeys.filter(key => {
        const cacheKey = key.replace(CACHE_PREFIX, '');
        return pattern.test(cacheKey);
      });

      await AsyncStorage.multiRemove(keysToRemove);
    } catch (error) {
      console.error('Error removing cache pattern:', error);
    }
  }

  /**
   * Clear all cached data
   */
  async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Error clearing persistent cache:', error);
    }
  }

  /**
   * Check if cache exists
   */
  async has(key: string): Promise<boolean> {
    try {
      const cacheKey = `${CACHE_PREFIX}${key}`;
      const value = await AsyncStorage.getItem(cacheKey);
      return value !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cache size estimate
   */
  private async getCacheSize(): Promise<number> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      const items = await AsyncStorage.multiGet(cacheKeys);
      
      let totalSize = 0;
      items.forEach(([_, value]) => {
        if (value) {
          totalSize += value.length;
        }
      });

      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Clean up old entries if cache is too large
   */
  private async cleanupIfNeeded(): Promise<void> {
    const size = await this.getCacheSize();
    if (size > MAX_CACHE_SIZE) {
      await this.cleanupOldEntries();
    }
  }

  /**
   * Clean up oldest entries
   */
  private async cleanupOldEntries(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      const items = await AsyncStorage.multiGet(cacheKeys);

      // Parse entries and sort by timestamp
      const entries = items
        .map(([key, value]) => {
          if (!value) return null;
          try {
            const entry: CacheEntry = JSON.parse(value);
            return { key, timestamp: entry.timestamp };
          } catch {
            return null;
          }
        })
        .filter((entry): entry is { key: string; timestamp: number } => entry !== null)
        .sort((a, b) => a.timestamp - b.timestamp);

      // Remove oldest 25% of entries
      const entriesToRemove = entries.slice(0, Math.floor(entries.length * 0.25));
      const keysToRemove = entriesToRemove.map(e => e.key);
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
      }
    } catch (error) {
      console.error('Error cleaning up old cache entries:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    size: number;
    entryCount: number;
    maxSize: number;
  }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      const size = await this.getCacheSize();

      return {
        size,
        entryCount: cacheKeys.length,
        maxSize: MAX_CACHE_SIZE,
      };
    } catch (error) {
      return {
        size: 0,
        entryCount: 0,
        maxSize: MAX_CACHE_SIZE,
      };
    }
  }
}

export const persistentCache = new PersistentCache();

