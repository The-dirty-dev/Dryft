import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient, { API_ERROR_EVENT } from '@/lib/api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    apiClient.clearTokens();
  });

  it('adds auth header when access token is present', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: true }));

    apiClient.saveTokens({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
    });

    await apiClient.get('/v1/profile');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/profile'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
      })
    );
  });

  it('retries request after refresh on 401', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/v1/auth/refresh')) {
        return Promise.resolve(
          jsonResponse(
            {
              tokens: {
                access_token: 'new-access',
                refresh_token: 'new-refresh',
                expires_in: 3600,
              },
            },
            200
          )
        );
      }

      // First request fails with 401, second succeeds.
      const previousCalls = fetchMock.mock.calls.filter((call) => String(call[0]).includes('/v1/protected')).length;
      if (previousCalls <= 1) {
        return Promise.resolve(jsonResponse({ error: 'unauthorized' }, 401));
      }
      return Promise.resolve(jsonResponse({ value: 'ok' }, 200));
    });

    apiClient.saveTokens({
      access_token: 'expired',
      refresh_token: 'refresh-token',
      expires_in: 3600,
    });

    const result = await apiClient.get<{ value: string }>('/v1/protected');

    expect(result.success).toBe(true);
    expect(result.data?.value).toBe('ok');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('supports GET/POST/PUT/DELETE helper methods', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(jsonResponse({ ok: true })));

    await apiClient.get('/v1/a');
    await apiClient.post('/v1/b', { x: 1 });
    await apiClient.put('/v1/c', { y: 2 });
    await apiClient.delete('/v1/d');

    const methods = fetchMock.mock.calls.map((call) => (call[1] as RequestInit)?.method);
    expect(methods).toEqual(['GET', 'POST', 'PUT', 'DELETE']);
  });

  it('parses error responses and emits api error event for server failures', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ error: 'server exploded' }, 500));

    const result = await apiClient.get('/v1/fail');

    expect(result.success).toBe(false);
    expect(result.error).toBe('server exploded');
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: API_ERROR_EVENT,
      })
    );
  });

  it('resolves base URL from NEXT_PUBLIC_API_BASE_URL on module load', async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.example.test';
    process.env.NEXT_PUBLIC_API_URL = 'https://fallback.example.test';

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: true }));
    const mod = await import('@/lib/api');

    await mod.default.get('/v1/path');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://api.example.test/v1/path'),
      expect.any(Object)
    );
  });
});
