import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { VerificationStatus, VerificationType } from '../store/verificationStore';

interface VerificationBadgeProps {
  verified: boolean;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  onPress?: () => void;
}

export function VerificationBadge({
  verified,
  size = 'medium',
  showLabel = false,
  onPress,
}: VerificationBadgeProps) {
  const theme = useTheme();

  const sizes = {
    small: { icon: 12, container: 16 },
    medium: { icon: 16, container: 24 },
    large: { icon: 24, container: 36 },
  };

  const currentSize = sizes[size];

  const badge = (
    <View
      style={[
        styles.badge,
        {
          width: currentSize.container,
          height: currentSize.container,
          backgroundColor: verified ? '#3b82f6' : theme.colors.textMuted,
        },
      ]}
    >
      <Ionicons
        name={verified ? 'checkmark' : 'close'}
        size={currentSize.icon}
        color="#fff"
      />
    </View>
  );

  if (showLabel) {
    const content = (
      <View style={styles.labelContainer}>
        {badge}
        <Text
          style={[
            styles.label,
            { color: verified ? '#3b82f6' : theme.colors.textMuted },
          ]}
        >
          {verified ? 'Verified' : 'Unverified'}
        </Text>
      </View>
    );

    if (onPress) {
      return (
        <TouchableOpacity onPress={onPress} accessibilityRole="button">
          {content}
        </TouchableOpacity>
      );
    }
    return content;
  }

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} accessibilityRole="button">
        {badge}
      </TouchableOpacity>
    );
  }

  return badge;
}

interface VerificationStatusBadgeProps {
  type: VerificationType;
  status: VerificationStatus;
  onPress?: () => void;
}

export function VerificationStatusBadge({
  type,
  status,
  onPress,
}: VerificationStatusBadgeProps) {
  const theme = useTheme();

  const getStatusColor = () => {
    switch (status) {
      case 'approved':
        return '#22c55e';
      case 'pending':
      case 'in_review':
        return '#f59e0b';
      case 'rejected':
        return '#ef4444';
      default:
        return theme.colors.textMuted;
    }
  };

  const getStatusIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case 'approved':
        return 'checkmark-circle';
      case 'pending':
      case 'in_review':
        return 'time';
      case 'rejected':
        return 'close-circle';
      default:
        return 'ellipse-outline';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'approved':
        return 'Verified';
      case 'pending':
        return 'Pending';
      case 'in_review':
        return 'In Review';
      case 'rejected':
        return 'Rejected';
      case 'expired':
        return 'Expired';
      default:
        return 'Not Verified';
    }
  };

  const getTypeIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'photo':
        return 'camera';
      case 'phone':
        return 'call';
      case 'email':
        return 'mail';
      case 'id':
        return 'card';
      case 'social':
        return 'logo-instagram';
      default:
        return 'shield';
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'photo':
        return 'Photo';
      case 'phone':
        return 'Phone';
      case 'email':
        return 'Email';
      case 'id':
        return 'ID';
      case 'social':
        return 'Social';
      default:
        return type;
    }
  };

  const content = (
    <View
      style={[
        styles.statusBadge,
        {
          backgroundColor: theme.colors.surface,
          borderColor: getStatusColor(),
        },
      ]}
    >
      <View style={styles.statusLeft}>
        <Ionicons name={getTypeIcon()} size={20} color={theme.colors.text} />
        <Text style={[styles.typeLabel, { color: theme.colors.text }]}>
          {getTypeLabel()}
        </Text>
      </View>
      <View style={styles.statusRight}>
        <Ionicons name={getStatusIcon()} size={16} color={getStatusColor()} />
        <Text style={[styles.statusLabel, { color: getStatusColor() }]}>
          {getStatusLabel()}
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${getTypeLabel()} verification: ${getStatusLabel()}`}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

interface VerificationScoreProps {
  score: number;
  showDetails?: boolean;
}

export function VerificationScore({ score, showDetails = false }: VerificationScoreProps) {
  const theme = useTheme();

  const getScoreColor = () => {
    if (score >= 80) return '#22c55e';
    if (score >= 50) return '#f59e0b';
    return theme.colors.textMuted;
  };

  const getScoreLabel = () => {
    if (score >= 80) return 'Highly Verified';
    if (score >= 50) return 'Partially Verified';
    if (score > 0) return 'Basic Verification';
    return 'Not Verified';
  };

  return (
    <View style={styles.scoreContainer}>
      <View style={styles.scoreCircle}>
        <View
          style={[
            styles.scoreProgress,
            {
              borderColor: getScoreColor(),
              transform: [{ rotate: `${(score / 100) * 360}deg` }],
            },
          ]}
        />
        <View style={[styles.scoreInner, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.scoreValue, { color: getScoreColor() }]}>{score}</Text>
        </View>
      </View>
      {showDetails && (
        <View style={styles.scoreDetails}>
          <Text style={[styles.scoreLabel, { color: theme.colors.text }]}>
            {getScoreLabel()}
          </Text>
          <Text style={[styles.scoreSubtitle, { color: theme.colors.textSecondary }]}>
            Trust Score
          </Text>
        </View>
      )}
    </View>
  );
}

interface TrustIndicatorProps {
  photoVerified: boolean;
  phoneVerified: boolean;
  emailVerified: boolean;
  compact?: boolean;
}

export function TrustIndicator({
  photoVerified,
  phoneVerified,
  emailVerified,
  compact = false,
}: TrustIndicatorProps) {
  const theme = useTheme();

  if (compact) {
    const verifiedCount = [photoVerified, phoneVerified, emailVerified].filter(Boolean).length;
    return (
      <View style={styles.compactIndicator}>
        <Ionicons
          name="shield-checkmark"
          size={14}
          color={verifiedCount > 0 ? '#3b82f6' : theme.colors.textMuted}
        />
        <Text
          style={[
            styles.compactText,
            { color: verifiedCount > 0 ? '#3b82f6' : theme.colors.textMuted },
          ]}
        >
          {verifiedCount}/3
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.trustContainer}>
      <View style={styles.trustItem}>
        <Ionicons
          name="camera"
          size={16}
          color={photoVerified ? '#22c55e' : theme.colors.textMuted}
        />
      </View>
      <View style={styles.trustItem}>
        <Ionicons
          name="call"
          size={16}
          color={phoneVerified ? '#22c55e' : theme.colors.textMuted}
        />
      </View>
      <View style={styles.trustItem}>
        <Ionicons
          name="mail"
          size={16}
          color={emailVerified ? '#22c55e' : theme.colors.textMuted}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreCircle: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreProgress: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  scoreInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  scoreDetails: {
    marginTop: 8,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  scoreSubtitle: {
    fontSize: 12,
  },
  compactIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactText: {
    fontSize: 12,
    fontWeight: '500',
  },
  trustContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  trustItem: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
