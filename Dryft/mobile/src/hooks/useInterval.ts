import { useEffect, useRef } from 'react';

/**
 * React hook that calls a callback on a specified interval.
 */
export function useInterval(callback: () => void, delayMs: number | null): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delayMs === null) return;

    const intervalId = setInterval(() => {
      savedCallback.current();
    }, delayMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [delayMs]);
}

export default useInterval;
