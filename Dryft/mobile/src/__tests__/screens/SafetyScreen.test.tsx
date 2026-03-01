import React from 'react';
import { render, screen } from '@testing-library/react-native';
import SafetyScreen from '../../screens/onboarding/SafetyScreen';

const mockCompleteStep = jest.fn();

jest.mock('../../store/onboardingStore', () => ({
  useOnboardingStore: () => ({
    completeStep: mockCompleteStep,
  }),
  getStepProgress: () => 0.5,
}));

describe('SafetyScreen', () => {
  it('renders safety guidance and continue action', () => {
    render(<SafetyScreen />);

    expect(screen.getByText('Your Safety Matters')).toBeTruthy();
    expect(screen.getByText('I Understand')).toBeTruthy();
  });
});
