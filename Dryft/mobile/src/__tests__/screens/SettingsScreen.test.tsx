import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import SettingsScreen from '../../screens/settings/SettingsScreen';

const mockLogout = jest.fn();
const mockDeleteAccount = jest.fn().mockResolvedValue({ success: true });

afterEach(() => {
  jest.clearAllMocks();
});

jest.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    user: { email: 'settings@dryft.site' },
    logout: mockLogout,
    deleteAccount: mockDeleteAccount,
    isLoading: false,
  }),
}));

describe('SettingsScreen', () => {
  it('renders key settings sections', () => {
    render(<SettingsScreen />);

    expect(screen.getByText('Account')).toBeTruthy();
    expect(screen.getByText('Haptic Device')).toBeTruthy();
    expect(screen.getByText('Notifications')).toBeTruthy();
    expect(screen.getByText('Security & Privacy')).toBeTruthy();
    expect(screen.getByText('settings@dryft.site')).toBeTruthy();
  });

  it('navigates to security settings from section row', () => {
    render(<SettingsScreen />);

    fireEvent.press(screen.getByText('Security Settings'));

    expect((global as any).__mockNavigation.navigate).toHaveBeenCalledWith('SecuritySettings');
  });

  it('opens delete account confirmation modal', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    render(<SettingsScreen />);

    fireEvent.press(screen.getByText('Delete Account'));

    expect(alertSpy).toHaveBeenCalled();
    const alertButtons = (alertSpy.mock.calls[0]?.[2] as Array<{ style?: string; onPress?: () => void }>) || [];
    const destructive = alertButtons.find((button) => button.style === 'destructive');
    destructive?.onPress?.();

    expect(screen.getByText('Confirm Account Deletion')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });
});
