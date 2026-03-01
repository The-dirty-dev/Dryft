import React, { forwardRef, useCallback, useMemo } from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  Text,
  TextProps,
  View,
  ViewProps,
  Image,
  ImageProps,
  TextInput,
  TextInputProps,
  Switch,
  SwitchProps,
  StyleSheet,
  Platform,
  Pressable,
  PressableProps,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useAccessibilityLabel,
  useAccessibleTouchTarget,
  useHaptics,
  useFontScale,
  useReducedMotion,
  useAccessibleColors,
} from '../../hooks/useAccessibility';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

// ============================================================================
// AccessibleButton
// ============================================================================

export interface AccessibleButtonProps extends TouchableOpacityProps {
  label: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  haptic?: boolean;
}

export const AccessibleButton = forwardRef<any, AccessibleButtonProps>(
  (
    {
      label,
      hint,
      icon,
      iconPosition = 'left',
      variant = 'primary',
      size = 'medium',
      loading = false,
      haptic = true,
      style,
      disabled,
      onPress,
      children,
      ...props
    },
    ref
  ) => {
    const colors = useColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { createButtonLabel } = useAccessibilityLabel();
    const { getStyle: getTouchStyle } = useAccessibleTouchTarget();
    const { medium } = useHaptics();
    const fontScale = useFontScale();
    const { highContrast, getColor } = useAccessibleColors();

    const handlePress = useCallback(
      (e: any) => {
        if (haptic) {
          medium();
        }
        onPress?.(e);
      },
      [haptic, medium, onPress]
    );

    const sizeStyles = {
      small: { paddingVertical: 8, paddingHorizontal: 12, fontSize: 14 },
      medium: { paddingVertical: 12, paddingHorizontal: 16, fontSize: 16 },
      large: { paddingVertical: 16, paddingHorizontal: 24, fontSize: 18 },
    };

    const variantStyles = {
      primary: {
        backgroundColor: getColor(colors.accent, colors.accentSecondary),
        borderWidth: 0,
        borderColor: 'transparent',
        textColor: colors.text,
      },
      secondary: {
        backgroundColor: getColor(colors.border, colors.surfaceSecondary),
        borderWidth: 0,
        borderColor: 'transparent',
        textColor: colors.text,
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: highContrast ? 2 : 1,
        borderColor: getColor(colors.accent, colors.accent),
        textColor: getColor(colors.accent, colors.accent),
      },
      ghost: {
        backgroundColor: 'transparent',
        borderWidth: 0,
        borderColor: 'transparent',
        textColor: getColor(colors.accent, colors.accent),
      },
    };

    const currentSize = sizeStyles[size];
    const currentVariant = variantStyles[variant];

    const accessibilityProps = createButtonLabel(
      loading ? `${label}, loading` : label,
      hint
    );

    const iconSize = currentSize.fontSize * fontScale;

    return (
      <TouchableOpacity
        ref={ref}
        {...accessibilityProps}
        accessibilityState={{
          disabled: disabled || loading,
          busy: loading,
        }}
        style={[
          styles.button,
          getTouchStyle(),
          {
            backgroundColor: currentVariant.backgroundColor,
            borderWidth: currentVariant.borderWidth,
            borderColor: currentVariant.borderColor,
            paddingVertical: currentSize.paddingVertical,
            paddingHorizontal: currentSize.paddingHorizontal,
            opacity: disabled || loading ? 0.5 : 1,
          },
          style,
        ]}
        disabled={disabled || loading}
        onPress={handlePress}
        activeOpacity={0.7}
        {...props}
      >
        {icon && iconPosition === 'left' && (
          <Ionicons
            name={icon}
            size={iconSize}
            color={currentVariant.textColor}
            style={styles.iconLeft}
          />
        )}
        {children || (
          <Text
            style={[
              styles.buttonText,
              {
                color: currentVariant.textColor,
                fontSize: currentSize.fontSize * fontScale,
              },
            ]}
          >
            {label}
          </Text>
        )}
        {icon && iconPosition === 'right' && (
          <Ionicons
            name={icon}
            size={iconSize}
            color={currentVariant.textColor}
            style={styles.iconRight}
          />
        )}
      </TouchableOpacity>
    );
  }
);

// ============================================================================
// AccessibleText
// ============================================================================

