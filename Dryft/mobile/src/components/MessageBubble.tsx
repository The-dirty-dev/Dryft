import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useColors, ThemeColors } from '../theme/ThemeProvider';

export interface MessageBubbleData {
  text?: string;
  imageUrl?: string;
  timestamp: string;
  isSent: boolean;
}

export default function MessageBubble({ message }: { message: MessageBubbleData }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.container, message.isSent ? styles.sent : styles.received]}>
      <View style={[styles.bubble, message.isSent ? styles.sentBubble : styles.receivedBubble]}>
        {message.imageUrl ? (
          <Image source={{ uri: message.imageUrl }} style={styles.image} />
        ) : null}
        {message.text ? <Text style={styles.text}>{message.text}</Text> : null}
      </View>
      <Text style={styles.timestamp}>{message.timestamp}</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      marginBottom: 8,
      maxWidth: '82%',
    },
    sent: {
      alignSelf: 'flex-end',
    },
    received: {
      alignSelf: 'flex-start',
    },
    bubble: {
      borderRadius: 14,
      padding: 10,
      borderWidth: 1,
    },
    sentBubble: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    receivedBubble: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    text: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 18,
    },
    image: {
      width: 160,
      height: 120,
      borderRadius: 10,
      marginBottom: 8,
      backgroundColor: colors.backgroundSecondary,
    },
    timestamp: {
      marginTop: 4,
      color: colors.textSecondary,
      fontSize: 11,
      alignSelf: 'flex-end',
    },
  });
