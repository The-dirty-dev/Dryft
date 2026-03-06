import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import VerificationStatusScreen from '../../screens/verification/VerificationStatusScreen';
import apiClient from '../../api/client';

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

describe('VerificationStatusScreen', () => {
  it('renders verification steps when pending', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        stripe_verified: false,
        jumio_verified: false,
        face_match_passed: false,
        overall_status: 'pending',
      },
    });

    render(<VerificationStatusScreen />);

    await waitFor(() => {
      expect(screen.getByText('Age Verification')).toBeTruthy();
    });

    expect(screen.getByText('Card Verification')).toBeTruthy();
    expect(screen.getByText('ID Verification')).toBeTruthy();
    expect(screen.getByText('Face Match')).toBeTruthy();
    expect(screen.getByText('Start Verification')).toBeTruthy();
  }, 15000);
});
