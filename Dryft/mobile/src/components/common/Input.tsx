import React, { forwardRef } from 'react';
import {
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';

export interface InputProps extends TextInputProps {
  error?: boolean;
  containerStyle?: ViewStyle;
}

const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    style,
    placeholderTextColor = '#8892b0',
    error = false,
    containerStyle,
    ...props
  },
  ref
) {
  return (
    <TextInput
      ref={ref}
      {...props}
      placeholderTextColor={placeholderTextColor}
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

const styles = StyleSheet.create({
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#16213e',
  },
  inputError: {
    borderColor: '#e94560',
  },
});
