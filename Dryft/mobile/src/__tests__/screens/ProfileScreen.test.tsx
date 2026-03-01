import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ProfileScreen from '../../screens/main/ProfileScreen';

jest.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    user: {
      display_name: 'Alex',
      email: 'alex@dryft.site',
      verified: true,
    },
    logout: jest.fn(),
  }),
}));

describe('ProfileScreen', () => {
  it('renders user profile details', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('Alex')).toBeTruthy();
    expect(screen.getByText('Verified')).toBeTruthy();
  });
});
