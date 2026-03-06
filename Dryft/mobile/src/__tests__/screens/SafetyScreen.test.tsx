import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import SafetyScreen from '../../screens/onboarding/SafetyScreen';

const mockCompleteStep = jest.fn();

jest.mock('../../store/onboardingStore', () => ({
  useOnboardingStore: () => ({
    completeStep: mockCompleteStep,
  }),
  getStepProgress: () => 0.5,
}));

describe('SafetyScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders safety guidance and continue action', () => {
    render(<SafetyScreen />);

    expect(screen.getByText('Your Safety Matters')).toBeTruthy();
    expect(screen.getByText('I Understand')).toBeTruthy();
  });

  it('shows core safety tool descriptions', () => {
    render(<SafetyScreen />);

    expect(screen.getByText('Panic Button')).toBeTruthy();
    expect(screen.getByText('Report & Review')).toBeTruthy();
  });

  it('completes onboarding step when continue is pressed', () => {
    render(<SafetyScreen />);

    fireEvent.press(screen.getByText('I Understand'));

    expect(mockCompleteStep).toHaveBeenCalledWith('safety');
  });
});
