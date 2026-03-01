import chatSocketService from '../../services/chatSocket';

jest.mock('@/config', () => ({
  API_BASE_URL: 'http://localhost:8080',
}), { virtual: true });

jest.mock('@/store/authStore', () => ({
  getToken: jest.fn(),
}));

describe('chatSocketService', () => {
  let socketInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const { getToken } = jest.requireMock('@/store/authStore');
    (getToken as jest.Mock).mockReset();

    class TestWebSocket {
      static OPEN = 1;
      onopen: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: ((error: any) => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      readyState = 1;

      constructor(public url: string) {
        socketInstance = this;
      }

      send = jest.fn();
      close = jest.fn();
    }

    (global as any).WebSocket = TestWebSocket as any;
  });

  it('rejects connection when no token', async () => {
    const { getToken } = jest.requireMock('@/store/authStore');
    (getToken as jest.Mock).mockReturnValue(null);

    await expect(chatSocketService.connect()).rejects.toThrow('No auth token');
  });

  it('connects and subscribes to conversations', async () => {
    const { getToken } = jest.requireMock('@/store/authStore');
    (getToken as jest.Mock).mockReturnValue('token-123');

    const connectPromise = chatSocketService.connect();
    socketInstance.onopen?.();
    await connectPromise;

    chatSocketService.subscribe('conv-1');

    expect(socketInstance.url).toBe('ws://localhost:8080/v1/ws');
    expect(socketInstance.send).toHaveBeenCalledWith(
      expect.stringContaining('subscribe')
    );

    chatSocketService.disconnect();
  });
});
