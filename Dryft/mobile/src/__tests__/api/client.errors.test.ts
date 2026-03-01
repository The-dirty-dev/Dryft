import apiClient from '../../api/client';
import { useNetworkStore } from '../../utils/errorHandler';
import { ERROR_CODES } from '../../types';

const fetchMock = global.fetch as jest.Mock;

const makeResponse = (status: number, body: unknown, headers?: Record<string, string>) => ({
  ok: status >= 200 && status < 300,
  status,
  text: jest.fn().mockResolvedValue(body ? JSON.stringify(body) : ''),
  headers: {
    get: (key: string) => headers?.[key] ?? null,
  },
});

describe('apiClient error paths', () => {
  beforeEach(async () => {
    fetchMock.mockReset();
    useNetworkStore.setState({
      isConnected: true,
      isInternetReachable: true,
      connectionType: 'wifi',
    });
    await apiClient.clearTokens();
  });

  it('maps 400 validation errors', async () => {
    fetchMock.mockResolvedValue(makeResponse(400, { error: 'Bad input' }));

    const result = await apiClient.get('/test');

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.VALIDATION);
    expect(result.error).toBe('Bad input');
    expect(result.status).toBe(400);
  });

  it('maps 401 auth errors', async () => {
    fetchMock.mockResolvedValue(makeResponse(401, { error: 'Unauthorized' }));

    const result = await apiClient.get('/test');

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.AUTH);
    expect(result.status).toBe(401);
  });

  it('maps 403 auth errors', async () => {
    fetchMock.mockResolvedValue(makeResponse(403, { error: 'Forbidden' }));

    const result = await apiClient.get('/test');

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.AUTH);
    expect(result.status).toBe(403);
  });

  it('maps 404 not found errors', async () => {
    fetchMock.mockResolvedValue(makeResponse(404, { error: 'Not found' }));

    const result = await apiClient.get('/test');

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.NOT_FOUND);
    expect(result.status).toBe(404);
  });

  it('maps 429 rate limit errors with retry-after', async () => {
    fetchMock.mockResolvedValue(makeResponse(429, { error: 'Too many requests' }, { 'Retry-After': '45' }));

    const result = await apiClient.get('/test');

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.RATE_LIMITED);
    expect(result.retryAfter).toBe(45);
  });

  it('maps 500 server errors', async () => {
    fetchMock.mockResolvedValue(makeResponse(500, { error: 'Server error' }));

    const result = await apiClient.get('/test');

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ERROR_CODES.SERVER);
    expect(result.status).toBe(500);
  });
});
