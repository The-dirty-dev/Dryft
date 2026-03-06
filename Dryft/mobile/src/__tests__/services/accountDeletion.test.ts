import AsyncStorage from '@react-native-async-storage/async-storage';
import accountDeletionService from '../../services/accountDeletion';

const mockApiPost = jest.fn();

jest.mock('../../services/api', () => ({
  api: {
    post: (...args: any[]) => mockApiPost(...args),
    get: jest.fn(),
  },
}));

describe('services/accountDeletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('submits deletion request with reason', async () => {
    mockApiPost.mockResolvedValue({
      data: {
        id: 'req-1',
        status: 'scheduled',
        reason: 'taking_break',
        requestedAt: new Date().toISOString(),
        scheduledFor: new Date().toISOString(),
        gracePeriodEnds: new Date().toISOString(),
        canCancel: true,
      },
    });

    const result = await accountDeletionService.requestDeletion('taking_break', 'Need some space');

    expect(mockApiPost).toHaveBeenCalledWith('/v1/account/delete', {
      reason: 'taking_break',
      feedback: 'Need some space',
    });
    expect(result.id).toBe('req-1');
  });

  it('cancels a deletion request', async () => {
    mockApiPost.mockResolvedValue({});

    await accountDeletionService.cancelDeletion('req-9');

    expect(mockApiPost).toHaveBeenCalledWith('/v1/account/delete/req-9/cancel');
  });

  it('clears local app data during cleanup', async () => {
    (AsyncStorage.getAllKeys as jest.Mock).mockResolvedValue(['dryft_one', 'other', '@dryft_two']);

    await accountDeletionService.clearAllLocalData();

    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith(['dryft_one', '@dryft_two']);
  });
});
