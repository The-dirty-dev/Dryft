import { useEffect, useRef } from 'react';

/**
 * React hook that returns a ref indicating whether the component is mounted.
 */
export function useMounted() {
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return isMounted;
}

export default useMounted;
