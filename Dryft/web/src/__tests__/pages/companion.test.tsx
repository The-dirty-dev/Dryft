import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CompanionPage from '@/app/companion/page';

const companionState = vi.hoisted(() => ({
  value: {
    isConnected: false,
    isJoining: false,
    error: null as string | null,
    session: null as any,
    vrState: null as any,
    chatMessages: [] as any[],
    joinSession: vi.fn(async () => {}),
    leaveSession: vi.fn(),
    sendChat: vi.fn(),
    sendHaptic: vi.fn(),
    setHapticPermission: vi.fn(),
  },
}));

vi.mock('@/hooks/useCompanionSession', () => ({
  useCompanionSession: () => companionState.value,
}));

vi.mock('@/hooks/useHaptic', () => ({
  useHaptic: () => ({
    isConnected: true,
    localDevices: [],
  }),
}));

describe('CompanionPage', () => {
  beforeEach(() => {
    (Element.prototype as any).scrollIntoView = vi.fn();
    companionState.value.isConnected = false;
    companionState.value.isJoining = false;
    companionState.value.error = null;
    companionState.value.session = null;
    companionState.value.vrState = null;
    companionState.value.chatMessages = [];
    companionState.value.joinSession.mockReset();
    companionState.value.leaveSession.mockReset();
  });

  it('renders join session screen when no active session', () => {
    render(<CompanionPage />);

    expect(screen.getByText('Join VR Session')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join Session' })).toBeDisabled();
  });

  it('submits join action when valid session code is entered', async () => {
    render(<CompanionPage />);

    fireEvent.change(screen.getByPlaceholderText('000000'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Join Session' }));

    await waitFor(() => {
      expect(companionState.value.joinSession).toHaveBeenCalledWith('123456', undefined);
    });
  });

  it('renders session view and supports leaving session', () => {
    companionState.value.session = {
      session: {
        id: 'session-1',
        session_code: '654321',
      },
      participants: [
        {
          user_id: 'vr-user',
          display_name: 'VR Partner',
          device_type: 'vr',
        },
      ],
    };

    render(<CompanionPage />);

    expect(screen.getByText(/Session: 654321/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(companionState.value.leaveSession).toHaveBeenCalled();
  });
});
