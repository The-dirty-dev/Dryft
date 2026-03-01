import React from 'react';
import { ActivityIndicator, StyleSheet, View, ViewStyle } from 'react-native';

export interface LoadingIndicatorProps {
  size?: 'small' | 'large';
  color?: string;
  style?: ViewStyle;
}

export default function LoadingIndicator({
  size = 'large',
  color = '#e94560',
  style,
}: LoadingIndicatorProps) {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
