import React from 'react';
import { render, screen } from '@testing-library/react-native';
import SettingsScreen from '../../screens/settings/SettingsScreen';

const mockLogout = jest.fn();
const mockDeleteAccount = jest.fn().mockResolvedValue({ success: true });

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
});
