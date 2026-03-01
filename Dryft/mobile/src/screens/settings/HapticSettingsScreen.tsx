import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useHaptic, LocalDevice } from '../../hooks/useHaptic';
import { Input } from '../../components/common';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

export default function HapticSettingsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
    stopDevice,
    stopAllDevices,
    updateDeviceSettings,
    removeDevice,
  } = useHaptic();

  const [testIntensity, setTestIntensity] = useState(0.5);
  const [selectedDeviceIndex, setSelectedDeviceIndex] = useState<number | null>(null);
  const [intifaceUrl, setIntifaceUrl] = useState('ws://127.0.0.1:12345');
  const [showUrlInput, setShowUrlInput] = useState(false);

  // Handle connection
  const handleConnect = async () => {
    if (isConnected) {
      disconnect();
    } else {
      const success = await connect(intifaceUrl);
      if (success) {
        // Start scanning automatically after connection
        setTimeout(() => startScanning(), 500);
      }
    }
  };

  // Handle device test
  const testVibration = async () => {
    if (selectedDeviceIndex === null) {
      Alert.alert(t('alerts.title.noDevice'), t('alerts.haptic.noDeviceMessage'));
      return;
    }

    try {
      await vibrate(selectedDeviceIndex, testIntensity, 1000);
    } catch (err) {
      Alert.alert(
        t('alerts.title.error'),
        err instanceof Error ? err.message : t('alerts.haptic.vibrateFailed')
      );
    }
  };

  // Stop all devices
  const handleStopAll = async () => {
    try {
      await stopAllDevices();
    } catch {}
  };

  // Open Intiface download page
  const openIntifaceDownload = () => {
    Linking.openURL('https://intiface.com/central/');
  };

  // Set device as primary
  const handleSetPrimary = async (deviceId: string) => {
    try {
      await updateDeviceSettings(deviceId, { is_primary: true });
      Alert.alert(t('alerts.title.success'), t('alerts.haptic.primarySuccess'));
    } catch {
      Alert.alert(t('alerts.title.error'), t('alerts.haptic.updateFailed'));
    }
  };

  // Remove device
  const handleRemoveDevice = (deviceId: string) => {
    Alert.alert(
      t('alerts.title.removeDevice'),
      t('alerts.haptic.removeDeviceMessage'),
      [
        { text: t('alerts.actions.cancel'), style: 'cancel' },
        {
          text: t('alerts.actions.remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              await removeDevice(deviceId);
            } catch {
              Alert.alert(t('alerts.title.error'), t('alerts.haptic.removeDeviceFailed'));
            }
          },
        },
      ]
    );
  };

  const getBatteryColor = (battery?: number) => {
    if (!battery) return colors.textSecondary;
    if (battery > 60) return colors.success;
    if (battery > 20) return colors.warning;
    return colors.error;
  };

  const getCapabilities = (device: LocalDevice) => {
    const caps = [];
    if (device.messageTypes.ScalarCmd?.some(a => a.actuatorType === 'Vibrate')) caps.push('Vibrate');
    if (device.messageTypes.RotateCmd) caps.push('Rotate');
    if (device.messageTypes.LinearCmd) caps.push('Linear');
    return caps.join(', ') || 'Unknown';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Connection Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Intiface Central</Text>

          {!isConnected && (
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>
                Connect to Intiface Central to control your devices. Intiface handles Bluetooth
                communication with 750+ supported toys from Lovense, WeVibe, Kiiroo, and more.
              </Text>
              <TouchableOpacity style={styles.linkButton} onPress={openIntifaceDownload}>
                <Text style={styles.linkButtonText}>Download Intiface Central</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* URL Input (collapsible) */}
          {!isConnected && (
            <TouchableOpacity
              style={styles.advancedToggle}
              onPress={() => setShowUrlInput(!showUrlInput)}
            >
              <Text style={styles.advancedToggleText}>
                {showUrlInput ? 'Hide Advanced' : 'Advanced Settings'}
              </Text>
            </TouchableOpacity>
          )}

          {showUrlInput && !isConnected && (
            <View style={styles.urlInputContainer}>
              <Text style={styles.urlLabel}>Server URL</Text>
              <Input
                style={styles.urlInput}
                value={intifaceUrl}
                onChangeText={setIntifaceUrl}
                placeholder="ws://127.0.0.1:12345"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          {connectionError && (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{connectionError}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.connectButton, isConnected && styles.disconnectButton]}
            onPress={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.connectButtonText}>
                {isConnected ? 'Disconnect' : 'Connect to Intiface'}
              </Text>
            )}
          </TouchableOpacity>

          {isConnected && (
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Connected</Text>
            </View>
          )}
        </View>

        {/* Connected Devices */}
        {isConnected && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Connected Devices</Text>
              <TouchableOpacity
                style={styles.scanButton}
                onPress={isScanning ? stopScanning : startScanning}
              >
                {isScanning ? (
                  <>
                    <ActivityIndicator color={colors.primary} size="small" />
                    <Text style={styles.scanButtonText}> Scanning...</Text>
                  </>
                ) : (
                  <Text style={styles.scanButtonText}>Scan</Text>
                )}
              </TouchableOpacity>
            </View>

            {localDevices.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No devices found</Text>
                <Text style={styles.emptyHint}>
                  Make sure your devices are turned on and Intiface Central can see them.
                </Text>
              </View>
            ) : (
              <View style={styles.deviceList}>
                {localDevices.map((device) => (
                  <TouchableOpacity
                    key={device.index}
                    style={[
                      styles.deviceRow,
                      selectedDeviceIndex === device.index && styles.deviceRowSelected,
                    ]}
                    onPress={() => setSelectedDeviceIndex(device.index)}
                  >
                    <Text style={styles.deviceRowIcon}>
                      {device.messageTypes.LinearCmd ? '🍆' : '📳'}
                    </Text>
                    <View style={styles.deviceRowInfo}>
                      <Text style={styles.deviceRowName}>{device.name}</Text>
                      <Text style={styles.deviceRowCaps}>{getCapabilities(device)}</Text>
                    </View>
                    {device.battery !== undefined && (
                      <Text
                        style={[
                          styles.deviceRowBattery,
                          { color: getBatteryColor(device.battery) },
                        ]}
                      >
                        {device.battery}%
                      </Text>
                    )}
                    {device.synced && (
                      <View style={styles.syncBadge}>
                        <Text style={styles.syncBadgeText}>Synced</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Test Controls */}
        {isConnected && selectedDeviceIndex !== null && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Test Device</Text>
            <View style={styles.testCard}>
              <Text style={styles.testDeviceName}>
                {localDevices.find((d) => d.index === selectedDeviceIndex)?.name || 'Device'}
              </Text>

              <Text style={styles.testLabel}>Intensity: {Math.round(testIntensity * 100)}%</Text>

              <View style={styles.intensitySlider}>
                {[0.25, 0.5, 0.75, 1.0].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.intensityButton,
                      testIntensity === level && styles.intensityButtonActive,
                    ]}
                    onPress={() => setTestIntensity(level)}
                  >
                    <Text
                      style={[
                        styles.intensityButtonText,
                        testIntensity === level && styles.intensityButtonTextActive,
                      ]}
                    >
                      {Math.round(level * 100)}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.testButtons}>
                <TouchableOpacity style={styles.testButton} onPress={testVibration}>
                  <Text style={styles.testButtonText}>Test Vibration</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.stopButton} onPress={handleStopAll}>
                  <Text style={styles.stopButtonText}>Stop All</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Saved Devices (Backend) */}
        {backendDevices.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Saved Devices</Text>
            <View style={styles.deviceList}>
              {backendDevices.map((device) => (
                <View key={device.id} style={styles.savedDeviceRow}>
                  <View style={styles.savedDeviceInfo}>
                    <Text style={styles.deviceRowName}>
                      {device.display_name || device.device_name}
                    </Text>
                    <Text style={styles.deviceRowType}>
                      {[
                        device.can_vibrate && 'Vibrate',
                        device.can_rotate && 'Rotate',
                        device.can_linear && 'Linear',
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </Text>
                  </View>
                  {device.is_primary && (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryBadgeText}>Primary</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.deviceMenuButton}
                    onPress={() => {
                      Alert.alert(
                        device.display_name || device.device_name,
                        t('alerts.haptic.deviceMenuMessage'),
                        [
                          { text: t('alerts.haptic.deviceMenuCancel'), style: 'cancel' },
                          ...(!device.is_primary
                            ? [
                                {
                                  text: t('alerts.haptic.deviceMenuSetPrimary'),
                                  onPress: () => handleSetPrimary(device.id),
                                },
                              ]
                            : []),
                          {
                            text: t('alerts.haptic.deviceMenuRemove'),
                            style: 'destructive',
                            onPress: () => handleRemoveDevice(device.id),
                          },
                        ]
                      );
                    }}
                  >
                    <Text style={styles.deviceMenuButtonText}>...</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Help Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Troubleshooting</Text>
          <View style={styles.helpCard}>
            <Text style={styles.helpText}>
              1. Install Intiface Central on your device{'\n'}
              2. Open Intiface Central and start the server{'\n'}
              3. Make sure your toy is turned on and discoverable{'\n'}
              4. Scan for devices in Intiface Central first{'\n'}
              5. Connect to Intiface from this screen
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 12,
    },
    infoCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    infoText: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 12,
    },
    linkButton: {
      alignSelf: 'flex-start',
    },
    linkButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    advancedToggle: {
      marginBottom: 12,
    },
    advancedToggleText: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    urlInputContainer: {
      marginBottom: 16,
    },
    urlLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      marginBottom: 6,
    },
    urlInput: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 12,
      color: colors.text,
      fontSize: 14,
    },
    errorCard: {
      backgroundColor: withAlpha(colors.error, '33'),
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
    },
    errorText: {
      color: colors.error,
      fontSize: 14,
    },
    connectButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    disconnectButton: {
      backgroundColor: colors.border,
    },
    connectButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.success,
      marginRight: 6,
    },
    statusText: {
      color: colors.success,
      fontSize: 14,
      fontWeight: '600',
    },
    scanButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    scanButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    deviceList: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      overflow: 'hidden',
    },
    deviceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    deviceRowSelected: {
      backgroundColor: colors.border,
    },
    deviceRowIcon: {
      fontSize: 24,
      marginRight: 12,
    },
    deviceRowInfo: {
      flex: 1,
    },
    deviceRowName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    deviceRowCaps: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    deviceRowType: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    deviceRowBattery: {
      fontSize: 14,
      fontWeight: '600',
      marginRight: 8,
    },
    syncBadge: {
      backgroundColor: withAlpha(colors.success, '33'),
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    syncBadgeText: {
      color: colors.success,
      fontSize: 10,
      fontWeight: '600',
    },
    emptyContainer: {
      alignItems: 'center',
      padding: 32,
      backgroundColor: colors.surface,
      borderRadius: 16,
    },
    emptyText: {
      color: colors.text,
      fontSize: 16,
      marginBottom: 8,
    },
    emptyHint: {
      color: colors.textSecondary,
      fontSize: 13,
      textAlign: 'center',
    },
    testCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
    },
    testDeviceName: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    testLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    intensitySlider: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    intensityButton: {
      flex: 1,
      backgroundColor: colors.border,
      borderRadius: 8,
      padding: 10,
      alignItems: 'center',
    },
    intensityButtonActive: {
      backgroundColor: colors.primary,
    },
    intensityButtonText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    intensityButtonTextActive: {
      color: colors.text,
    },
    testButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    testButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
    },
    testButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    stopButton: {
      backgroundColor: colors.border,
      borderRadius: 12,
      padding: 14,
      paddingHorizontal: 20,
      alignItems: 'center',
    },
    stopButtonText: {
      color: colors.error,
      fontSize: 16,
      fontWeight: '600',
    },
    savedDeviceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    savedDeviceInfo: {
      flex: 1,
    },
    primaryBadge: {
      backgroundColor: withAlpha(colors.primary, '33'),
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      marginRight: 8,
    },
    primaryBadgeText: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: '600',
    },
    deviceMenuButton: {
      padding: 8,
    },
    deviceMenuButtonText: {
      color: colors.textSecondary,
      fontSize: 18,
      fontWeight: '600',
    },
    helpCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
    },
    helpText: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 24,
    },
  });
}
