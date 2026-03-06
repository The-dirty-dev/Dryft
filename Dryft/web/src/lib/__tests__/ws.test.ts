import { afterEach, describe, expect, it, vi } from 'vitest';

describe('lib/ws', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_WS_URL;
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses explicit NEXT_PUBLIC_WS_URL when provided', async () => {
    process.env.NEXT_PUBLIC_WS_URL = 'wss://api.dryft.site/v1/ws';

    const ws = await import('@/lib/ws');

    expect(ws.getWebSocketURL()).toBe('wss://api.dryft.site/v1/ws');
  });

  it('falls back to default production ws url', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const ws = await import('@/lib/ws');

    expect(ws.DEFAULT_WS_URL).toBe('ws://api.dryft.site:8080/v1/ws');
  });

  it('falls back to default dev ws url', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const ws = await import('@/lib/ws');

    expect(ws.DEFAULT_WS_URL).toBe('ws://localhost:8080/v1/ws');
  });
});
