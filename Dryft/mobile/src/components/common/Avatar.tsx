import React from 'react';
import { View, Text, StyleSheet, ViewStyle, ImageStyle } from 'react-native';
import { Image } from 'expo-image';

export interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number;
  style?: ViewStyle | ImageStyle;
}

export default function Avatar({ uri, name, size = 72, style }: AvatarProps) {
  const initial = name?.trim()?.charAt(0).toUpperCase() || '?';

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, { width: size, height: size, borderRadius: size / 2 }, style]}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#1a1a2e',
  },
  placeholder: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#16213e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: '#e94560',
    fontWeight: '700',
  },
});
