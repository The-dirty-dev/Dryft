import { useEffect, useRef } from 'react';

/**
 * React hook that returns the previous value from the last render.
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

export default usePrevious;
