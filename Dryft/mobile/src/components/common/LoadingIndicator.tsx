import React from 'react';
import { ActivityIndicator, StyleSheet, View, ViewStyle } from 'react-native';
import { useColors } from '../../theme/ThemeProvider';

export interface LoadingIndicatorProps {
  size?: 'small' | 'large';
  color?: string;
  style?: ViewStyle;
}

export default function LoadingIndicator({
  size = 'large',
  color,
  style,
}: LoadingIndicatorProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={color ?? colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
