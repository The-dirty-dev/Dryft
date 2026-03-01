import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

export interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export default function Card({ children, style }: CardProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={[styles.card, style]}>{children}</View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.backgroundSecondary,
  },
});
