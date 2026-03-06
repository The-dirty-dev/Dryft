import { renderHook } from '@testing-library/react-hooks';

const mockStore = {
  isOnline: true,
  connectionType: 'wifi',
  lastOnlineAt: 123,
  actionQueue: [],
  cachedProfiles: [],
  cachedMessages: {},
  setNetworkStatus: jest.fn(),
  queueAction: jest.fn(),
  removeFromQueue: jest.fn(),
  clearQueue: jest.fn(),
  processQueue: jest.fn(),
  cacheProfiles: jest.fn(),
  getCachedProfiles: jest.fn(() => []),
  clearExpiredCache: jest.fn(),
  cacheMessages: jest.fn(),
  getCachedMessages: jest.fn(() => []),
};

jest.mock('../../store/offlineStore', () => ({
  useOfflineStore: () => mockStore,
}));

import { useNetworkStatus, useOfflineActions, useProfileCache } from '../../hooks/useOffline';

describe('useOffline hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('useNetworkStatus exposes connectivity flags', () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);
    expect(result.current.isWifi).toBe(true);
  });

  it('useOfflineActions queues like action', () => {
    const { result } = renderHook(() => useOfflineActions());
    result.current.queueLike('user-1');
    expect(mockStore.queueAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'like' })
    );
  });

  it('useProfileCache exposes cached counters', () => {
    const { result } = renderHook(() => useProfileCache());
    expect(result.current.cachedCount).toBe(0);
    expect(typeof result.current.getCachedProfiles).toBe('function');
  });
});
