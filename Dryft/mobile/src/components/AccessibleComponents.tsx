import React, { forwardRef, useCallback } from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewProps,
  Text,
  TextProps,
  TextInput,
  TextInputProps,
  Image,
  ImageProps,
  StyleSheet,
  AccessibilityRole,
  AccessibilityState,
  Platform,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  useAccessibilitySettings,
  getMinTouchTarget,
  getAnimationDuration,
  announceForAccessibility,
} from '../utils/accessibility';
import { useColors } from '../theme/ThemeProvider';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

// Accessible Button with proper touch targets and haptic feedback
interface AccessibleButtonProps extends Omit<TouchableOpacityProps, 'role'> {
  label: string;
  hint?: string;
  role?: AccessibilityRole;
  state?: AccessibilityState;
  hapticFeedback?: boolean;
  children: React.ReactNode;
}

export const AccessibleButton = forwardRef<TouchableOpacity, AccessibleButtonProps>(
  (
    {
      label,
      hint,
      role = 'button',
      state,
      hapticFeedback = true,
      onPress,
      style,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const { settings } = useAccessibilitySettings();
    const minSize = getMinTouchTarget(settings.extendedTouchTargets);

    const handlePress = useCallback(
      (event: any) => {
        if (hapticFeedback && settings.hapticFeedback) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress?.(event);
      },
      [onPress, hapticFeedback, settings.hapticFeedback]
    );

    return (
      <TouchableOpacity
        ref={ref}
        accessible={true}
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityRole={role}
        accessibilityState={{ disabled, ...state }}
        onPress={handlePress}
        disabled={disabled}
        style={[{ minHeight: minSize, minWidth: minSize }, style]}
        activeOpacity={settings.reduceMotion ? 1 : 0.7}
        {...props}
      >
        {children}
      </TouchableOpacity>
    );
  }
);

// Accessible Icon Button (for icon-only buttons)
interface AccessibleIconButtonProps extends TouchableOpacityProps {
  label: string;
  hint?: string;
  icon: React.ReactNode;
  size?: number;
}

export const AccessibleIconButton = forwardRef<TouchableOpacity, AccessibleIconButtonProps>(
  ({ label, hint, icon, size = 44, style, onPress, ...props }, ref) => {
    const { settings } = useAccessibilitySettings();
    const minSize = Math.max(size, getMinTouchTarget(settings.extendedTouchTargets));

    const handlePress = useCallback(
      (event: any) => {
        if (settings.hapticFeedback) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress?.(event);
      },
      [onPress, settings.hapticFeedback]
    );

    return (
      <TouchableOpacity
        ref={ref}
        accessible={true}
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityRole="button"
        onPress={handlePress}
        style={[
          styles.iconButton,
          { width: minSize, height: minSize },
          style,
        ]}
        {...props}
      >
        {icon}
      </TouchableOpacity>
    );
  }
);

// Accessible Text with dynamic sizing
interface AccessibleTextProps extends TextProps {
  variant?: 'body' | 'heading' | 'caption' | 'label';
  children: React.ReactNode;
}

export const AccessibleText: React.FC<AccessibleTextProps> = ({
  variant = 'body',
  style,
  children,
  ...props
}) => {
  const { settings } = useAccessibilitySettings();

  const baseSizes = {
    heading: 24,
    body: 16,
    label: 14,
    caption: 12,
  };

  const scaledSize = baseSizes[variant] * settings.fontScale;
  const fontWeight = settings.boldTextEnabled ? '700' : undefined;

  return (
    <Text
      accessible={true}
      accessibilityRole={variant === 'heading' ? 'header' : 'text'}
      style={[
        { fontSize: scaledSize, fontWeight },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};

// Accessible Image with required alt text
interface AccessibleImageProps extends ImageProps {
  alt: string;
  isDecorative?: boolean;
}

export const AccessibleImage: React.FC<AccessibleImageProps> = ({
  alt,
  isDecorative = false,
  ...props
}) => {
  return (
    <Image
      accessible={!isDecorative}
      accessibilityLabel={isDecorative ? undefined : alt}
      accessibilityRole={isDecorative ? undefined : 'image'}
      {...props}
    />
  );
};

// Accessible Text Input
interface AccessibleInputProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

export const AccessibleInput = forwardRef<TextInput, AccessibleInputProps>(
  ({ label, hint, error, required, style, ...props }, ref) => {
    const { settings } = useAccessibilitySettings();
    const fontSize = 16 * settings.fontScale;

    const accessibilityLabel = `${label}${required ? ', required' : ''}${
      error ? `, error: ${error}` : ''
    }`;

    return (
      <TextInput
        ref={ref}
        accessible={true}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={hint}
        accessibilityRole="none"
        accessibilityState={{ disabled: props.editable === false }}
        style={[{ fontSize, minHeight: 48 }, style]}
        {...props}
      />
    );
  }
);

// Accessible Card (for profile cards, etc.)
interface AccessibleCardProps extends ViewProps {
  label: string;
  hint?: string;
  onPress?: () => void;
  children: React.ReactNode;
}

export const AccessibleCard: React.FC<AccessibleCardProps> = ({
  label,
  hint,
  onPress,
  style,
  children,
  ...props
}) => {
  const { settings } = useAccessibilitySettings();

  if (onPress) {
    return (
      <Pressable
        accessible={true}
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityRole="button"
        onPress={() => {
          if (settings.hapticFeedback) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          onPress();
        }}
        style={style}
        {...props}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View
      accessible={true}
      accessibilityLabel={label}
      accessibilityRole="summary"
      style={style}
      {...props}
    >
      {children}
    </View>
  );
};

// Accessible Toggle/Switch
interface AccessibleToggleProps {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export const AccessibleToggle: React.FC<AccessibleToggleProps> = ({
  label,
  hint,
  value,
  onValueChange,
  disabled,
}) => {
  const { settings } = useAccessibilitySettings();
  const colors = useColors();

  const handlePress = () => {
    if (settings.hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onValueChange(!value);
    announceForAccessibility(`${label} ${!value ? 'on' : 'off'}`);
  };

  return (
    <Pressable
      accessible={true}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      onPress={handlePress}
      disabled={disabled}
      style={[
        styles.toggle,
        { backgroundColor: withAlpha(colors.text, '33') },
        value && { backgroundColor: colors.primary },
        disabled && styles.toggleDisabled,
      ]}
    >
      <View
        style={[
          styles.toggleThumb,
          { backgroundColor: colors.text },
          value && styles.toggleThumbOn,
        ]}
      />
    </Pressable>
  );
};

// Accessible Progress Indicator
interface AccessibleProgressProps {
  value: number; // 0-100
  label: string;
}

export const AccessibleProgress: React.FC<AccessibleProgressProps> = ({
  value,
  label,
}) => {
  const colors = useColors();

  return (
    <View
      accessible={true}
      accessibilityLabel={`${label}: ${Math.round(value)}%`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: value }}
      style={[styles.progressContainer, { backgroundColor: withAlpha(colors.text, '1A') }]}
    >
      <View
        style={[
          styles.progressBar,
          { width: `${value}%`, backgroundColor: colors.primary },
        ]}
      />
    </View>
  );
};

// Live region for announcements
interface LiveRegionProps {
  message: string;
  politeness?: 'polite' | 'assertive';
}

export const LiveRegion: React.FC<LiveRegionProps> = ({
  message,
  politeness = 'polite',
}) => {
  return (
    <View
      accessible={true}
      accessibilityLiveRegion={politeness}
      accessibilityRole="alert"
      style={styles.liveRegion}
    >
      <Text style={styles.liveRegionText}>{message}</Text>
    </View>
  );
};

// Skip link for screen readers
interface SkipLinkProps {
  targetRef: React.RefObject<View>;
  label?: string;
}

export const SkipLink: React.FC<SkipLinkProps> = ({
  targetRef,
  label = 'Skip to main content',
}) => {
  const colors = useColors();

  const handlePress = () => {
    if (targetRef.current) {
      targetRef.current.focus?.();
    }
  };

  return (
    <TouchableOpacity
      accessible={true}
      accessibilityLabel={label}
      accessibilityRole="link"
      onPress={handlePress}
      style={styles.skipLink}
    >
      <Text style={[styles.skipLinkText, { color: colors.text, backgroundColor: colors.primary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  iconButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggle: {
    width: 52,
    height: 32,
    borderRadius: 16,
    padding: 2,
  },
  toggleDisabled: {
    opacity: 0.5,
  },
  toggleThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  toggleThumbOn: {
    transform: [{ translateX: 20 }],
  },
  progressContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  liveRegion: {
    position: 'absolute',
    left: -9999,
    width: 1,
    height: 1,
  },
  liveRegionText: {
    fontSize: 1,
  },
  skipLink: {
    position: 'absolute',
    top: -100,
    left: 0,
    zIndex: 999,
  },
  skipLinkText: {
    padding: 12,
  },
});
