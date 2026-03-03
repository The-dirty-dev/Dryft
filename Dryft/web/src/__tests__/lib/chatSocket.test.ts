import { beforeEach, describe, expect, it, vi } from 'vitest';

const getWebSocketURL = vi.hoisted(() => vi.fn(() => 'ws://socket.test/v1/ws'));

vi.mock('@/lib/ws', () => ({
  getWebSocketURL,
}));

import chatSocketService from '@/lib/chatSocket';

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  static instances: MockWebSocket[] = [];

  url: string;
  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];

  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  emitClose(code = 1006, reason = 'closed') {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason } as CloseEvent);
  }

  emitMessage(data: string) {
    this.onmessage?.({ data } as MessageEvent);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code?: number, reason?: string) {
    this.emitClose(code ?? 1000, reason ?? 'closed');
  }
}

describe('chatSocketService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
    MockWebSocket.instances = [];
    (globalThis as any).WebSocket = MockWebSocket;
    chatSocketService.disconnect();
  });

  it('connects and disconnects with lifecycle handlers', async () => {
    const onConnected = vi.fn();
    const onDisconnected = vi.fn();
    chatSocketService.setTokenGetter(() => 'token-123');
    chatSocketService.setHandlers({ onConnected, onDisconnected });

    const promise = chatSocketService.connect();
    expect(MockWebSocket.instances).toHaveLength(1);

    MockWebSocket.instances[0].open();
    await promise;

    expect(onConnected).toHaveBeenCalledTimes(1);
    expect(MockWebSocket.instances[0].url).toContain('?token=token-123');

    chatSocketService.disconnect();
    expect(onDisconnected).toHaveBeenCalled();
  });

  it('rejects connection when auth token is missing', async () => {
    chatSocketService.setTokenGetter(() => null);

    await expect(chatSocketService.connect()).rejects.toThrow('No auth token');
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('schedules reconnect with exponential backoff after disconnect', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    chatSocketService.setTokenGetter(() => 'token');
    const promise = chatSocketService.connect();
    MockWebSocket.instances[0].open();
    await promise;

    MockWebSocket.instances[0].emitClose(1006, 'network');

    expect(setTimeoutSpy).toHaveBeenCalled();
    expect(setTimeoutSpy.mock.calls[0][1]).toBe(1000);
  });

  it('forwards incoming new_message events to handlers', async () => {
    const onNewMessage = vi.fn();
    chatSocketService.setTokenGetter(() => 'token');
    chatSocketService.setHandlers({ onNewMessage });

    const promise = chatSocketService.connect();
    MockWebSocket.instances[0].open();
    await promise;

    MockWebSocket.instances[0].emitMessage(
      JSON.stringify({
        type: 'new_message',
        payload: {
          id: 'm1',
          conversation_id: 'c1',
          sender_id: 'u1',
          type: 'text',
          content: 'hello',
          created_at: Date.now(),
        },
        ts: Date.now(),
      })
    );

    expect(onNewMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'm1', content: 'hello' })
    );
  });
});
