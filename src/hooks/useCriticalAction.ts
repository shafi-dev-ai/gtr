import { useState, useCallback } from 'react';
import dataManager from '../services/dataManager';

interface UseCriticalActionOptions<T> {
  cacheKey: string;
  actionFn: () => Promise<T>;
  invalidateCache?: string | string[];
  onSuccess?: (data: T) => void;
  onError?: (error: any) => void;
}

interface UseCriticalActionResult<T> {
  execute: () => Promise<T | undefined>;
  loading: boolean;
  error: Error | null;
}

export function useCriticalAction<T>(options: UseCriticalActionOptions<T>): UseCriticalActionResult<T> {
  const { cacheKey, actionFn, invalidateCache, onSuccess, onError } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (): Promise<T | undefined> => {
    setLoading(true);
    setError(null);

    try {
      const result = await dataManager.executeCritical(cacheKey, actionFn, {
        invalidateCache,
      });

      onSuccess?.(result);
      return result;
    } catch (err: any) {
      setError(err);
      onError?.(err);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, [cacheKey, actionFn, invalidateCache, onSuccess, onError]);

  return { execute, loading, error };
}

