import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  GestureResponderEvent,
} from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';

export interface ButtonProps {
  title: string;
  onPress: (event: GestureResponderEvent) => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        stylesByVariant[variant],
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : '#e94560'} />
      ) : (
        <Text style={[styles.text, textByVariant[variant], textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  disabled: {
    opacity: 0.7,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});

const stylesByVariant: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: '#e94560',
  },
  secondary: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#16213e',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#e94560',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
};

const textByVariant: Record<ButtonVariant, TextStyle> = {
  primary: {
    color: '#fff',
  },
  secondary: {
    color: '#fff',
  },
  outline: {
    color: '#e94560',
  },
  ghost: {
    color: '#e94560',
  },
};
