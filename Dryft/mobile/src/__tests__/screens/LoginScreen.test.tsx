import React from 'react';
import { render, screen } from '@testing-library/react-native';
import LoginScreen from '../../screens/auth/LoginScreen';

const mockLogin = jest.fn();
const mockClearError = jest.fn();

jest.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    login: mockLogin,
    isLoading: false,
    error: null,
    clearError: mockClearError,
  }),
}));

describe('LoginScreen', () => {
  it('renders login form elements', () => {
    render(<LoginScreen navigation={{ navigate: jest.fn() } as any} />);

    expect(screen.getByText('Dryft')).toBeTruthy();
    expect(screen.getByText('Welcome back')).toBeTruthy();
    expect(screen.getByText('Sign In')).toBeTruthy();
  });
});
