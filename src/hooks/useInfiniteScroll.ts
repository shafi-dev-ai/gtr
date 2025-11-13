import React, { useState, useCallback, useRef } from 'react';
import dataManager, { RequestPriority } from '../services/dataManager';

interface UseInfiniteScrollOptions<T> {
  cacheKey: string;
  fetchFn: (offset: number, limit: number) => Promise<T[]>;
  limit?: number;
  priority?: RequestPriority;
  ttl?: number;
  enabled?: boolean;
}

interface UseInfiniteScrollResult<T> {
  data: T[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  reset: () => void;
}

export function useInfiniteScroll<T>(options: UseInfiniteScrollOptions<T>): UseInfiniteScrollResult<T> {
  const {
    cacheKey,
    fetchFn,
    limit = 10,
    priority = RequestPriority.HIGH,
    ttl = 5 * 60 * 1000, // 5 minutes
    enabled = true,
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const offsetRef = useRef(0);
  const cancelledRef = useRef(false);
  const fetchFnRef = useRef(fetchFn);
  
  // Keep fetchFn ref updated
  React.useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  // Load initial data or from cache
  const loadInitial = useCallback(async (forceRefresh = false) => {
    if (!enabled) return;

    cancelledRef.current = false;
    
      // Check cache first if not forcing refresh
      if (!forceRefresh) {
        const cached = dataManager.getCache<T[]>(cacheKey);
        if (cached !== null && cached.length > 0) {
          setData(cached);
          setLoading(false);
          offsetRef.current = cached.length;
          setHasMore(cached.length >= limit); // Assume more if we got full page
          // Still fetch fresh in background if stale
          dataManager.fetch(cacheKey, () => fetchFn(0, limit), {
            priority: RequestPriority.LOW,
            ttl,
            skipCache: true,
          }).then((freshData) => {
            if (!cancelledRef.current && freshData.length > 0) {
              setData(freshData);
              offsetRef.current = freshData.length;
              setHasMore(freshData.length >= limit);
            }
          }).catch(() => {
            // Silently fail background refresh
          });
          return;
        }
      }

    setLoading(true);
    setError(null);
    offsetRef.current = 0;

    try {
      const result = await dataManager.fetch(
        cacheKey,
        () => fetchFn(0, limit),
        {
          priority,
          ttl,
          skipCache: forceRefresh,
        }
      );

      if (!cancelledRef.current) {
        setData(result);
        setLoading(false);
        offsetRef.current = result.length;
        setHasMore(result.length >= limit);
      }
    } catch (err: any) {
      if (!cancelledRef.current) {
        setError(err);
        setLoading(false);
      }
    }
  }, [cacheKey, fetchFn, limit, priority, ttl, enabled]);

  // Load more data (pagination)
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading || !enabled) return;

    setLoadingMore(true);
    const currentOffset = offsetRef.current;

    try {
      const result = await fetchFnRef.current(currentOffset, limit);

      if (!cancelledRef.current) {
        if (result.length > 0) {
          setData(prev => {
            const newData = [...prev, ...result];
            // Update cache with new data
            dataManager.setCache(cacheKey, newData, ttl);
            return newData;
          });
          offsetRef.current += result.length;
          setHasMore(result.length >= limit);
        } else {
          setHasMore(false);
        }
        setLoadingMore(false);
      }
    } catch (err: any) {
      if (!cancelledRef.current) {
        setError(err);
        setLoadingMore(false);
      }
    }
  }, [hasMore, loadingMore, loading, enabled, fetchFn, limit, cacheKey, ttl]);

  // Refresh (pull-to-refresh)
  const refresh = useCallback(async () => {
    await loadInitial(true);
  }, [loadInitial]);

  // Reset to initial state
  const reset = useCallback(() => {
    setData([]);
    setLoading(true);
    setLoadingMore(false);
    setHasMore(true);
    setError(null);
    offsetRef.current = 0;
    loadInitial(true);
  }, [loadInitial]);

  // Initial load - reset when cacheKey changes
  React.useEffect(() => {
    // Reset state when cacheKey changes
    setData([]);
    setLoading(true);
    setLoadingMore(false);
    setHasMore(true);
    setError(null);
    offsetRef.current = 0;
    cancelledRef.current = false;
    
    // Load initial data
    const loadData = async () => {
      if (!enabled) {
        setLoading(false);
        return;
      }

      // Check cache first
      const cached = dataManager.getCache<T[]>(cacheKey);
      if (cached !== null && cached.length > 0) {
        setData(cached);
        setLoading(false);
        offsetRef.current = cached.length;
        setHasMore(cached.length >= limit);
        // Still fetch fresh in background if stale
        dataManager.fetch(cacheKey, () => fetchFnRef.current(0, limit), {
          priority: RequestPriority.LOW,
          ttl,
          skipCache: true,
        }).then((freshData) => {
          if (!cancelledRef.current && freshData.length > 0) {
            setData(freshData);
            offsetRef.current = freshData.length;
            setHasMore(freshData.length >= limit);
          }
        }).catch(() => {
          // Silently fail background refresh
        });
        return;
      }

      // No cache, fetch fresh
      setLoading(true);
      setError(null);
      offsetRef.current = 0;

      try {
        const result = await dataManager.fetch(
          cacheKey,
          () => fetchFnRef.current(0, limit),
          {
            priority,
            ttl,
            skipCache: false,
          }
        );

        if (!cancelledRef.current) {
          setData(result);
          setLoading(false);
          offsetRef.current = result.length;
          setHasMore(result.length >= limit);
        }
      } catch (err: any) {
        if (!cancelledRef.current) {
          setError(err);
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelledRef.current = true;
    };
  }, [cacheKey, enabled, limit, priority, ttl]); // Only depend on stable values

  return {
    data,
    loading,
    loadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
    reset,
  };
}


