import { renderHook } from '@testing-library/react-hooks';
import { useInterval } from '../../hooks/useInterval';

describe('useInterval', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires callback on interval', () => {
    const callback = jest.fn();
    renderHook(() => useInterval(callback, 100));

    jest.advanceTimersByTime(300);
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('does not run when delay is null', () => {
    const callback = jest.fn();
    renderHook(() => useInterval(callback, null));

    jest.advanceTimersByTime(300);
    expect(callback).not.toHaveBeenCalled();
  });

  it('cleans up interval on unmount', () => {
    const callback = jest.fn();
    const { unmount } = renderHook(() => useInterval(callback, 50));

    jest.advanceTimersByTime(100);
    unmount();
    jest.advanceTimersByTime(200);

    expect(callback.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
