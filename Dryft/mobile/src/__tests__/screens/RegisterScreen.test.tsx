import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import RegisterScreen from '../../screens/auth/RegisterScreen';

const mockRegister = jest.fn();
const mockClearError = jest.fn();

jest.mock('../../store/authStore', () => ({
  useAuthStore: () => ({
    register: mockRegister,
    isLoading: false,
    error: null,
    clearError: mockClearError,
  }),
}));

describe('RegisterScreen', () => {
  it('shows validation error when passwords do not match', () => {
    render(<RegisterScreen navigation={{ navigate: jest.fn() } as any} />);

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'user@dryft.site');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'password123');
    fireEvent.changeText(screen.getByPlaceholderText('Confirm Password'), 'password124');

    fireEvent.press(screen.getByText('Create Account'));

    expect(screen.getByText('Passwords do not match')).toBeTruthy();
  });
});
