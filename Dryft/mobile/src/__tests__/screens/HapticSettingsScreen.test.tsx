import React from 'react';
import { render, screen } from '@testing-library/react-native';
import HapticSettingsScreen from '../../screens/settings/HapticSettingsScreen';

jest.mock('../../hooks/useHaptic', () => ({
  useHaptic: () => ({
    isConnected: false,
    isConnecting: false,
    isScanning: false,
    connectionError: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
    startScanning: jest.fn(),
    stopScanning: jest.fn(),
    localDevices: [],
    backendDevices: [],
    vibrate: jest.fn(),
    stopDevice: jest.fn(),
    stopAllDevices: jest.fn(),
    updateDeviceSettings: jest.fn(),
    removeDevice: jest.fn(),
  }),
}));

describe('HapticSettingsScreen', () => {
  it('renders the connection prompt when disconnected', () => {
    render(<HapticSettingsScreen />);

    expect(screen.getByText('Intiface Central')).toBeTruthy();
    expect(screen.getByText('Connect to Intiface')).toBeTruthy();
    expect(screen.getByText('Download Intiface Central')).toBeTruthy();
  });
});