export interface AccessibleTextProps extends TextProps {
  variant?: 'heading' | 'subheading' | 'body' | 'caption' | 'label';
  bold?: boolean;
}

export const AccessibleText = forwardRef<Text, AccessibleTextProps>(
  ({ variant = 'body', bold = false, style, children, ...props }, ref) => {
    const colors = useColors();
    const fontScale = useFontScale();
    const { highContrast } = useAccessibleColors();

    const variantStyles = {
      heading: { fontSize: 24, fontWeight: '700' as const, color: colors.text },
      subheading: { fontSize: 18, fontWeight: '600' as const, color: colors.text },
      body: { fontSize: 16, fontWeight: '400' as const, color: colors.textSecondary },
      caption: { fontSize: 14, fontWeight: '400' as const, color: colors.textTertiary },
      label: { fontSize: 12, fontWeight: '500' as const, color: colors.textTertiary },
    };

    const currentStyle = variantStyles[variant];

    return (
      <Text
        ref={ref}
        style={[
          {
            fontSize: currentStyle.fontSize * fontScale,
            fontWeight: bold ? '700' : currentStyle.fontWeight,
            color: highContrast ? colors.text : currentStyle.color,
          },
          style,
        ]}
        {...props}
      >
        {children}
      </Text>
    );
  }
);

// ============================================================================
// AccessibleImage
// ============================================================================

export interface AccessibleImageProps extends ImageProps {
  description: string;
  decorative?: boolean;
}

export const AccessibleImage = forwardRef<Image, AccessibleImageProps>(
  ({ description, decorative = false, ...props }, ref) => {
    const { createImageLabel } = useAccessibilityLabel();

    if (decorative) {
      return (
        <Image
          ref={ref}
          accessible={false}
          importantForAccessibility="no"
          {...props}
        />
      );
    }

    return <Image ref={ref} {...createImageLabel(description)} {...props} />;
  }
);

// ============================================================================
// AccessibleTextInput
// ============================================================================

export interface AccessibleTextInputProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

export const AccessibleTextInput = forwardRef<TextInput, AccessibleTextInputProps>(
  ({ label, hint, error, required, style, ...props }, ref) => {
    const colors = useColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const fontScale = useFontScale();
    const { highContrast } = useAccessibleColors();

    const accessibilityLabel = [
      label,
      required ? 'required' : '',
      error ? `error: ${error}` : '',
    ]
      .filter(Boolean)
      .join(', ');

    return (
      <View style={styles.inputContainer}>
        <Text
          style={[
            styles.inputLabel,
            { fontSize: 14 * fontScale },
            highContrast && styles.inputLabelHighContrast,
          ]}
        >
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
        <TextInput
          ref={ref}
          accessible
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={hint}
          accessibilityState={{
            disabled: props.editable === false,
          }}
          style={[
            styles.input,
            { fontSize: 16 * fontScale },
            !!error && styles.inputError,
            highContrast && styles.inputHighContrast,
            style,
          ]}
          placeholderTextColor={colors.textMuted}
          {...props}
        />
        {error && (
          <Text
            style={[styles.errorText, { fontSize: 12 * fontScale }]}
            accessibilityRole="alert"
          >
            {error}
          </Text>
        )}
      </View>
    );
  }
);

// ============================================================================
// AccessibleSwitch
// ============================================================================

export interface AccessibleSwitchProps extends Omit<SwitchProps, 'value'> {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function AccessibleSwitch({
  label,
  hint,
  value,
  onValueChange,
  ...props
}: AccessibleSwitchProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { selection } = useHaptics();
  const fontScale = useFontScale();
  const { getStyle: getTouchStyle } = useAccessibleTouchTarget();

  const handleChange = useCallback(
    (newValue: boolean) => {
      selection();
      onValueChange(newValue);
    },
    [selection, onValueChange]
  );

  return (
    <Pressable
      style={[styles.switchContainer, getTouchStyle()]}
      accessible
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: value }}
      onPress={() => handleChange(!value)}
    >
      <Text style={[styles.switchLabel, { fontSize: 16 * fontScale }]}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={handleChange}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={value ? colors.text : colors.textTertiary}
        ios_backgroundColor={colors.border}
        {...props}
      />
    </Pressable>
  );
}

// ============================================================================
// AccessibleIconButton
// ============================================================================

