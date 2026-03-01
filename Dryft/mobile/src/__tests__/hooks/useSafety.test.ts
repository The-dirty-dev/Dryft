import { renderHook, act } from '@testing-library/react-hooks';
import * as Haptics from 'expo-haptics';

const mockInitialize = jest.fn().mockResolvedValue(undefined);
const mockGetEmergencyContacts = jest.fn();
const mockAddEmergencyContact = jest.fn();
const mockRemoveEmergencyContact = jest.fn();
const mockVerifyContact = jest.fn();

jest.mock('../../services/safety', () => ({
  safetyService: {
    initialize: mockInitialize,
    getEmergencyContacts: mockGetEmergencyContacts,
    addEmergencyContact: mockAddEmergencyContact,
    removeEmergencyContact: mockRemoveEmergencyContact,
    verifyContact: mockVerifyContact,
    getSafetyTips: jest.fn().mockReturnValue([]),
    triggerEmergencyAlert: jest.fn(),
    callEmergencyServices: jest.fn(),
    getPendingSafetyChecks: jest.fn().mockReturnValue([]),
    scheduleSafetyCheck: jest.fn(),
    confirmSafetyCheck: jest.fn(),
    cancelSafetyCheck: jest.fn(),
    getLocationSettings: jest.fn().mockReturnValue({
      enabled: true,
      showExactLocation: false,
      showDistance: true,
      showCity: true,
      shareWithMatches: true,
    }),
    updateLocationSettings: jest.fn(),
    analyzeMessageForScams: jest.fn(),
  },
}));

// Late require to ensure mocks are registered first
const { useEmergencyContacts } = require('../../hooks/useSafety') as any;

describe('useEmergencyContacts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEmergencyContacts.mockReturnValue([
      {
        id: 'contact-1',
        name: 'Sam',
        phone: '123',
        relationship: 'Friend',
        isVerified: false,
      },
    ]);
    mockAddEmergencyContact.mockResolvedValue({
      id: 'contact-1',
      name: 'Sam',
      phone: '123',
      relationship: 'Friend',
      isVerified: false,
    });
  });

  it('loads contacts and allows adding a new one', async () => {
    const { result } = renderHook(() => useEmergencyContacts());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.contacts).toHaveLength(1);

    await act(async () => {
      await result.current.addContact('Sam', '123', 'Friend');
    });

    expect(mockAddEmergencyContact).toHaveBeenCalledWith('Sam', '123', 'Friend');
    expect(Haptics.impactAsync).toHaveBeenCalled();
  });
});
