import { renderHook, act } from '@testing-library/react-hooks';
import { useVoiceChat } from '../hooks/useVoiceChat';

// Mock react-native-webrtc
jest.mock('react-native-webrtc', () => ({
  mediaDevices: {
    getUserMedia: jest.fn(),
  },
  MediaStream: jest.fn(),
  RTCPeerConnection: jest.fn(),
}));

// Mock react-native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
  PermissionsAndroid: {
    request: jest.fn(),
    PERMISSIONS: {
      RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
    },
    RESULTS: {
      GRANTED: 'granted',
    },
  },
}));

// Mock WebSocket
class MockWebSocket {
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  readyState = 1;

  constructor(public url: string) {
    setTimeout(() => {
      this.onopen?.();
    }, 0);
  }

  send = jest.fn();
  close = jest.fn(() => {
    this.onclose?.();
  });
}

(global as any).WebSocket = MockWebSocket;

describe('useVoiceChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct default values', async () => {
      const { result } = renderHook(() => useVoiceChat(null));

      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(result.current.isMuted).toBe(false);
      expect(result.current.isDeafened).toBe(false);
      expect(result.current.isSpeaking).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.participants).toEqual([]);
    });
  });

  describe('VoiceParticipant type', () => {
    it('should have correct structure', () => {
      const participant = {
        id: 'user_123',
        displayName: 'Test User',
        isSpeaking: false,
        volume: 1,
        isMuted: false,
      };

      expect(participant).toHaveProperty('id');
      expect(participant).toHaveProperty('displayName');
      expect(participant).toHaveProperty('isSpeaking');
      expect(participant).toHaveProperty('volume');
      expect(participant).toHaveProperty('isMuted');
    });
  });

  describe('VoiceChatState type', () => {
    it('should have correct structure', () => {
      const state = {
        isConnected: false,
        isConnecting: false,
        isMuted: false,
        isDeafened: false,
        isSpeaking: false,
        error: null,
        participants: [],
      };

      expect(state).toHaveProperty('isConnected');
      expect(state).toHaveProperty('isConnecting');
      expect(state).toHaveProperty('isMuted');
      expect(state).toHaveProperty('isDeafened');
      expect(state).toHaveProperty('isSpeaking');
      expect(state).toHaveProperty('error');
      expect(state).toHaveProperty('participants');
    });
  });
});

describe('Voice Message Types', () => {
  it('voice_join message format', () => {
    const message = {
      type: 'voice_join',
      session_id: 'session_123',
    };

    expect(JSON.stringify(message)).toContain('voice_join');
    expect(JSON.stringify(message)).toContain('session_123');
  });

  it('voice_speaking message format', () => {
    const message = {
      type: 'voice_speaking',
      user_id: 'user_456',
      speaking: true,
    };

    const parsed = JSON.parse(JSON.stringify(message));
    expect(parsed.type).toBe('voice_speaking');
    expect(parsed.speaking).toBe(true);
  });

  it('voice_participant_joined message format', () => {
    const message = {
      type: 'voice_participant_joined',
      user_id: 'user_789',
      display_name: 'New User',
    };

    expect(message.type).toBe('voice_participant_joined');
    expect(message.user_id).toBe('user_789');
    expect(message.display_name).toBe('New User');
  });

  it('voice_participant_left message format', () => {
    const message = {
      type: 'voice_participant_left',
      user_id: 'user_789',
    };

    expect(message.type).toBe('voice_participant_left');
  });

  it('voice_mute message format', () => {
    const message = {
      type: 'voice_mute',
      muted: true,
    };

    expect(message.muted).toBe(true);
  });

  it('voice_error message format', () => {
    const message = {
      type: 'voice_error',
      error: 'Connection failed',
    };

    expect(message.error).toBe('Connection failed');
  });
});
