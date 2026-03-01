import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useStreakStatus } from '../hooks/useRewards';

interface DailyRewardWidgetProps {
  onClaim?: () => void;
}

export default function DailyRewardWidget({ onClaim }: DailyRewardWidgetProps) {
  const navigation = useNavigation<any>();
  const { current, isActive, canClaim, loading, refresh } = useStreakStatus();

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation when can claim
  useEffect(() => {
    if (canClaim) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
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
    } else {
      pulseAnim.setValue(1);
    }
  }, [canClaim, pulseAnim]);

  const handlePress = () => {
    if (canClaim && onClaim) {
      onClaim();
    }
    navigation.navigate('DailyRewards');
  };

  if (loading) {
    return null;
  }

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <LinearGradient
          colors={canClaim ? ['#6B46C1', '#EC4899'] : ['#1F1F2E', '#2D2D3D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.container}
        >
          <View style={styles.leftContent}>
            <Text style={styles.fireEmoji}>🔥</Text>
            <View>
              <Text style={styles.streakValue}>{current}</Text>
              <Text style={styles.streakLabel}>Day Streak</Text>
            </View>
          </View>

          {canClaim ? (
            <View style={styles.claimBadge}>
              <Text style={styles.claimIcon}>🎁</Text>
              <Text style={styles.claimText}>Claim!</Text>
            </View>
          ) : (
            <View style={styles.statusBadge}>
              <Text style={styles.statusIcon}>✓</Text>
              <Text style={styles.statusText}>Claimed</Text>
            </View>
          )}
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fireEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  streakValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  streakLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  claimBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  claimIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  claimText: {
    color: '#6B46C1',
    fontWeight: 'bold',
    fontSize: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  statusIcon: {
    color: '#10B981',
    marginRight: 4,
  },
  statusText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
});
