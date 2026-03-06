import { beforeEach, describe, expect, it, vi } from 'vitest';

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    const parsed = JSON.parse(data)[0];
    const key = Object.keys(parsed)[0];
    const id = parsed[key].Id;

    if (key === 'RequestServerInfo') {
      this.onmessage?.({ data: JSON.stringify([{ ServerInfo: { Id: id } }]) } as MessageEvent);
    }
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: 1000, reason: 'closed' } as CloseEvent);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }
}

describe('lib/intiface', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    MockWebSocket.instances = [];
    (globalThis as any).WebSocket = MockWebSocket;
    const mod = await import('@/lib/intiface');
    mod.default.disconnect();
  });

  it('connects via websocket and performs handshake', async () => {
    const intiface = (await import('@/lib/intiface')).default;

    const promise = intiface.connect('ws://127.0.0.1:12345');
    expect(MockWebSocket.instances).toHaveLength(1);

    MockWebSocket.instances[0].open();
    const connected = await promise;

    expect(connected).toBe(true);
    expect(intiface.isConnected).toBe(true);
  });

  it('returns error when sending command while disconnected', async () => {
    const intiface = (await import('@/lib/intiface')).default;

    await expect(intiface.vibrate(1, 0.5)).rejects.toThrow();
  });

  it('cleans up disconnect state and notifies callback', async () => {
    const intiface = (await import('@/lib/intiface')).default;
    const onDisconnected = vi.fn();

    intiface.setCallbacks({ onDisconnected });

    const promise = intiface.connect('ws://127.0.0.1:12345');
    MockWebSocket.instances[0].open();
    await promise;

    intiface.disconnect();

    expect(intiface.isConnected).toBe(false);
    expect(onDisconnected).toHaveBeenCalled();
  });
});
