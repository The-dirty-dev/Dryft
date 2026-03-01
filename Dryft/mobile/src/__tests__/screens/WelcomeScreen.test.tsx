import React from 'react';
import { render, screen } from '@testing-library/react-native';
import WelcomeScreen from '../../screens/onboarding/WelcomeScreen';

const mockCompleteStep = jest.fn();

jest.mock('../../store/onboardingStore', () => ({
  useOnboardingStore: () => ({
    completeStep: mockCompleteStep,
  }),
}));

describe('WelcomeScreen', () => {
  it('renders welcome content', () => {
    render(<WelcomeScreen />);

    expect(screen.getByText('Dryft')).toBeTruthy();
    expect(screen.getByText('Meet real people in virtual reality')).toBeTruthy();
    expect(screen.getByText('Get Started')).toBeTruthy();
  });
});
