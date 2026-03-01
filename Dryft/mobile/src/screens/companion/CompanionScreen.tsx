import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Animated,
  Vibration,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation';
import { useCompanionSession, ChatMessage } from '../../hooks/useCompanionSession';
import { useHaptic } from '../../hooks/useHaptic';
import { useVoiceChat } from '../../hooks/useVoiceChat';
import { SecureScreen, ScreenCaptureIndicator } from '@components/ScreenSecurity';
import { usePreventScreenshot } from '@hooks/useScreenSecurity';
import { Input } from '../../components/common';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type CompanionRouteProp = RouteProp<RootStackParamList, 'Companion'>;

// Haptic pattern presets
const HAPTIC_PATTERNS = [
  { name: 'Touch', icon: '👆', intensity: 0.3, duration: 500 },
  { name: 'Caress', icon: '🤚', intensity: 0.4, duration: 1500 },
  { name: 'Pulse', icon: '💫', intensity: 0.6, duration: 800 },
  { name: 'Throb', icon: '💓', intensity: 0.7, duration: 1200 },
  { name: 'Wave', icon: '🌊', intensity: 0.5, duration: 2000 },
  { name: 'Intense', icon: '🔥', intensity: 0.9, duration: 1000 },
];

const REACTIONS = ['❤️', '🔥', '😘', '🥵', '💋', '🫦'];

