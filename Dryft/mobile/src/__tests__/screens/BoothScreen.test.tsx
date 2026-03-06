import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import BoothScreen from '../../screens/companion/BoothScreen';

describe('BoothScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders booth list', () => {
    render(<BoothScreen />);

    expect(screen.getByText('Private Booths')).toBeTruthy();
    expect(screen.getByText('Couples Lounge')).toBeTruthy();
    expect(screen.getByText('Private Party')).toBeTruthy();
  });

  it('shows lock indicator for invite-only booths', () => {
    render(<BoothScreen />);

    expect(screen.getByText('🔒 Invite Only')).toBeTruthy();
  });

  it('navigates to companion flow when booth is selected', () => {
    render(<BoothScreen />);

    fireEvent.press(screen.getByText('Couples Lounge'));

    expect((global as any).__mockNavigation.navigate).toHaveBeenCalledWith('Companion', {
      boothId: 'booth-1',
    });
  });

  it('renders empty state when no booths are available', () => {
    render(<BoothScreen booths={[]} />);

    expect(screen.getByText('No booths available')).toBeTruthy();
  });
});
