import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSession,
  joinSession,
  getSession,
  endSession,
  leaveSession,
  sendSessionChat,
} from '@/lib/sessionApi';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  __esModule: true,
  default: mockApiClient,
}));

describe('sessionApi', () => {
  beforeEach(() => {
    mockApiClient.get.mockReset();
    mockApiClient.post.mockReset();
    mockApiClient.delete.mockReset();
  });

  it('creates and joins sessions with expected payload', async () => {
    await createSession({ max_participants: 4 });
    await joinSession({ session_code: '123456', device_type: 'mobile', display_name: 'Taylor' });

    expect(mockApiClient.post).toHaveBeenCalledWith('/v1/sessions', { max_participants: 4 });
    expect(mockApiClient.post).toHaveBeenCalledWith('/v1/sessions/join', {
      session_code: '123456',
      device_type: 'mobile',
      display_name: 'Taylor',
    });
  });

  it('fetches and ends session by id', async () => {
    await getSession('session-1');
    await endSession('session-1');

    expect(mockApiClient.get).toHaveBeenCalledWith('/v1/sessions/session-1');
    expect(mockApiClient.delete).toHaveBeenCalledWith('/v1/sessions/session-1');
  });

  it('sends leave and chat actions to session endpoints', async () => {
    await leaveSession('session-2');
    await sendSessionChat('session-2', 'hello from companion');

    expect(mockApiClient.post).toHaveBeenCalledWith('/v1/sessions/session-2/leave', {});
    expect(mockApiClient.post).toHaveBeenCalledWith('/v1/sessions/session-2/chat', { content: 'hello from companion' });
  });
});
