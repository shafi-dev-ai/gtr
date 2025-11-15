/**
 * Throttle function calls - ensures function is called at most once per delay period
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delay) {
      lastCall = now;
      func.apply(this, args);
    } else {
      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Schedule call for remaining time
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func.apply(this, args);
        timeoutId = null;
      }, delay - timeSinceLastCall);
    }
  };
}

/**
 * Debounce function calls - delays execution until after delay has passed since last call
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Rate limiter - limits function calls to max calls per window
 */
export class RateLimiter {
  private calls: number[] = [];
  private maxCalls: number;
  private windowMs: number;

  constructor(maxCalls: number, windowMs: number) {
    this.maxCalls = maxCalls;
    this.windowMs = windowMs;
  }

  canCall(): boolean {
    const now = Date.now();
    
    // Remove old calls outside the window
    this.calls = this.calls.filter(timestamp => now - timestamp < this.windowMs);
    
    return this.calls.length < this.maxCalls;
  }

  recordCall(): void {
    this.calls.push(Date.now());
  }

  reset(): void {
    this.calls = [];
  }
}

