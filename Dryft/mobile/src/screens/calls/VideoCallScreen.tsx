import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
} from 'react-native';
import { RTCView, MediaStream } from 'react-native-webrtc';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { webRTCService, CallState } from '../../services/webrtc';
import { callSignalingService } from '../../services/callSignaling';
import { RootStackParamList } from '../../navigation';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

type VideoCallRouteProp = RouteProp<RootStackParamList, 'VideoCall'>;

export function VideoCallScreen() {
  const navigation = useNavigation();
  const route = useRoute<VideoCallRouteProp>();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { matchId, userId, userName, isIncoming, videoEnabled, callId } = route.params;

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callState, setCallState] = useState<CallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(!videoEnabled);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [remoteVideoOff, setRemoteVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);

  const callStartTime = useRef<number | null>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Setup WebRTC handlers
  useEffect(() => {
    webRTCService.setHandlers({
      onLocalStream: (stream) => setLocalStream(stream),
      onRemoteStream: (stream) => setRemoteStream(stream),
      onCallStateChange: (state) => {
        setCallState(state);
        if (state === 'connected' && !callStartTime.current) {
          callStartTime.current = Date.now();
          startDurationTimer();
        }
        if (state === 'ended') {
          handleCallEnded();
        }
      },
      onError: (error) => {
        console.error('[VideoCall] Error:', error);
        handleCallEnded();
      },
    });

    // Setup signaling handlers
    callSignalingService.setHandlers({
      onOffer: async (id, sdp) => {
        if (id === callId) {
          await webRTCService.setRemoteDescription(sdp);
          const answer = await webRTCService.createAnswer();
          callSignalingService.sendAnswer(userId, answer);
        }
      },
      onAnswer: async (id, sdp) => {
        if (id === callId) {
          await webRTCService.setRemoteDescription(sdp);
        }
      },
      onIceCandidate: async (id, candidate) => {
        if (id === callId) {
          await webRTCService.addIceCandidate(candidate);
        }
      },
      onCallEnded: (id) => {
        if (id === callId) {
          handleCallEnded();
        }
      },
      onRemoteMute: (id, muted) => {
        if (id === callId) {
          setRemoteMuted(muted);
        }
      },
      onRemoteVideoOff: (id, videoOff) => {
        if (id === callId) {
          setRemoteVideoOff(videoOff);
        }
      },
    });

    // Setup ICE candidate callback
    webRTCService.onIceCandidate = (candidate) => {
      callSignalingService.sendIceCandidate(userId, candidate);
    };

    initializeCall();

    return () => {
      cleanup();
    };
  }, []);

  const initializeCall = async () => {
    try {
      await webRTCService.startLocalStream(videoEnabled);
      await webRTCService.createPeerConnection();

      if (isIncoming) {
        // Accept the incoming call
        callSignalingService.acceptCall(callId, userId);
        setCallState('connecting');
      } else {
        // Create and send offer
        const offer = await webRTCService.createOffer();
        callSignalingService.sendOffer(userId, offer);
      }
    } catch (error) {
      console.error('[VideoCall] Failed to initialize:', error);
      handleCallEnded();
    }
  };

  const startDurationTimer = () => {
    durationInterval.current = setInterval(() => {
      if (callStartTime.current) {
        setCallDuration(Math.floor((Date.now() - callStartTime.current) / 1000));
      }
    }, 1000);
  };

  const handleCallEnded = () => {
    cleanup();
    navigation.goBack();
  };

  const cleanup = () => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
    }
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }
    webRTCService.cleanup();
  };

  const handleEndCall = useCallback(() => {
    callSignalingService.endCall(userId);
    webRTCService.endCall();
    handleCallEnded();
  }, [userId]);

  const handleToggleMute = useCallback(() => {
    const muted = webRTCService.toggleMute();
    setIsMuted(muted);
    callSignalingService.sendMuteStatus(userId, muted);
  }, [userId]);

  const handleToggleVideo = useCallback(() => {
    const videoOff = webRTCService.toggleVideo();
    setIsVideoOff(videoOff);
    callSignalingService.sendVideoStatus(userId, videoOff);
  }, [userId]);

  const handleSwitchCamera = useCallback(() => {
    webRTCService.switchCamera();
  }, []);

  const handleTapScreen = useCallback(() => {
    setShowControls(true);
    fadeAnim.setValue(1);

    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }

    controlsTimeout.current = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setShowControls(false));
    }, 3000);
  }, [fadeAnim]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCallStatusText = (): string => {
    switch (callState) {
      case 'calling':
        return 'Calling...';
      case 'ringing':
        return 'Ringing...';
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return formatDuration(callDuration);
      default:
        return '';
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Remote Video (Full Screen) */}
      {remoteStream && !remoteVideoOff ? (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={styles.remoteVideo}
          objectFit="cover"
        />
      ) : (
        <View style={styles.noVideoContainer}>
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={80} color={colors.textMuted} />
          </View>
          <Text style={styles.userName}>{userName}</Text>
          {remoteVideoOff && (
            <Text style={styles.videoOffText}>Camera is off</Text>
          )}
        </View>
      )}

      {/* Local Video (PiP) */}
      {localStream && !isVideoOff && (
        <View style={[styles.localVideoContainer, { top: insets.top + 60 }]}>
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localVideo}
            objectFit="cover"
            mirror
          />
        </View>
      )}

      {/* Top Bar */}
      <TouchableOpacity
        style={styles.touchableOverlay}
        activeOpacity={1}
        onPress={handleTapScreen}
      >
        <Animated.View
          style={[
            styles.topBar,
            { opacity: fadeAnim, paddingTop: insets.top },
          ]}
        >
          <Text style={styles.callStatus}>{getCallStatusText()}</Text>
          <View style={styles.remoteStatus}>
            {remoteMuted && (
              <View style={styles.statusBadge}>
                <Ionicons name="mic-off" size={14} color={colors.text} />
              </View>
            )}
          </View>
        </Animated.View>

        {/* Bottom Controls */}
        <Animated.View
          style={[
            styles.controlsContainer,
            { opacity: fadeAnim, paddingBottom: insets.bottom + 20 },
          ]}
        >
          <TouchableOpacity
            style={[styles.controlButton, isMuted && styles.controlButtonActive]}
            onPress={handleToggleMute}
          >
            <Ionicons
              name={isMuted ? 'mic-off' : 'mic'}
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, isVideoOff && styles.controlButtonActive]}
            onPress={handleToggleVideo}
          >
            <Ionicons
              name={isVideoOff ? 'videocam-off' : 'videocam'}
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={handleSwitchCamera}
          >
            <Ionicons name="camera-reverse" size={24} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, styles.endCallButton]}
            onPress={handleEndCall}
          >
            <Ionicons name="call" size={28} color={colors.text} />
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDarkest,
  },
  touchableOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  remoteVideo: {
    flex: 1,
    backgroundColor: colors.backgroundDarkest,
  },
  noVideoContainer: {
    flex: 1,
    backgroundColor: colors.backgroundDarkest,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
  },
  videoOffText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  localVideoContainer: {
    position: 'absolute',
    right: 16,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    shadowColor: colors.backgroundDarkest,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  localVideo: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: withAlpha(colors.backgroundDarkest, '4D'),
  },
  callStatus: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  remoteStatus: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    backgroundColor: withAlpha(colors.text, '33'),
    padding: 4,
    borderRadius: 12,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 20,
    backgroundColor: withAlpha(colors.backgroundDarkest, '4D'),
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: withAlpha(colors.text, '33'),
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: withAlpha(colors.primary, 'CC'),
  },
  endCallButton: {
    backgroundColor: colors.primary,
    width: 64,
    height: 64,
    borderRadius: 32,
    transform: [{ rotate: '135deg' }],
  },
});

export default VideoCallScreen;
