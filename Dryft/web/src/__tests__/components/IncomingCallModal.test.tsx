import { render, screen, fireEvent } from '@testing-library/react';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import IncomingCallModal from '@/components/calls/IncomingCallModal';

const mockSignaling = vi.hoisted(() => ({
  rejectCall: vi.fn(),
}));

vi.mock('@/lib/callSignaling', () => ({
  __esModule: true,
  callSignalingService: mockSignaling,
  default: mockSignaling,
}));

describe('IncomingCallModal', () => {
  const play = vi.fn(() => Promise.resolve());
  const pause = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    mockSignaling.rejectCall.mockReset();

    (globalThis as any).Audio = vi.fn(() => ({
      loop: false,
      play,
      pause,
    }));
  });

  it('renders caller details and plays ringtone on mount', () => {
    render(
      <IncomingCallModal
        call={{
          callId: 'call-1',
          callerId: 'user-1',
          callerName: 'Taylor',
          callerPhoto: undefined,
          videoEnabled: true,
          matchId: 'match-1',
        }}
        onAccept={() => {}}
        onDecline={() => {}}
      />
    );

    expect(screen.getByText('Taylor')).toBeInTheDocument();
    expect(screen.getByText('Incoming Video Call')).toBeInTheDocument();
    expect(play).toHaveBeenCalled();
  });

  it('accept button triggers onAccept and stops ringtone', () => {
    const onAccept = vi.fn();

    render(
      <IncomingCallModal
        call={{
          callId: 'call-1',
          callerId: 'user-1',
          callerName: 'Taylor',
          videoEnabled: false,
          matchId: 'match-1',
        }}
        onAccept={onAccept}
        onDecline={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /accept/i }));

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(pause).toHaveBeenCalled();
  });

  it('decline button triggers rejectCall and onDecline', () => {
    const onDecline = vi.fn();

    render(
      <IncomingCallModal
        call={{
          callId: 'call-77',
          callerId: 'user-2',
          callerName: 'Alex',
          videoEnabled: false,
          matchId: 'match-2',
        }}
        onAccept={() => {}}
        onDecline={onDecline}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /decline/i }));

    expect(mockSignaling.rejectCall).toHaveBeenCalledWith('call-77', 'user-2', 'declined');
    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(pause).toHaveBeenCalled();
  });
});
