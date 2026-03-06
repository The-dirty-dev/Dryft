import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import MatchesScreen from '../../screens/discover/MatchesScreen';

const mockLoadMatches = jest.fn();
const mockUnmatch = jest.fn();

let mockState: any = {};

jest.mock('../../store/matchingStore', () => ({
  useMatchingStore: () => mockState,
}));

jest.mock('../../hooks/useChatSocket', () => ({
  useChatSocket: jest.fn(),
}));

describe('MatchScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState = {
      matches: [
        {
          id: 'match-1',
          matched_at: new Date().toISOString(),
          unread_count: 0,
          other_user: {
            id: 'user-2',
            display_name: 'Riley',
            profile_photo: null,
          },
        },
      ],
      isLoadingMatches: false,
      loadMatches: mockLoadMatches,
      unmatch: mockUnmatch,
    };
  });

  it('renders match card when matches exist', () => {
    render(<MatchesScreen />);

    expect(screen.getByText('Riley')).toBeTruthy();
  });

  it('navigates to chat when a match is pressed', () => {
    render(<MatchesScreen />);

    fireEvent.press(screen.getByText('Riley'));

    expect((global as any).__mockNavigation.navigate).toHaveBeenCalled();
  });

  it('renders empty state when there are no matches', () => {
    mockState = {
      ...mockState,
      matches: [],
    };

    render(<MatchesScreen />);

    expect(screen.getByText('No matches yet')).toBeTruthy();
    expect(screen.getByText('Start Discovering')).toBeTruthy();
  });
});
