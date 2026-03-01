import { useEffect, useRef, useState } from 'react';

/**
 * React hook that throttles a value by the provided interval.
 */
export function useThrottle<T>(value: T, intervalMs: number): T {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    const elapsed = now - lastRan.current;

    if (elapsed >= intervalMs) {
      lastRan.current = now;
      setThrottledValue(value);
      return;
    }

    const timeoutId = setTimeout(() => {
      lastRan.current = Date.now();
      setThrottledValue(value);
    }, intervalMs - elapsed);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, intervalMs]);

  return throttledValue;
}

export default useThrottle;
