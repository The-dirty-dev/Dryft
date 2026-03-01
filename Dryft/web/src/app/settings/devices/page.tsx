'use client';

import { useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useHaptic, LocalDevice } from '@/hooks/useHaptic';
import { useElectron } from '@/hooks/useElectron';

export default function HapticDevicesPage() {
  const {
    isConnected,
    isConnecting,
    isScanning,
    connectionError,
    connect,
    disconnect,
    startScanning,
    stopScanning,
    localDevices,
    backendDevices,
    vibrate,
    stopAllDevices,
    updateDeviceSettings,
    removeDevice,
  } = useHaptic();

  const { isElectron, openIntifaceDownload } = useElectron();

  const [testIntensity, setTestIntensity] = useState(0.5);
  const [selectedDeviceIndex, setSelectedDeviceIndex] = useState<number | null>(null);
  const [intifaceUrl, setIntifaceUrl] = useState('ws://127.0.0.1:12345');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<{ id: string; name: string } | null>(null);

  const handleConnect = async () => {
    if (isConnected) {
      disconnect();
    } else {
      const success = await connect(intifaceUrl);
      if (success) {
        setTimeout(() => startScanning(), 500);
      }
    }
  };

  const testVibration = async () => {
    if (selectedDeviceIndex === null) {
      setActionMessage({ type: 'error', text: 'Please select a device to test' });
      return;
    }

    try {
      await vibrate(selectedDeviceIndex, testIntensity, 1000);
      setActionMessage({ type: 'success', text: 'Test pulse sent!' });
    } catch (err) {
      setActionMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to vibrate device' });
    }

    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleStopAll = async () => {
    try {
      await stopAllDevices();
      setActionMessage({ type: 'success', text: 'All devices stopped' });
    } catch {}
    setTimeout(() => setActionMessage(null), 2000);
  };

  const handleSetPrimary = async (deviceId: string) => {
    try {
      await updateDeviceSettings(deviceId, { is_primary: true });
      setActionMessage({ type: 'success', text: 'Device set as primary' });
    } catch {
      setActionMessage({ type: 'error', text: 'Failed to update device' });
    }
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleRemoveDevice = async (deviceId: string) => {
    try {
      await removeDevice(deviceId);
      setActionMessage({ type: 'success', text: 'Device removed' });
    } catch {
      setActionMessage({ type: 'error', text: 'Failed to remove device' });
    }
    setRemoveConfirm(null);
    setTimeout(() => setActionMessage(null), 3000);
  };

  const getBatteryColor = (battery?: number) => {
    if (!battery) return 'text-muted';
    if (battery > 60) return 'text-green-500';
    if (battery > 20) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getCapabilities = (device: LocalDevice) => {
    const caps = [];
    if (device.messageTypes.ScalarCmd?.some(a => a.actuatorType === 'Vibrate')) caps.push('Vibrate');
    if (device.messageTypes.RotateCmd) caps.push('Rotate');
    if (device.messageTypes.LinearCmd) caps.push('Linear');
    return caps.join(', ') || 'Unknown';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-primary">
            Dryft
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/profile" className="text-muted hover:text-white transition-colors">
              Profile
            </Link>
            <Link href="/messages" className="text-muted hover:text-white transition-colors">
              Messages
            </Link>
            <Link href="/settings/devices" className="text-white font-medium">
              Devices
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Haptic Devices</h1>
        <p className="text-muted mb-8">Connect and manage your devices through Intiface Central</p>

        {/* Action Message */}
        {actionMessage && (
          <div className={`mb-6 p-4 rounded-lg ${
            actionMessage.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
          }`}>
            {actionMessage.text}
          </div>
        )}

        {/* Intiface Connection */}
        <section className="bg-surface rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Intiface Central</h2>

          {!isConnected && (
            <div className="bg-background rounded-xl p-4 mb-4">
              <p className="text-muted text-sm mb-3">
                Connect to Intiface Central to control your devices. Intiface handles Bluetooth
                communication with 750+ supported toys from Lovense, WeVibe, Kiiroo, and more.
              </p>
              <Button
                variant="ghost"
                onClick={openIntifaceDownload}
                className="text-primary text-sm hover:underline px-0"
              >
                Download Intiface Central
              </Button>
            </div>
          )}

          {/* Advanced Settings */}
          {!isConnected && (
            <Button
              variant="ghost"
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="text-sm text-muted hover:text-white mb-4 px-0"
            >
              {showUrlInput ? 'Hide Advanced' : 'Advanced Settings'}
            </Button>
          )}

          {showUrlInput && !isConnected && (
            <div className="mb-4">
              <label className="block text-sm text-muted mb-2">Server URL</label>
              <Input
                type="text"
                value={intifaceUrl}
                onChange={(e) => setIntifaceUrl(e.target.value)}
                placeholder="ws://127.0.0.1:12345"
                className="w-full"
              />
            </div>
          )}

          {connectionError && (
            <div className="bg-red-500/10 text-red-500 rounded-lg p-3 mb-4 text-sm">
              {connectionError}
            </div>
          )}

          <div className="flex items-center gap-4">
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              variant={isConnected ? 'secondary' : 'primary'}
            >
              {isConnecting ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner variant="inline" className="h-4 w-4" />
                  Connecting...
                </span>
              ) : isConnected ? (
                'Disconnect'
              ) : (
                'Connect to Intiface'
              )}
            </Button>

            {isConnected && (
              <div className="flex items-center gap-2 text-green-500">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium">Connected</span>
              </div>
            )}
          </div>
        </section>

        {/* Connected Devices */}
        {isConnected && (
          <section className="bg-surface rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Connected Devices</h2>
              <Button
                onClick={isScanning ? stopScanning : startScanning}
                variant="secondary"
                className="text-sm py-2"
              >
                {isScanning ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner variant="inline" className="h-4 w-4" />
                    Scanning...
                  </span>
                ) : (
                  'Scan for Devices'
                )}
              </Button>
            </div>

            {localDevices.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted mb-2">No devices found</p>
                <p className="text-sm text-muted">
                  Make sure your devices are turned on and visible in Intiface Central.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {localDevices.map((device) => (
                  <Button
                    key={device.index}
                    variant="ghost"
                    onClick={() => setSelectedDeviceIndex(device.index)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-colors text-left ${
                      selectedDeviceIndex === device.index
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <span className="text-2xl">
                      {device.messageTypes.LinearCmd ? '🍆' : '📳'}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium text-white">{device.name}</div>
                      <div className="text-sm text-muted">{getCapabilities(device)}</div>
                    </div>
                    {device.battery !== undefined && (
                      <span className={`text-sm font-medium ${getBatteryColor(device.battery)}`}>
                        {device.battery}%
                      </span>
                    )}
                    {device.synced && (
                      <span className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded">
                        Synced
                      </span>
                    )}
                  </Button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Test Controls */}
        {isConnected && selectedDeviceIndex !== null && (
          <section className="bg-surface rounded-2xl p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">
              Test: {localDevices.find(d => d.index === selectedDeviceIndex)?.name}
            </h2>

            <div className="mb-4">
              <label className="block text-sm text-muted mb-2">
                Intensity: {Math.round(testIntensity * 100)}%
              </label>
              <div className="flex gap-2">
                {[0.25, 0.5, 0.75, 1.0].map((level) => (
                  <Button
                    key={level}
                    variant="ghost"
                    onClick={() => setTestIntensity(level)}
                    className={`flex-1 py-2 rounded-lg transition-colors ${
                      testIntensity === level
                        ? 'bg-primary text-white'
                        : 'bg-background text-muted hover:text-white'
                    }`}
                  >
                    {Math.round(level * 100)}%
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={testVibration} className="flex-1">
                Test Vibration
              </Button>
              <Button variant="secondary" onClick={handleStopAll}>
                Stop All
              </Button>
            </div>
          </section>
        )}

        {/* Saved Devices */}
        {backendDevices.length > 0 && (
          <section className="bg-surface rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Your Saved Devices</h2>
            <div className="space-y-2">
              {backendDevices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border"
                >
                  <div className="flex-1">
                    <div className="font-medium text-white">
                      {device.display_name || device.device_name}
                    </div>
                    <div className="text-sm text-muted">
                      {[
                        device.can_vibrate && 'Vibrate',
                        device.can_rotate && 'Rotate',
                        device.can_linear && 'Linear',
                      ].filter(Boolean).join(', ')}
                    </div>
                  </div>
                  {device.is_primary && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      Primary
                    </span>
                  )}
                  <div className="flex gap-2">
                    {!device.is_primary && (
                      <Button
                        variant="ghost"
                        onClick={() => handleSetPrimary(device.id)}
                        className="text-sm text-muted hover:text-white px-2 py-1"
                      >
                        Set Primary
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => setRemoveConfirm({ id: device.id, name: device.display_name || device.device_name })}
                      className="text-sm text-red-500 hover:text-red-400 px-2 py-1"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Help */}
        <section className="mt-8 p-6 bg-background rounded-xl">
          <h3 className="font-medium text-white mb-3">Troubleshooting</h3>
          <ol className="text-sm text-muted space-y-2 list-decimal list-inside">
            <li>Download and install Intiface Central from intiface.com</li>
            <li>Open Intiface Central and click "Start Server"</li>
            <li>Make sure your device is turned on and in pairing mode</li>
            <li>Scan for devices in Intiface Central first</li>
            <li>Connect to Intiface from this page</li>
          </ol>
          {isElectron && (
            <p className="text-sm text-muted mt-4">
              You can also access device settings quickly from the system tray menu.
            </p>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={removeConfirm !== null}
        title="Remove Device"
        message={`Remove "${removeConfirm?.name}" from your saved devices?`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => removeConfirm && handleRemoveDevice(removeConfirm.id)}
        onCancel={() => setRemoveConfirm(null)}
      />
    </div>
  );
}
