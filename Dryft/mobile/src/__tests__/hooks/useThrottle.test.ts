import { renderHook, act } from '@testing-library/react-hooks';
import { useThrottle } from '../../hooks/useThrottle';

describe('useThrottle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns initial value', () => {
    const { result } = renderHook(({ value }) => useThrottle(value, 100), {
      initialProps: { value: 'a' },
    });

    expect(result.current).toBe('a');
  });

  it('throttles rapid changes', () => {
    const { result, rerender } = renderHook(({ value }) => useThrottle(value, 100), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'b' });
    rerender({ value: 'c' });
    expect(result.current).toBe('a');

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe('c');
  });

  it('updates immediately when interval elapsed', () => {
    const { result, rerender } = renderHook(({ value }) => useThrottle(value, 50), {
      initialProps: { value: 'a' },
    });

    act(() => {
      jest.advanceTimersByTime(60);
    });
    rerender({ value: 'b' });

    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(result.current).toBe('b');
  });
});
