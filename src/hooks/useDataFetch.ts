import { useState, useEffect, useCallback, useRef } from 'react';
import dataManager, { RequestPriority } from '../services/dataManager';

interface UseDataFetchOptions<T> {
  cacheKey: string;
  fetchFn: () => Promise<T>;
  priority?: RequestPriority;
  ttl?: number;
  skipCache?: boolean;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: any) => void;
  staleWhileRevalidate?: boolean;
}

interface UseDataFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useDataFetch<T>(options: UseDataFetchOptions<T>): UseDataFetchResult<T> {
  const {
    cacheKey,
    fetchFn,
    priority = RequestPriority.HIGH,
    ttl,
    skipCache = false,
    enabled = true,
    onSuccess,
    onError,
    staleWhileRevalidate = false,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cancelledRef = useRef(false);
  const fetchFnRef = useRef(fetchFn);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const previousEnabledRef = useRef(enabled);

  // Keep refs updated
  useEffect(() => {
    fetchFnRef.current = fetchFn;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [fetchFn, onSuccess, onError]);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!enabled) return;

    // If not forcing refresh, check cache first
    if (!forceRefresh && !skipCache) {
      const cached = dataManager.getCache<T>(cacheKey);
      if (cached !== null) {
        setData(cached);
        setLoading(false);
        return;
      }
    }

    cancelledRef.current = false;
    setLoading(true);
    setError(null);

    try {
      let result: T;

      if (staleWhileRevalidate && !forceRefresh) {
        // Stale-while-revalidate pattern
        result = await dataManager.fetchWithStale(
          cacheKey,
          fetchFn,
          {
            priority,
            ttl,
            onStale: (staleData) => {
              if (!cancelledRef.current) {
                setData(staleData);
                setLoading(false);
              }
            },
          }
        );
      } else {
        // Regular fetch
        result = await dataManager.fetch(cacheKey, fetchFn, {
          priority,
          ttl,
          skipCache: forceRefresh || skipCache,
        });
      }

      if (!cancelledRef.current) {
        setData(result);
        setLoading(false);
        onSuccess?.(result);
      }
    } catch (err: any) {
      if (!cancelledRef.current) {
        setError(err);
        setLoading(false);
        onError?.(err);
      }
    }
  }, [cacheKey, fetchFn, priority, ttl, skipCache, enabled, staleWhileRevalidate, onSuccess, onError]);

  const refetch = useCallback(async () => {
    await fetchData(false);
  }, [fetchData]);

  const refresh = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    const wasDisabled = !previousEnabledRef.current;
    const isNowEnabled = enabled;
    previousEnabledRef.current = enabled;

    if (!enabled) {
      setLoading(false);
      setData(null);
      return;
    }

    cancelledRef.current = false;

    // Check cache first - if exists, use it immediately
    const cached = dataManager.getCache<T>(cacheKey);
    if (cached !== null && !skipCache && !wasDisabled) {
      // Only use cache if we weren't just enabled (to force fetch on first enable)
      setData(cached);
      setLoading(false);
      
      // If cache exists but might be stale, fetch fresh in background (stale-while-revalidate)
      if (staleWhileRevalidate) {
        // Fetch fresh in background without blocking
        dataManager.fetch(cacheKey, () => fetchFnRef.current(), {
          priority: RequestPriority.LOW,
          ttl,
          skipCache: true,
        }).then((freshData) => {
          if (!cancelledRef.current) {
            setData(freshData);
          }
        }).catch(() => {
          // Silently fail background refresh
        });
      }
      return;
    }

    // No cache OR just enabled - fetch fresh data
    setLoading(true);
    setError(null);

    const loadData = async () => {
      try {
        let result: T;

        if (staleWhileRevalidate && cached !== null) {
          // Use stale-while-revalidate if we have stale cache
          result = await dataManager.fetchWithStale(
            cacheKey,
            () => fetchFnRef.current(),
            {
              priority,
              ttl,
              onStale: (staleData) => {
                if (!cancelledRef.current) {
                  setData(staleData);
                  setLoading(false);
                }
              },
            }
          );
        } else {
          // Regular fetch
          result = await dataManager.fetch(cacheKey, () => fetchFnRef.current(), {
            priority,
            ttl,
            skipCache: false,
          });
        }

        if (!cancelledRef.current) {
          setData(result);
          setLoading(false);
          onSuccessRef.current?.(result);
        }
      } catch (err: any) {
        if (!cancelledRef.current) {
          setError(err);
          setLoading(false);
          onErrorRef.current?.(err);
        }
      }
    };

    loadData();

    return () => {
      cancelledRef.current = true;
    };
  }, [cacheKey, enabled, skipCache, staleWhileRevalidate, priority, ttl]); // Only stable dependencies

  return { data, loading, error, refetch, refresh };
}

