import moderationService from '../../services/moderation';

const mockApiPost = jest.fn();

jest.mock('../../services/api', () => ({
  api: {
    post: (...args: any[]) => mockApiPost(...args),
    get: jest.fn(),
  },
}));

describe('services/moderation', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await moderationService.reset();
  });

  it('submits reports with reason and category', async () => {
    mockApiPost.mockResolvedValue({
      data: {
        id: 'report-1',
        status: 'pending',
      },
    });

    const result = await moderationService.reportUser('user-2', 'harassment', {
      description: 'abusive messages',
    });

    expect(mockApiPost).toHaveBeenCalledWith('/v1/reports', expect.objectContaining({
      reported_user_id: 'user-2',
      reason: 'harassment',
      category: 'behavior',
    }));
    expect(result?.id).toBe('report-1');
  });

  it('blocks a user and updates local safety status', async () => {
    mockApiPost.mockResolvedValue({});

    const success = await moderationService.blockUser('user-3', 'Sam', undefined, 'spam');

    expect(success).toBe(true);
    expect(moderationService.isUserBlocked('user-3')).toBe(true);
  });

  it('mutes a user and tracks muted state', async () => {
    mockApiPost.mockResolvedValue({});

    const success = await moderationService.muteUser('user-4');

    expect(success).toBe(true);
    expect(moderationService.isUserMuted('user-4')).toBe(true);
  });
});
