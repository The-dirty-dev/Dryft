import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Vibration,
  Image,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { callSignalingService } from '../../services/callSignaling';
import { RootStackParamList } from '../../navigation';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type IncomingCallRouteProp = RouteProp<RootStackParamList, 'IncomingCall'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function IncomingCallScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<IncomingCallRouteProp>();
  const insets = useSafeAreaInsets();

  const { callId, callerId, callerName, callerPhoto, videoEnabled, matchId } = route.params;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    // Start animations
    startPulseAnimation();
    startSlideAnimation();

    // Play ringtone
    playRingtone();

    // Vibration pattern
    const vibrationInterval = setInterval(() => {
      Vibration.vibrate([0, 500, 200, 500]);
    }, 2000);

    // Setup signaling handler for call ended/cancelled
    callSignalingService.setHandlers({
      onCallEnded: (id) => {
        if (id === callId) {
          cleanup();
          navigation.goBack();
        }
      },
    });

    return () => {
      clearInterval(vibrationInterval);
      Vibration.cancel();
      cleanup();
    };
  }, []);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startSlideAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const playRingtone = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/ringtone.mp3'),
        { isLooping: true }
      );
      soundRef.current = sound;
      await sound.playAsync();
    } catch (error) {
      console.log('[IncomingCall] Ringtone not available');
    }
  };

  const cleanup = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
  };

  const handleAccept = async () => {
    await cleanup();
    navigation.replace('VideoCall', {
      matchId,
      userId: callerId,
      userName: callerName,
      isIncoming: true,
      videoEnabled,
      callId,
    });
  };

  const handleDecline = async () => {
    callSignalingService.rejectCall(callId, callerId, 'declined');
    await cleanup();
    navigation.goBack();
  };

  const slideTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, -20],
  });

  const slideOpacity = slideAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 1, 0.3],
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Background gradient effect */}
      <View style={styles.backgroundGradient} />

      {/* Caller Info */}
      <View style={styles.callerSection}>
        <Animated.View
          style={[
            styles.avatarContainer,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          {callerPhoto ? (
            <Image source={{ uri: callerPhoto }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={60} color="#666" />
            </View>
          )}
        </Animated.View>

        <Text style={styles.callerName}>{callerName}</Text>
        <Text style={styles.callType}>
          Incoming {videoEnabled ? 'Video' : 'Voice'} Call
        </Text>

        {/* Slide hint */}
        <View style={styles.slideHintContainer}>
          <Animated.View
            style={[
              styles.slideHint,
              {
                transform: [{ translateY: slideTranslateY }],
                opacity: slideOpacity,
              },
            ]}
          >
            <Ionicons name="chevron-up" size={24} color="rgba(255,255,255,0.5)" />
            <Ionicons
              name="chevron-up"
              size={24}
              color="rgba(255,255,255,0.5)"
              style={{ marginTop: -12 }}
            />
          </Animated.View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={[styles.actionsContainer, { paddingBottom: insets.bottom + 40 }]}>
        <TouchableOpacity style={styles.declineButton} onPress={handleDecline}>
          <View style={styles.declineButtonInner}>
            <Ionicons
              name="call"
              size={32}
              color="#fff"
              style={{ transform: [{ rotate: '135deg' }] }}
            />
          </View>
          <Text style={styles.buttonLabel}>Decline</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
          <View style={styles.acceptButtonInner}>
            <Ionicons name="call" size={32} color="#fff" />
          </View>
          <Text style={styles.buttonLabel}>Accept</Text>
        </TouchableOpacity>
      </View>

      {/* Additional options */}
      <View style={styles.optionsContainer}>
        <TouchableOpacity style={styles.optionButton}>
          <Ionicons name="chatbubble" size={20} color="#fff" />
          <Text style={styles.optionText}>Message</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionButton}>
          <Ionicons name="alarm" size={20} color="#fff" />
          <Text style={styles.optionText}>Remind me</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a2e',
    opacity: 0.9,
  },
  callerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  avatarContainer: {
    marginBottom: 24,
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  avatarPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  callerName: {
    fontSize: 28,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  callType: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  slideHintContainer: {
    marginTop: 40,
    height: 50,
  },
  slideHint: {
    alignItems: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
    marginBottom: 20,
  },
  declineButton: {
    alignItems: 'center',
  },
  declineButtonInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  acceptButton: {
    alignItems: 'center',
  },
  acceptButtonInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonLabel: {
    marginTop: 12,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  optionText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
});

export default IncomingCallScreen;
