import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockChatSocket = vi.hoisted(() => ({
  sendCallSignal: vi.fn(),
  isConnected: vi.fn(() => true),
}));

vi.mock('@/lib/chatSocket', () => ({
  __esModule: true,
  default: mockChatSocket,
}));

import callSignalingService from '@/lib/callSignaling';

describe('callSignalingService', () => {
  beforeEach(() => {
    mockChatSocket.sendCallSignal.mockReset();
    mockChatSocket.isConnected.mockReset();
    mockChatSocket.isConnected.mockReturnValue(true);
    callSignalingService.disconnect();
  });

  it('maps incoming call request payload to handler shape', () => {
    const onIncomingCall = vi.fn();
    callSignalingService.setHandlers({ onIncomingCall });

    callSignalingService.handleCallEvent('call_request', {
      call_id: 'call-1',
      caller_id: 'user-a',
      caller_name: 'Alex',
      caller_photo: 'photo.jpg',
      video_enabled: true,
      match_id: 'match-1',
    });

    expect(onIncomingCall).toHaveBeenCalledWith(
      expect.objectContaining({
        callId: 'call-1',
        callerId: 'user-a',
        callerName: 'Alex',
        videoEnabled: true,
      })
    );
  });

  it('initiates and ends calls through chat socket signaling', () => {
    callSignalingService.initiateCall('call-2', 'target-user', 'match-2', false);
    expect(callSignalingService.getCurrentCallId()).toBe('call-2');
    expect(mockChatSocket.sendCallSignal).toHaveBeenCalledWith(
      'call_request',
      expect.objectContaining({ call_id: 'call-2', target_user_id: 'target-user' })
    );

    callSignalingService.endCall('target-user');
    expect(mockChatSocket.sendCallSignal).toHaveBeenCalledWith(
      'call_end',
      expect.objectContaining({ call_id: 'call-2', target_user_id: 'target-user' })
    );
    expect(callSignalingService.getCurrentCallId()).toBeNull();
  });

  it('forwards WebRTC offer and candidate payloads', () => {
    callSignalingService.initiateCall('call-3', 'target', 'match', true);

    callSignalingService.sendOffer('target', { type: 'offer', sdp: 'abc' });
    expect(mockChatSocket.sendCallSignal).toHaveBeenCalledWith(
      'call_offer',
      expect.objectContaining({ call_id: 'call-3', target_user_id: 'target', sdp: { type: 'offer', sdp: 'abc' } })
    );

    callSignalingService.sendIceCandidate('target', {
      candidate: 'candidate:1',
      sdpMid: '0',
      sdpMLineIndex: 0,
    } as RTCIceCandidate);

    expect(mockChatSocket.sendCallSignal).toHaveBeenCalledWith(
      'call_candidate',
      expect.objectContaining({
        call_id: 'call-3',
        target_user_id: 'target',
        candidate: expect.objectContaining({ candidate: 'candidate:1' }),
      })
    );
  });

  it('reports signaling connection state from chat socket', () => {
    mockChatSocket.isConnected.mockReturnValue(false);
    expect(callSignalingService.isConnectedToSignaling()).toBe(false);
  });
});
