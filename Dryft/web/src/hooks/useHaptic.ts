'use client';

import { useState, useEffect, useCallback } from 'react';
import intifaceService, { IntifaceDevice } from '@/lib/intiface';
import * as hapticApi from '@/lib/hapticApi';

export interface LocalDevice extends IntifaceDevice {
  battery?: number;
  synced: boolean;
  backendId?: string;
}

/**
 * React hook for Intiface device discovery, control, and backend sync.
 * @returns Connection state, device lists, and control helpers (vibrate/rotate/linear).
 * @example
 * const { connect, localDevices, vibrate } = useHaptic();
 * await connect();
 * if (localDevices[0]) await vibrate(localDevices[0].index, 0.5, 500);
 * @remarks
 * WebSocket events handled: none.
 */
export function useHaptic() {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Device state
  const [localDevices, setLocalDevices] = useState<LocalDevice[]>([]);
  const [backendDevices, setBackendDevices] = useState<hapticApi.HapticDevice[]>([]);

  // Set up Intiface callbacks
  useEffect(() => {
    intifaceService.setCallbacks({
      onDeviceAdded: handleDeviceAdded,
      onDeviceRemoved: handleDeviceRemoved,
      onDisconnected: handleDisconnected,
      onError: handleError,
    });

    // Check if already connected
    setIsConnected(intifaceService.isConnected);
    if (intifaceService.isConnected) {
      setLocalDevices(intifaceService.getDevices().map(d => ({ ...d, synced: false })));
    }

    // Load backend devices
    loadBackendDevices();

    return () => {
      intifaceService.setCallbacks({});
    };
  }, []);

  // ==========================================================================
  // Callbacks
  // ==========================================================================

  const handleDeviceAdded = useCallback(async (device: IntifaceDevice) => {
    const localDevice: LocalDevice = {
      ...device,
      synced: false,
    };

    // Try to get battery level
    if (device.messageTypes.BatteryLevelCmd) {
      try {
        const battery = await intifaceService.getBatteryLevel(device.index);
        localDevice.battery = Math.round(battery * 100);
      } catch (err) {
        console.log('[useHaptic] Could not get battery level:', err);
      }
    }

    setLocalDevices(prev => [...prev.filter(d => d.index !== device.index), localDevice]);

    // Auto-sync to backend
    await syncDeviceToBackend(localDevice);
  }, []);

  const handleDeviceRemoved = useCallback((deviceIndex: number) => {
    setLocalDevices(prev => prev.filter(d => d.index !== deviceIndex));
  }, []);

  const handleDisconnected = useCallback(() => {
    setIsConnected(false);
    setIsScanning(false);
    setLocalDevices([]);
    setConnectionError(null);
  }, []);

  const handleError = useCallback((error: string) => {
    setConnectionError(error);
  }, []);

  // ==========================================================================
  // Connection
  // ==========================================================================

  const connect = useCallback(async (url?: string) => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      const success = await intifaceService.connect(url);
      setIsConnected(success);
      if (!success) {
        setConnectionError('Could not connect to Intiface Central. Make sure it is running.');
      }
      return success;
    } catch (err) {
      setConnectionError(err instanceof Error ? err.message : 'Connection failed');
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    intifaceService.disconnect();
  }, []);

  // ==========================================================================
  // Scanning
  // ==========================================================================

  const startScanning = useCallback(async () => {
    if (!isConnected) {
      setConnectionError('Not connected to Intiface Central');
      return;
    }

    setIsScanning(true);
    try {
      await intifaceService.startScanning();

      // Auto-stop after 10 seconds
      setTimeout(async () => {
        try {
          await intifaceService.stopScanning();
        } catch {}
        setIsScanning(false);
      }, 10000);
    } catch (err) {
      setIsScanning(false);
      setConnectionError(err instanceof Error ? err.message : 'Failed to start scanning');
    }
  }, [isConnected]);

  const stopScanning = useCallback(async () => {
    try {
      await intifaceService.stopScanning();
    } catch {}
    setIsScanning(false);
  }, []);

  // ==========================================================================
  // Device Control
  // ==========================================================================

  const vibrate = useCallback(async (deviceIndex: number, intensity: number, durationMs?: number) => {
    try {
      await intifaceService.vibrate(deviceIndex, intensity);

      // Auto-stop after duration
      if (durationMs && durationMs > 0) {
        setTimeout(async () => {
          try {
            await intifaceService.stopDevice(deviceIndex);
          } catch {}
        }, durationMs);
      }
    } catch (err) {
      console.error('[useHaptic] Vibrate failed:', err);
      throw err;
    }
  }, []);

  const rotate = useCallback(async (deviceIndex: number, speed: number, clockwise: boolean = true) => {
    try {
      await intifaceService.rotate(deviceIndex, speed, clockwise);
    } catch (err) {
      console.error('[useHaptic] Rotate failed:', err);
      throw err;
    }
  }, []);

  const linear = useCallback(async (deviceIndex: number, position: number, duration: number) => {
    try {
      await intifaceService.linear(deviceIndex, position, duration);
    } catch (err) {
      console.error('[useHaptic] Linear failed:', err);
      throw err;
    }
  }, []);

  const stopDevice = useCallback(async (deviceIndex: number) => {
    try {
      await intifaceService.stopDevice(deviceIndex);
    } catch (err) {
      console.error('[useHaptic] Stop failed:', err);
    }
  }, []);

  const stopAllDevices = useCallback(async () => {
    try {
      await intifaceService.stopAllDevices();
    } catch (err) {
      console.error('[useHaptic] Stop all failed:', err);
    }
  }, []);

  // ==========================================================================
  // Backend Sync
  // ==========================================================================

  const loadBackendDevices = useCallback(async () => {
    try {
      const response = await hapticApi.getDevices();
      if (response.success && response.data) {
        setBackendDevices(response.data.devices || []);
      }
    } catch (err) {
      console.error('[useHaptic] Failed to load backend devices:', err);
    }
  }, []);

  const syncDeviceToBackend = useCallback(async (device: LocalDevice) => {
    const canVibrate = !!device.messageTypes.ScalarCmd?.some(a => a.actuatorType === 'Vibrate');
    const canRotate = !!device.messageTypes.RotateCmd;
    const canLinear = !!device.messageTypes.LinearCmd;
    const canBattery = !!device.messageTypes.BatteryLevelCmd;

    const vibrateCount = device.messageTypes.ScalarCmd?.filter(a => a.actuatorType === 'Vibrate').length ?? 0;
    const rotateCount = device.messageTypes.RotateCmd?.length ?? 0;
    const linearCount = device.messageTypes.LinearCmd?.length ?? 0;

    try {
      const response = await hapticApi.registerDevice({
        device_index: device.index,
        device_name: device.name,
        device_address: device.address,
        can_vibrate: canVibrate,
        can_rotate: canRotate,
        can_linear: canLinear,
        can_battery: canBattery,
        vibrate_count: vibrateCount,
        rotate_count: rotateCount,
        linear_count: linearCount,
      });

      if (response.success && response.data) {
        // Update local device with backend ID
        setLocalDevices(prev => prev.map(d =>
          d.index === device.index
            ? { ...d, synced: true, backendId: response.data!.id }
            : d
        ));

        // Refresh backend devices
        await loadBackendDevices();
      }
    } catch (err) {
      console.error('[useHaptic] Failed to sync device:', err);
    }
  }, [loadBackendDevices]);

  const updateDeviceSettings = useCallback(async (
    deviceId: string,
    settings: hapticApi.UpdateDeviceRequest
  ) => {
    try {
      const response = await hapticApi.updateDevice(deviceId, settings);
      if (response.success) {
        await loadBackendDevices();
      }
      return response;
    } catch (err) {
      console.error('[useHaptic] Failed to update device:', err);
      throw err;
    }
  }, [loadBackendDevices]);

  const removeDevice = useCallback(async (deviceId: string) => {
    try {
      const response = await hapticApi.deleteDevice(deviceId);
      if (response.success) {
        setBackendDevices(prev => prev.filter(d => d.id !== deviceId));
        setLocalDevices(prev => prev.map(d =>
          d.backendId === deviceId
            ? { ...d, synced: false, backendId: undefined }
            : d
        ));
      }
      return response;
    } catch (err) {
      console.error('[useHaptic] Failed to remove device:', err);
      throw err;
    }
  }, []);

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    // Connection state
    isConnected,
    isConnecting,
    isScanning,
    connectionError,

    // Connection actions
    connect,
    disconnect,
    startScanning,
    stopScanning,

    // Devices
    localDevices,
    backendDevices,
    loadBackendDevices,

    // Device control
    vibrate,
    rotate,
    linear,
    stopDevice,
    stopAllDevices,

    // Backend sync
    syncDeviceToBackend,
    updateDeviceSettings,
    removeDevice,
  };
}

export default useHaptic;