export default function CompanionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<CompanionRouteProp>();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Enable screen security - this is a sensitive screen with private sessions
  usePreventScreenshot(true);

  const {
    isConnected,
    isJoining,
    error,
    session,
    vrState,
    chatMessages,
    securityAlert,
    joinSession,
    leaveSession,
    sendChat,
    sendHaptic,
    setHapticPermission,
    reportCaptureDetected,
    dismissSecurityAlert,
  } = useCompanionSession();

  const { isConnected: deviceConnected, localDevices, vibrate } = useHaptic();

  // Voice chat
  const {
    isConnected: voiceConnected,
    isConnecting: voiceConnecting,
    isMuted,
    isDeafened,
    isSpeaking,
    participants: voiceParticipants,
    error: voiceError,
    connect: connectVoice,
    disconnect: disconnectVoice,
    toggleMute,
    toggleDeafen,
  } = useVoiceChat(session?.session?.id || null);

  // Get params from notification navigation
  const initialCode = route.params?.sessionCode || '';
  const inBooth = route.params?.inBooth || false;
  const partnerName = route.params?.partnerName || '';
  const triggerHaptic = route.params?.triggerHaptic || false;
  const hapticIntensity = route.params?.hapticIntensity || 0.5;

  const [sessionCode, setSessionCode] = useState(initialCode);
  const [displayName, setDisplayName] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [customIntensity, setCustomIntensity] = useState(0.5);
  const [isHolding, setIsHolding] = useState(false);
  const [receivingHaptic, setReceivingHaptic] = useState(false);
  const [boothNotification, setBoothNotification] = useState(inBooth ? partnerName : '');

  const chatListRef = useRef<FlatList>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const hapticTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoJoinAttempted = useRef(false);

  // Get VR host from session
  const vrHost = session?.participants.find(p => p.device_type === 'vr');

  // Auto-join if session code is provided via notification
  useEffect(() => {
    if (initialCode && initialCode.length === 6 && !session && !autoJoinAttempted.current) {
      autoJoinAttempted.current = true;
      joinSession(initialCode);
    }
  }, [initialCode, session, joinSession]);

  // Trigger haptic if requested via notification
  useEffect(() => {
    if (triggerHaptic && hapticIntensity > 0) {
      Vibration.vibrate([0, 100, 50, 100, 50, 100]);
    }
  }, [triggerHaptic, hapticIntensity]);

  // Clear booth notification after a delay
  useEffect(() => {
    if (boothNotification) {
      const timer = setTimeout(() => setBoothNotification(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [boothNotification]);

  // Visual feedback when receiving haptic
  useEffect(() => {
    if (vrState?.haptic_intensity && vrState.haptic_intensity > 0) {
      setReceivingHaptic(true);

      // Phone vibration feedback
      Vibration.vibrate(100);

      // Pulse animation
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      if (hapticTimeoutRef.current) {
        clearTimeout(hapticTimeoutRef.current);
      }
      hapticTimeoutRef.current = setTimeout(() => {
        setReceivingHaptic(false);
      }, 2000);
    }

    return () => {
      if (hapticTimeoutRef.current) {
        clearTimeout(hapticTimeoutRef.current);
      }
    };
  }, [vrState?.haptic_intensity]);

  const handleJoin = async () => {
    if (!sessionCode.trim() || sessionCode.length !== 6) return;
    await joinSession(sessionCode.trim(), displayName.trim() || undefined);
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim());
    setChatInput('');
  };

  const handlePatternPress = (pattern: typeof HAPTIC_PATTERNS[0]) => {
    if (!vrHost) return;
    sendHaptic(vrHost.user_id, 'vibrate', {
      intensity: pattern.intensity,
      durationMs: pattern.duration,
    });
    // Local feedback
    Vibration.vibrate(50);
  };

  const handleCustomVibrateStart = () => {
    if (!vrHost) return;
    setIsHolding(true);
    sendHaptic(vrHost.user_id, 'vibrate', {
      intensity: customIntensity,
      durationMs: 10000,
    });
  };

  const handleCustomVibrateEnd = () => {
    if (!vrHost) return;
    setIsHolding(false);
    sendHaptic(vrHost.user_id, 'stop');
  };

  const handleReaction = (reaction: string) => {
    sendChat(reaction);
    Vibration.vibrate(30);
  };

  const grantHapticPermission = () => {
    if (!vrHost) return;
    setHapticPermission(vrHost.user_id, 'always', 1.0);
  };

  // ============================================================================
  // Join Screen
  // ============================================================================

  if (!session) {
    return (
      <SecureScreen forceSecure showCaptureWarning>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.backButton}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Join VR Session</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.joinContent}>
            <View style={styles.joinCard}>
              <Text style={styles.joinTitle}>Enter Session Code</Text>
              <Text style={styles.joinSubtitle}>
                Enter the 6-digit code shown in VR
              </Text>

              {error && (
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Input
                style={styles.codeInput}
                value={sessionCode}
                onChangeText={(text) => setSessionCode(text.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                maxLength={6}
              />

              <Input
                style={styles.nameInput}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name (optional)"
                placeholderTextColor={colors.textSecondary}
              />

              <TouchableOpacity
                style={[styles.joinButton, sessionCode.length !== 6 && styles.joinButtonDisabled]}
                onPress={handleJoin}
                disabled={sessionCode.length !== 6 || isJoining}
              >
                {isJoining ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={styles.joinButtonText}>Join Session</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.joinHint}>
                Don't have a code? Ask your VR partner to create a session.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </SecureScreen>
    );
  }

  // ============================================================================
  // Session View
  // ============================================================================

  return (
    <SecureScreen
      forceSecure
      showCaptureWarning
      blurOnCapture
      warningMessage="Screen recording detected. Chat and session content has been hidden to protect your privacy and your partner's privacy."
      onCaptureDetected={(event) => {
        if (event.isCaptured) {
          reportCaptureDetected('recording');
        }
      }}
    >
      <SafeAreaView style={styles.container}>
        {/* Screen capture indicator */}
        <ScreenCaptureIndicator position="top-right" />

        {/* Security Alert Banner */}
        {securityAlert && (
          <TouchableOpacity style={styles.securityBanner} onPress={dismissSecurityAlert}>
            <Text style={styles.securityBannerIcon}>⚠️</Text>
            <View style={styles.securityBannerContent}>
              <Text style={styles.securityBannerTitle}>
                {securityAlert.deviceType === 'vr' ? 'VR Recording Detected' : 'Screen Capture Detected'}
              </Text>
              <Text style={styles.securityBannerText}>
                {securityAlert.displayName || 'A participant'} may be {securityAlert.captureType || 'recording'}
              </Text>
            </View>
            <Text style={styles.securityBannerDismiss}>✕</Text>
          </TouchableOpacity>
        )}

        {/* Header */}
        <View style={styles.sessionHeader}>
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionCode}>
            Session: {session.session.session_code}
          </Text>
          <View style={styles.connectionStatus}>
            <View style={[styles.statusDot, isConnected && styles.statusDotConnected]} />
            <Text style={styles.statusLabel}>
              {isConnected ? 'Connected' : 'Reconnecting...'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.leaveButton} onPress={leaveSession}>
          <Text style={styles.leaveButtonText}>Leave</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Booth Notification Banner */}
        {boothNotification && (
          <View style={styles.boothBanner}>
            <Text style={styles.boothBannerIcon}>🔒</Text>
            <Text style={styles.boothBannerText}>
              Now in private booth with {boothNotification}
            </Text>
          </View>
        )}

        {/* VR User Status */}
        <Animated.View style={[styles.vrStatusCard, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.vrAvatar}>
            <Text style={styles.vrAvatarIcon}>🥽</Text>
          </View>
          <View style={styles.vrInfo}>
            <Text style={styles.vrName}>{vrHost?.display_name || 'VR User'}</Text>
            <View style={styles.vrActivity}>
              <View style={[styles.activityDot, receivingHaptic && styles.activityDotActive]} />
              <Text style={styles.vrActivityText}>
                {vrState?.current_activity || 'In VR'}
                {vrState?.current_room && ` - ${vrState.current_room}`}
              </Text>
            </View>
            {vrState?.haptic_device_connected && (
              <Text style={styles.deviceStatus}>
                Device: {vrState.haptic_device_name || 'Connected'}
              </Text>
            )}
          </View>
        </Animated.View>

        {/* Haptic Intensity Display */}
        {vrState?.haptic_intensity !== undefined && vrState.haptic_intensity > 0 && (
          <View style={styles.intensityBar}>
            <Text style={styles.intensityLabel}>Intensity</Text>
            <View style={styles.intensityTrack}>
              <View
                style={[styles.intensityFill, { width: `${vrState.haptic_intensity * 100}%` }]}
              />
            </View>
            <Text style={styles.intensityValue}>
              {Math.round(vrState.haptic_intensity * 100)}%
            </Text>
          </View>
        )}

        {/* Receiving Indicator */}
        {receivingHaptic && (
          <View style={styles.receivingCard}>
            <Text style={styles.receivingIcon}>💫</Text>
            <Text style={styles.receivingText}>Receiving from VR</Text>
          </View>
        )}

        {/* Quick Patterns */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Patterns</Text>
          <View style={styles.patternGrid}>
            {HAPTIC_PATTERNS.map((pattern) => (
              <TouchableOpacity
                key={pattern.name}
                style={styles.patternButton}
                onPress={() => handlePatternPress(pattern)}
                disabled={!vrHost || !vrState?.haptic_device_connected}
              >
                <Text style={styles.patternIcon}>{pattern.icon}</Text>
                <Text style={styles.patternName}>{pattern.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Custom Control */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Custom Control</Text>
          <View style={styles.customControl}>
            <View style={styles.intensitySelector}>
              <Text style={styles.intensityLabel}>
                Intensity: {Math.round(customIntensity * 100)}%
              </Text>
              <View style={styles.intensityButtons}>
                {[0.25, 0.5, 0.75, 1.0].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.intensityBtn,
                      customIntensity === level && styles.intensityBtnActive,
                    ]}
                    onPress={() => setCustomIntensity(level)}
                  >
                    <Text
                      style={[
                        styles.intensityBtnText,
                        customIntensity === level && styles.intensityBtnTextActive,
                      ]}
                    >
                      {Math.round(level * 100)}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.holdButton, isHolding && styles.holdButtonActive]}
              onPressIn={handleCustomVibrateStart}
              onPressOut={handleCustomVibrateEnd}
              disabled={!vrHost || !vrState?.haptic_device_connected}
            >
              <Text style={styles.holdButtonText}>
                {isHolding ? 'Vibrating...' : 'Hold to Vibrate'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Reactions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reactions</Text>
          <View style={styles.reactionsRow}>
            {REACTIONS.map((reaction) => (
              <TouchableOpacity
                key={reaction}
                style={styles.reactionButton}
                onPress={() => handleReaction(reaction)}
              >
                <Text style={styles.reactionText}>{reaction}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Device Status */}
        {!vrState?.haptic_device_connected && (
          <View style={styles.warningCard}>
            <Text style={styles.warningText}>
              VR user hasn't connected a haptic device yet
            </Text>
          </View>
        )}

        {/* Your Device */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Device</Text>
          <View style={styles.yourDeviceCard}>
            {deviceConnected && localDevices.length > 0 ? (
              <>
                <View style={styles.deviceRow}>
                  <View style={styles.deviceDot} />
                  <Text style={styles.deviceName}>{localDevices[0].name}</Text>
                </View>
                <TouchableOpacity onPress={grantHapticPermission}>
                  <Text style={styles.permissionLink}>
                    Allow VR user to control your device
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.noDeviceText}>
                Connect a device in Settings to receive haptic feedback
              </Text>
            )}
          </View>
        </View>

        {/* Voice Chat */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voice Chat</Text>
          <View style={styles.voiceChatCard}>
            {!voiceConnected ? (
              <TouchableOpacity
                style={[styles.voiceConnectButton, voiceConnecting && styles.voiceConnectButtonLoading]}
                onPress={connectVoice}
                disabled={voiceConnecting}
              >
                {voiceConnecting ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <>
                    <Text style={styles.voiceConnectIcon}>🎙️</Text>
                    <Text style={styles.voiceConnectText}>Join Voice Chat</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <>
                {/* Voice status */}
                <View style={styles.voiceStatusRow}>
                  <View style={[styles.voiceStatusDot, isSpeaking && styles.voiceStatusDotSpeaking]} />
                  <Text style={styles.voiceStatusText}>
                    {isSpeaking ? 'Speaking' : 'Connected'}
                  </Text>
                  {voiceParticipants.length > 0 && (
                    <Text style={styles.voiceParticipantCount}>
                      {voiceParticipants.length} in chat
                    </Text>
                  )}
                </View>

                {/* Voice controls */}
                <View style={styles.voiceControls}>
                  <TouchableOpacity
                    style={[styles.voiceControlButton, isMuted && styles.voiceControlButtonActive]}
                    onPress={toggleMute}
                  >
                    <Text style={styles.voiceControlIcon}>{isMuted ? '🔇' : '🔊'}</Text>
                    <Text style={[styles.voiceControlText, isMuted && styles.voiceControlTextActive]}>
                      {isMuted ? 'Unmute' : 'Mute'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.voiceControlButton, isDeafened && styles.voiceControlButtonActive]}
                    onPress={toggleDeafen}
                  >
                    <Text style={styles.voiceControlIcon}>{isDeafened ? '🔕' : '🔔'}</Text>
                    <Text style={[styles.voiceControlText, isDeafened && styles.voiceControlTextActive]}>
                      {isDeafened ? 'Undeafen' : 'Deafen'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.voiceControlButton, styles.voiceControlButtonDanger]}
                    onPress={disconnectVoice}
                  >
                    <Text style={styles.voiceControlIcon}>📵</Text>
                    <Text style={styles.voiceControlTextDanger}>Leave</Text>
                  </TouchableOpacity>
                </View>

                {/* Participants speaking indicators */}
                {voiceParticipants.filter(p => p.isSpeaking).length > 0 && (
                  <View style={styles.speakingIndicators}>
                    {voiceParticipants
                      .filter(p => p.isSpeaking)
                      .map(p => (
                        <View key={p.id} style={styles.speakingBadge}>
                          <View style={styles.speakingPulse} />
                          <Text style={styles.speakingName}>{p.displayName}</Text>
                        </View>
                      ))}
                  </View>
                )}
              </>
            )}

            {voiceError && (
              <Text style={styles.voiceError}>{voiceError}</Text>
            )}
          </View>
        </View>

        {/* Chat */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chat</Text>
          <View style={styles.chatCard}>
            <FlatList
              ref={chatListRef}
              data={chatMessages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <ChatBubble message={item} styles={styles} />}
              style={styles.chatList}
              onContentSizeChange={() => chatListRef.current?.scrollToEnd()}
              ListEmptyComponent={
                <Text style={styles.chatEmpty}>No messages yet. Say hi!</Text>
              }
            />
            <View style={styles.chatInputRow}>
              <Input
                style={styles.chatInput}
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Type a message..."
                placeholderTextColor={colors.textSecondary}
                onSubmitEditing={handleSendChat}
                returnKeyType="send"
              />
              <TouchableOpacity
                style={[styles.sendButton, !chatInput.trim() && styles.sendButtonDisabled]}
                onPress={handleSendChat}
                disabled={!chatInput.trim()}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
    </SecureScreen>
  );
}

// Chat bubble component
function ChatBubble({ message, styles }: { message: ChatMessage; styles: ReturnType<typeof createStyles> }) {
  const isReaction = REACTIONS.includes(message.content);

  if (isReaction) {
    return (
      <View style={styles.reactionBubble}>
        <Text style={styles.reactionBubbleEmoji}>{message.content}</Text>
        <Text style={styles.reactionBubbleName}>{message.displayName}</Text>
      </View>
    );
  }

  return (
    <View style={styles.chatBubble}>
      <Text style={styles.chatBubbleName}>{message.displayName}</Text>
      <View style={styles.chatBubbleContent}>
        <Text style={styles.chatBubbleText}>{message.content}</Text>
      </View>
    </View>
  );
}

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

function createStyles(colors: ThemeColors) {
  const primarySubtle = withAlpha(colors.primary, '33');
  const warningSubtle = withAlpha(colors.warning, '33');
  const errorSubtle = withAlpha(colors.error, '33');
  const text90 = withAlpha(colors.text, 'E6');
  const text80 = withAlpha(colors.text, 'CC');

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      fontSize: 24,
      color: colors.text,
      paddingRight: 16,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    headerSpacer: {
      width: 40,
    },
    content: {
      flex: 1,
    },
    joinContent: {
      padding: 20,
      justifyContent: 'center',
      flex: 1,
    },
    joinCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
    },
    joinTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    joinSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 24,
    },
    errorCard: {
      backgroundColor: errorSubtle,
      borderRadius: 8,
      padding: 12,
      marginBottom: 16,
      width: '100%',
    },
    errorText: {
      color: colors.error,
      fontSize: 14,
      textAlign: 'center',
    },
    codeInput: {
      fontSize: 32,
      fontWeight: 'bold',
      color: colors.text,
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      textAlign: 'center',
      letterSpacing: 12,
      width: '100%',
      marginBottom: 16,
    },
    nameInput: {
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      width: '100%',
      marginBottom: 24,
    },
    joinButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      width: '100%',
      alignItems: 'center',
      marginBottom: 16,
    },
    joinButtonDisabled: {
      backgroundColor: colors.borderLight,
    },
    joinButtonText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    joinHint: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    sessionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sessionInfo: {
      flex: 1,
    },
    sessionCode: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
    },
    connectionStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.warning,
      marginRight: 6,
    },
    statusDotConnected: {
      backgroundColor: colors.success,
    },
    statusLabel: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    leaveButton: {
      padding: 8,
    },
    leaveButtonText: {
      color: colors.error,
      fontSize: 14,
      fontWeight: '600',
    },
    vrStatusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      margin: 16,
      padding: 16,
      borderRadius: 16,
    },
    vrAvatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: primarySubtle,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    vrAvatarIcon: {
      fontSize: 32,
    },
    vrInfo: {
      flex: 1,
    },
    vrName: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    vrActivity: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    activityDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.success,
      marginRight: 6,
    },
    activityDotActive: {
      backgroundColor: colors.primary,
    },
    vrActivityText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    deviceStatus: {
      fontSize: 12,
      color: colors.success,
      marginTop: 4,
    },
    intensityBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: primarySubtle,
      marginHorizontal: 16,
      marginBottom: 16,
      padding: 12,
      borderRadius: 12,
    },
    intensityLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginRight: 8,
    },
    intensityTrack: {
      flex: 1,
      height: 8,
      backgroundColor: colors.background,
      borderRadius: 4,
      overflow: 'hidden',
    },
    intensityFill: {
      height: '100%',
      backgroundColor: colors.primary,
    },
    intensityValue: {
      fontSize: 12,
      color: colors.text,
      marginLeft: 8,
      fontWeight: '600',
    },
    receivingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: primarySubtle,
      marginHorizontal: 16,
      marginBottom: 16,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    receivingIcon: {
      fontSize: 20,
      marginRight: 8,
    },
    receivingText: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '600',
    },
    section: {
      marginHorizontal: 16,
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      marginBottom: 12,
    },
    patternGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    patternButton: {
      width: '30%',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    patternIcon: {
      fontSize: 28,
      marginBottom: 8,
    },
    patternName: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    customControl: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
    },
    intensitySelector: {
      marginBottom: 16,
    },
    intensityButtons: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    intensityBtn: {
      flex: 1,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 8,
      padding: 10,
      alignItems: 'center',
    },
    intensityBtnActive: {
      backgroundColor: colors.primary,
    },
    intensityBtnText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '600',
    },
    intensityBtnTextActive: {
      color: colors.text,
    },
    holdButton: {
      backgroundColor: primarySubtle,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.primary,
    },
    holdButtonActive: {
      backgroundColor: colors.primary,
    },
    holdButtonText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.primary,
    },
    reactionsRow: {
      flexDirection: 'row',
      gap: 8,
    },
    reactionButton: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    reactionText: {
      fontSize: 24,
    },
    warningCard: {
      backgroundColor: warningSubtle,
      marginHorizontal: 16,
      marginBottom: 16,
      padding: 12,
      borderRadius: 12,
    },
    warningText: {
      color: colors.warning,
      fontSize: 14,
      textAlign: 'center',
    },
    yourDeviceCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
    },
    deviceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    deviceDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.success,
      marginRight: 8,
    },
    deviceName: {
      color: colors.success,
      fontSize: 14,
      fontWeight: '600',
    },
    permissionLink: {
      color: colors.primary,
      fontSize: 13,
    },
    noDeviceText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    chatCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      overflow: 'hidden',
    },
    chatList: {
      maxHeight: 200,
      padding: 12,
    },
    chatEmpty: {
      color: colors.textSecondary,
      textAlign: 'center',
      padding: 24,
    },
    chatInputRow: {
      flexDirection: 'row',
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 8,
    },
    chatInput: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      color: colors.text,
      fontSize: 14,
    },
    sendButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 20,
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: colors.borderLight,
    },
    sendButtonText: {
      color: colors.text,
      fontWeight: '600',
    },
    chatBubble: {
      marginBottom: 12,
    },
    chatBubbleName: {
      fontSize: 11,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    chatBubbleContent: {
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 12,
      padding: 12,
      alignSelf: 'flex-start',
      maxWidth: '80%',
    },
    chatBubbleText: {
      color: colors.text,
      fontSize: 14,
    },
    reactionBubble: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    reactionBubbleEmoji: {
      fontSize: 24,
      marginRight: 8,
    },
    reactionBubbleName: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    bottomPadding: {
      height: 40,
    },
    boothBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      marginHorizontal: 16,
      marginTop: 16,
      padding: 12,
      borderRadius: 12,
    },
    boothBannerIcon: {
      fontSize: 20,
      marginRight: 8,
    },
    boothBannerText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    voiceChatCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 16,
    },
    voiceConnectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.success,
      borderRadius: 12,
      padding: 16,
      gap: 8,
    },
    voiceConnectButtonLoading: {
      backgroundColor: withAlpha(colors.success, 'CC'),
    },
    voiceConnectIcon: {
      fontSize: 24,
    },
    voiceConnectText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    voiceStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    voiceStatusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.success,
      marginRight: 8,
    },
    voiceStatusDotSpeaking: {
      backgroundColor: colors.primary,
    },
    voiceStatusText: {
      color: colors.text,
      fontSize: 14,
      flex: 1,
    },
    voiceParticipantCount: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    voiceControls: {
      flexDirection: 'row',
      gap: 8,
    },
    voiceControlButton: {
      flex: 1,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
    },
    voiceControlButtonActive: {
      backgroundColor: primarySubtle,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    voiceControlButtonDanger: {
      backgroundColor: errorSubtle,
    },
    voiceControlIcon: {
      fontSize: 20,
      marginBottom: 4,
    },
    voiceControlText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '600',
    },
    voiceControlTextActive: {
      color: colors.primary,
    },
    voiceControlTextDanger: {
      color: colors.error,
      fontSize: 11,
      fontWeight: '600',
    },
    speakingIndicators: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 12,
      gap: 8,
    },
    speakingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: primarySubtle,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    speakingPulse: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      marginRight: 6,
    },
    speakingName: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '500',
    },
    voiceError: {
      color: colors.error,
      fontSize: 12,
      marginTop: 8,
      textAlign: 'center',
    },
    securityBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.error,
      marginHorizontal: 16,
      marginTop: 8,
      padding: 12,
      borderRadius: 12,
      gap: 10,
    },
    securityBannerIcon: {
      fontSize: 24,
    },
    securityBannerContent: {
      flex: 1,
    },
    securityBannerTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    securityBannerText: {
      color: text90,
      fontSize: 12,
      marginTop: 2,
    },
    securityBannerDismiss: {
      color: text80,
      fontSize: 16,
      padding: 4,
    },
  });
}
