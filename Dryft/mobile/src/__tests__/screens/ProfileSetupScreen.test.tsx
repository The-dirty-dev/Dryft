import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import ProfileBioScreen from '../../screens/onboarding/ProfileBioScreen';

const mockSetProfileBio = jest.fn();
const mockSetInterests = jest.fn();
const mockCompleteStep = jest.fn();

jest.mock('../../store/onboardingStore', () => ({
  useOnboardingStore: () => ({
    profileData: {
      bio: '',
      interests: [],
    },
    setProfileBio: mockSetProfileBio,
    setInterests: mockSetInterests,
    completeStep: mockCompleteStep,
  }),
  getStepProgress: () => 0.4,
}));

describe('ProfileSetupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders profile setup form fields', () => {
    render(<ProfileBioScreen />);

    expect(screen.getByText('About You')).toBeTruthy();
    expect(screen.getByPlaceholderText('Write something about yourself...')).toBeTruthy();
    expect(screen.getByText('Interests')).toBeTruthy();
  });

  it('validates required bio length hint', () => {
    render(<ProfileBioScreen />);

    expect(screen.getByText('20 more characters')).toBeTruthy();
  });

  it('submits profile setup when continue is pressed', () => {
    render(<ProfileBioScreen />);

    fireEvent.changeText(screen.getByPlaceholderText('Write something about yourself...'), 'I love VR dates and music.');
    fireEvent.press(screen.getByText('Continue'));

    expect(mockSetProfileBio).toHaveBeenCalled();
    expect(mockCompleteStep).toHaveBeenCalledWith('profile_bio');
  });
});
