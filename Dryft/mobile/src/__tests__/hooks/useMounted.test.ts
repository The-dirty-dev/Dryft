import { renderHook } from '@testing-library/react-hooks';
import { useMounted } from '../../hooks/useMounted';

describe('useMounted', () => {
  it('returns a ref object', () => {
    const { result } = renderHook(() => useMounted());
    expect(result.current).toBeDefined();
    expect(typeof result.current).toBe('object');
  });

  it('sets mounted to true after mount effect', () => {
    const { result } = renderHook(() => useMounted());
    expect(result.current.current).toBe(true);
  });

  it('sets mounted to false on unmount', () => {
    const { result, unmount } = renderHook(() => useMounted());
    unmount();
    expect(result.current.current).toBe(false);
  });
});
