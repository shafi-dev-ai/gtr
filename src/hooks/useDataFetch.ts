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
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const cancelledRef = useRef(false);
  const fetchFnRef = useRef(fetchFn);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const previousEnabledRef = useRef(enabled);
  const fetchIdRef = useRef(0);

  // Keep refs updated
  useEffect(() => {
    fetchFnRef.current = fetchFn;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [fetchFn, onSuccess, onError]);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!enabled) return;

    const currentFetchId = ++fetchIdRef.current;

    if (!forceRefresh && !skipCache) {
      const cached = await dataManager.getCache<T>(cacheKey);
      if (cached !== null) {
        if (fetchIdRef.current === currentFetchId) {
          setData(cached);
          setLoading(false);
        }
        return;
      }
    }

    cancelledRef.current = false;
    setLoading(true);
    setError(null);

    try {
      const result = await dataManager.fetch(cacheKey, () => fetchFnRef.current(), {
        priority,
        ttl,
        skipCache: forceRefresh || skipCache,
      });

      if (!cancelledRef.current && fetchIdRef.current === currentFetchId) {
        setData(result);
        setLoading(false);
        onSuccessRef.current?.(result);
      }
    } catch (err: any) {
      if (!cancelledRef.current && fetchIdRef.current === currentFetchId) {
        setError(err);
        setLoading(false);
        onErrorRef.current?.(err);
      }
    }
  }, [cacheKey, priority, ttl, skipCache, enabled]);

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
      cancelledRef.current = true;
      fetchIdRef.current++;
      setLoading(false);
      setData(null);
      return;
    }

    cancelledRef.current = false;

    // Check cache and load data (async)
    const initializeData = async () => {
      const initFetchId = ++fetchIdRef.current;
      // Check cache first
      if (!skipCache) {
        const cached = await dataManager.getCache<T>(cacheKey);
        if (cached !== null && !wasDisabled) {
          if (fetchIdRef.current === initFetchId) {
            setData(cached);
            setLoading(false);
          }
          return;
        }
      }

      // No cache OR just enabled - fetch fresh data
      setLoading(true);
      setError(null);

      try {
        const result = await dataManager.fetch(cacheKey, () => fetchFnRef.current(), {
          priority,
          ttl,
          skipCache: false,
        });

        if (!cancelledRef.current && fetchIdRef.current === initFetchId) {
          setData(result);
          setLoading(false);
          onSuccessRef.current?.(result);
        }
      } catch (err: any) {
        if (!cancelledRef.current && fetchIdRef.current === initFetchId) {
          setError(err);
          setLoading(false);
          onErrorRef.current?.(err);
        }
      }
    };

    initializeData();

    return () => {
      cancelledRef.current = true;
      fetchIdRef.current++;
    };
  }, [cacheKey, enabled, skipCache, priority, ttl]); // Only stable dependencies

  return { data, loading, error, refetch, refresh };
}
