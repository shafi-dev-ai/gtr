import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UseResendEmailOptions {
  email: string;
  resendFunction: (email: string) => Promise<{ error: any }>;
  storagePrefix: string; // e.g., 'email_verification' or 'password_reset'
  cooldownSeconds?: number;
  maxResendsPerDay?: number;
}

const DEFAULT_COOLDOWN = 60; // 1 minute
const DEFAULT_MAX_RESENDS = 3;

export const useResendEmail = ({
  email,
  resendFunction,
  storagePrefix,
  cooldownSeconds = DEFAULT_COOLDOWN,
  maxResendsPerDay = DEFAULT_MAX_RESENDS,
}: UseResendEmailOptions) => {
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Storage keys
  const getResendCountKey = useCallback(
    (email: string) => `${storagePrefix}_resend_count_${email}`,
    [storagePrefix]
  );
  const getResendDateKey = useCallback(
    (email: string) => `${storagePrefix}_resend_date_${email}`,
    [storagePrefix]
  );
  const getLastResendTimeKey = useCallback(
    (email: string) => `${storagePrefix}_last_resend_time_${email}`,
    [storagePrefix]
  );

  const loadResendData = useCallback(async () => {
    if (!email) return;

    try {
      const count = await AsyncStorage.getItem(getResendCountKey(email));
      const date = await AsyncStorage.getItem(getResendDateKey(email));

      if (count && date) {
        const today = new Date().toDateString();
        if (date === today) {
          setResendCount(parseInt(count, 10));
        } else {
          // Reset count for new day
          await AsyncStorage.removeItem(getResendCountKey(email));
          await AsyncStorage.removeItem(getResendDateKey(email));
          setResendCount(0);
        }
      }
    } catch (err) {
      console.error('Error loading resend data:', err);
    }
  }, [email, getResendCountKey, getResendDateKey]);

  const checkCooldown = useCallback(async () => {
    if (!email) return;

    try {
      const lastResend = await AsyncStorage.getItem(getLastResendTimeKey(email));
      if (lastResend) {
        const lastResendTime = parseInt(lastResend, 10);
        const now = Date.now();
        const elapsed = Math.floor((now - lastResendTime) / 1000);
        const remaining = Math.max(0, cooldownSeconds - elapsed);
        setResendCooldown(remaining);
      }
    } catch (err) {
      console.error('Error checking cooldown:', err);
    }
  }, [email, getLastResendTimeKey, cooldownSeconds]);

  const handleResend = useCallback(async () => {
    if (resendCooldown > 0) {
      return;
    }

    if (resendCount >= maxResendsPerDay) {
      setError('Maximum resend limit reached. Please try again tomorrow.');
      return;
    }

    if (!email) {
      setError('Email address not found');
      return;
    }

    setIsResending(true);
    setError(null);

    try {
      const { error: resendError } = await resendFunction(email);

      if (resendError) {
        setError('Unable to resend. Please try again.');
        setIsResending(false);
        return;
      }

      // Success - update resend count and timestamp
      const today = new Date().toDateString();
      const newCount = resendCount + 1;
      await AsyncStorage.setItem(getResendCountKey(email), newCount.toString());
      await AsyncStorage.setItem(getResendDateKey(email), today);
      await AsyncStorage.setItem(getLastResendTimeKey(email), Date.now().toString());
      setResendCount(newCount);
      setResendCooldown(cooldownSeconds);
      setError(null);
    } catch (err: any) {
      setError('Unable to resend. Please try again.');
    } finally {
      setIsResending(false);
    }
  }, [
    email,
    resendFunction,
    resendCooldown,
    resendCount,
    maxResendsPerDay,
    cooldownSeconds,
    getResendCountKey,
    getResendDateKey,
    getLastResendTimeKey,
  ]);

  useEffect(() => {
    if (email) {
      loadResendData();
      checkCooldown();
    }
    const interval = setInterval(() => {
      if (email) {
        checkCooldown();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [email, loadResendData, checkCooldown]);

  return {
    resendCooldown,
    resendCount,
    isResending,
    error,
    handleResend,
    canResend: resendCooldown === 0 && resendCount < maxResendsPerDay && !isResending,
    remainingResends: maxResendsPerDay - resendCount,
  };
};