export interface AccessibleIconButtonProps extends TouchableOpacityProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  size?: number;
  color?: string;
  haptic?: boolean;
}

export const AccessibleIconButton = forwardRef<any, AccessibleIconButtonProps>(
  (
    {
      icon,
      label,
      hint,
      size = 24,
      color,
      haptic = true,
      style,
      onPress,
      ...props
    },
    ref
  ) => {
    const colors = useColors();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { createButtonLabel } = useAccessibilityLabel();
    const { getStyle: getTouchStyle, minSize } = useAccessibleTouchTarget();
    const { light } = useHaptics();
    const iconColor = color ?? colors.text;

    const handlePress = useCallback(
      (e: any) => {
        if (haptic) {
          light();
        }
        onPress?.(e);
      },
      [haptic, light, onPress]
    );

    return (
      <TouchableOpacity
        ref={ref}
        {...createButtonLabel(label, hint)}
        style={[
          styles.iconButton,
          getTouchStyle(minSize, minSize),
          style,
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
        {...props}
      >
        <Ionicons name={icon} size={size} color={iconColor} />
      </TouchableOpacity>
    );
  }
);

// ============================================================================
// AccessibleCard
// ============================================================================

export interface AccessibleCardProps extends PressableProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

export function AccessibleCard({
  label,
  hint,
  children,
  style,
  ...props
}: AccessibleCardProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reduceMotion = useReducedMotion();
  const { createButtonLabel } = useAccessibilityLabel();
  const { light } = useHaptics();

  return (
    <Pressable
      {...createButtonLabel(label, hint)}
      style={({ pressed }) => [
        styles.card,
        !reduceMotion && pressed && styles.cardPressed,
        style as ViewStyle,
      ]}
      onPressIn={() => light()}
      {...props}
    >
      {children}
    </Pressable>
  );
}

// ============================================================================
// AccessibleLink
// ============================================================================

export interface AccessibleLinkProps extends TouchableOpacityProps {
  children: React.ReactNode;
  hint?: string;
}

export function AccessibleLink({
  children,
  hint,
  style,
  ...props
}: AccessibleLinkProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const fontScale = useFontScale();
  const { highContrast, getColor } = useAccessibleColors();

  return (
    <TouchableOpacity
      accessible
      accessibilityRole="link"
      accessibilityHint={hint}
      style={style}
      {...props}
    >
      <Text
        style={[
          styles.linkText,
          {
            fontSize: 16 * fontScale,
            color: getColor(colors.accent, colors.accentSecondary),
            textDecorationLine: highContrast ? 'underline' : 'none',
          },
        ]}
      >
        {children}
      </Text>
    </TouchableOpacity>
  );
}

// ============================================================================
// SkipToContent (for screen readers)
// ============================================================================

export interface SkipToContentProps {
  targetRef: React.RefObject<any>;
  label?: string;
}

export function SkipToContent({
  targetRef,
  label = 'Skip to main content',
}: SkipToContentProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { isScreenReaderEnabled, focusOn } = require('../../hooks/useAccessibility').useScreenReader();

  if (!isScreenReaderEnabled) {
    return null;
  }

  return (
    <TouchableOpacity
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => focusOn(targetRef)}
      style={styles.skipLink}
    >
      <Text style={styles.skipLinkText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ============================================================================
// Styles
// ============================================================================

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  buttonText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    color: colors.textTertiary,
    marginBottom: 6,
  },
  inputLabelHighContrast: {
    color: colors.text,
  },
  required: {
    color: colors.error,
  },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputHighContrast: {
    borderWidth: 2,
    borderColor: colors.text,
  },
  errorText: {
    color: colors.error,
    marginTop: 4,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  switchLabel: {
    color: colors.text,
    flex: 1,
    marginRight: 12,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  linkText: {
    fontWeight: '500',
  },
  skipLink: {
    position: 'absolute',
    top: -100,
    left: 0,
    right: 0,
    backgroundColor: colors.accent,
    padding: 12,
    zIndex: 1000,
  },
  skipLinkText: {
    color: colors.text,
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default {
  AccessibleButton,
  AccessibleText,
  AccessibleImage,
  AccessibleTextInput,
  AccessibleSwitch,
  AccessibleIconButton,
  AccessibleCard,
  AccessibleLink,
  SkipToContent,
};
