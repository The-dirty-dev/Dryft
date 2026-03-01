let useVerificationStore: typeof import('../store/verificationStore').useVerificationStore;

jest.mock('../api/client', () => ({
  __esModule: true,
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const getMockApi = () =>
  (jest.requireMock('../api/client') as {
    api: { get: jest.Mock; post: jest.Mock };
  }).api;

const baseState = {
  verifications: {
    photo: { type: 'photo', status: 'none' },
    phone: { type: 'phone', status: 'none' },
    email: { type: 'email', status: 'none' },
    id: { type: 'id', status: 'none' },
    social: { type: 'social', status: 'none' },
  },
  isLoading: false,
  error: null,
};

describe('verificationStore', () => {
  beforeAll(() => {
    ({ useVerificationStore } = require('../store/verificationStore'));
  });

  beforeAll(() => {
    if (typeof FormData === 'undefined') {
      (global as any).FormData = class {
        append = jest.fn();
      };
    }
  });

  beforeEach(() => {
    const api = getMockApi();
    api.get.mockReset();
    api.post.mockReset();
    useVerificationStore.setState(baseState, false);
  });

  it('fetches verification status and updates store', async () => {
    const api = getMockApi();
    api.get.mockResolvedValue({
      data: {
        verifications: [
          {
            type: 'photo',
            status: 'approved',
            submitted_at: '2024-01-01T00:00:00Z',
            reviewed_at: '2024-01-02T00:00:00Z',
          },
        ],
      },
    });

    await useVerificationStore.getState().fetchVerificationStatus();

    const state = useVerificationStore.getState();
    expect(state.verifications.photo.status).toBe('approved');
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('submits photo verification and marks pending on success', async () => {
    const api = getMockApi();
    api.post.mockResolvedValue({
      data: { success: true },
    });

    const result = await useVerificationStore
      .getState()
      .submitPhotoVerification('file://photo.jpg', 'center');

    const state = useVerificationStore.getState();
    expect(result).toBe(true);
    expect(state.verifications.photo.status).toBe('pending');
    expect(state.isLoading).toBe(false);
  });

  it('verifies phone code and marks phone approved on success', async () => {
    const api = getMockApi();
    api.post.mockResolvedValue({
      data: { success: true },
    });

    const result = await useVerificationStore
      .getState()
      .verifyPhoneCode('verification-1', '123456');

    const state = useVerificationStore.getState();
    expect(result).toBe(true);
    expect(state.verifications.phone.status).toBe('approved');
    expect(state.isLoading).toBe(false);
  });

  it('verifies email and marks email approved on success', async () => {
    const api = getMockApi();
    api.post.mockResolvedValue({
      data: { success: true },
    });

    const result = await useVerificationStore.getState().verifyEmailCode('token-123');

    const state = useVerificationStore.getState();
    expect(result).toBe(true);
    expect(state.verifications.email.status).toBe('approved');
    expect(state.isLoading).toBe(false);
  });

  it('returns false and sets error when verification fails', async () => {
    const api = getMockApi();
    api.post.mockResolvedValue({
      data: { success: false, error: 'Invalid code' },
    });

    const result = await useVerificationStore
      .getState()
      .verifyPhoneCode('verification-2', 'badcode');

    const state = useVerificationStore.getState();
    expect(result).toBe(false);
    expect(state.error).toBe('Invalid code');
    expect(state.isLoading).toBe(false);
  });
});

export {};
