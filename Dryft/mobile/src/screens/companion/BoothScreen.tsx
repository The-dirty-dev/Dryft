import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useColors, ThemeColors } from '../../theme/ThemeProvider';

export interface BoothSummary {
  id: string;
  name: string;
  inviteOnly: boolean;
}

const DEFAULT_BOOTHS: BoothSummary[] = [
  { id: 'booth-1', name: 'Couples Lounge', inviteOnly: true },
  { id: 'booth-2', name: 'Private Party', inviteOnly: false },
];

export default function BoothScreen({ booths = DEFAULT_BOOTHS }: { booths?: BoothSummary[] }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation();

  if (booths.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No booths available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Private Booths</Text>
      <FlatList
        data={booths}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => navigation.navigate('Companion' as never, { boothId: item.id } as never)}
          >
            <Text style={styles.name}>{item.name}</Text>
            {item.inviteOnly && <Text style={styles.lock}>🔒 Invite Only</Text>}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
    },
    item: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
    },
    name: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    lock: {
      marginTop: 6,
      color: colors.textSecondary,
      fontSize: 12,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '600',
    },
  });
