import React, { forwardRef, useMemo } from 'react';
import {
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

export interface InputProps extends TextInputProps {
  error?: boolean;
  containerStyle?: ViewStyle;
}

const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    style,
    placeholderTextColor,
    error = false,
    containerStyle,
    ...props
  },
  ref
) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TextInput
      ref={ref}
      {...props}
      placeholderTextColor={placeholderTextColor ?? colors.textSecondary}
      style={[
        styles.input,
        error && styles.inputError,
        containerStyle,
        style,
      ]}
    />
  );
});

Input.displayName = 'Input';

export default Input;

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.backgroundSecondary,
  },
  inputError: {
    borderColor: colors.primary,
  },
});
