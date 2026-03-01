import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useQuizzes } from '../hooks/useCouples';
import type { Quiz } from '../services/couples';
import { ThemeColors, useColors } from '../theme/ThemeProvider';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

const getCategoryGradients = (colors: ThemeColors): Record<string, [string, string]> => ({
  KNOW_YOUR_PARTNER: [colors.accentSecondary, colors.accent],
  COMPATIBILITY: [colors.accentPink, colors.primaryLight],
  COMMUNICATION: [colors.info, colors.superLike],
  LOVE_LANGUAGE: [colors.error, colors.primary],
  FUTURE_GOALS: [colors.success, colors.like],
  FUN: [colors.warning, colors.accentYellow],
  RELATIONSHIP_HEALTH: [colors.accent, colors.primaryLight],
});

export default function QuizzesScreen() {
  const navigation = useNavigation<any>();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const categoryGradients = useMemo(() => getCategoryGradients(colors), [colors]);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();

  const { quizzes, categories, loading, refresh } = useQuizzes(selectedCategory);

  const renderQuiz = ({ item }: { item: Quiz }) => {
    const gradientColors = categoryGradients[item.category] || [colors.accentSecondary, colors.accent];

    return (
      <TouchableOpacity
        style={styles.quizCard}
        onPress={() => navigation.navigate('QuizDetail', { quizId: item.id })}
      >
        <LinearGradient colors={gradientColors} style={styles.quizGradient}>
          <View style={styles.quizHeader}>
            <Text style={styles.quizIcon}>{item.icon_url || '🧠'}</Text>
            {item.is_attempted && (
              <View style={styles.attemptedBadge}>
                <Text style={styles.attemptedText}>Taken</Text>
              </View>
            )}
            {item.is_premium && (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumText}>Premium</Text>
              </View>
            )}
          </View>

          <Text style={styles.quizTitle}>{item.title}</Text>
          <Text style={styles.quizDesc} numberOfLines={2}>
            {item.description}
          </Text>

          <View style={styles.quizMeta}>
            <View style={styles.metaItem}>
              <Text style={styles.metaText}>
                {item.question_count} questions
              </Text>
            </View>
            {item.time_limit && (
              <View style={styles.metaItem}>
                <Text style={styles.metaText}>
                  {Math.floor(item.time_limit / 60)} min
                </Text>
              </View>
            )}
            <View style={styles.xpBadge}>
              <Text style={styles.xpText}>+{item.xp_reward} XP</Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderCategory = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[
        styles.categoryCard,
        selectedCategory === item.id && styles.categoryCardActive,
      ]}
      onPress={() =>
        setSelectedCategory(selectedCategory === item.id ? undefined : item.id)
      }
    >
      <Text style={styles.categoryIcon}>{item.icon}</Text>
      <Text style={styles.categoryName}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Relationship Quizzes</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Category Filter */}
      <FlatList
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryList}
        contentContainerStyle={styles.categoryContent}
      />

      {/* Quizzes List */}
      <FlatList
        data={quizzes}
        renderItem={renderQuiz}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.text} />
        }
        ListHeaderComponent={
          selectedCategory ? (
            <View style={styles.filterHeader}>
              <Text style={styles.filterText}>
                Showing: {categories.find((c) => c.id === selectedCategory)?.name}
              </Text>
              <TouchableOpacity onPress={() => setSelectedCategory(undefined)}>
                <Text style={styles.clearFilter}>Clear</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🧠</Text>
            <Text style={styles.emptyText}>No quizzes found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    color: colors.text,
    fontSize: 24,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  categoryList: {
    maxHeight: 100,
    marginBottom: 8,
  },
  categoryContent: {
    paddingHorizontal: 12,
  },
  categoryCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 4,
    minWidth: 80,
  },
  categoryCardActive: {
    backgroundColor: colors.accentSecondary,
  },
  categoryIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  categoryName: {
    color: colors.text,
    fontSize: 12,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filterText: {
    color: colors.textTertiary,
    fontSize: 14,
  },
  clearFilter: {
    color: colors.accentPink,
    fontSize: 14,
  },
  quizCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  quizGradient: {
    padding: 20,
  },
  quizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  quizIcon: {
    fontSize: 32,
  },
  attemptedBadge: {
    backgroundColor: withAlpha(colors.text, '4D'),
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  attemptedText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  premiumBadge: {
    backgroundColor: colors.accentYellow,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  premiumText: {
    color: colors.textInverse,
    fontSize: 12,
    fontWeight: '600',
  },
  quizTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  quizDesc: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  quizMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaItem: {
    marginRight: 16,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  xpBadge: {
    backgroundColor: withAlpha(colors.text, '33'),
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  xpText: {
    color: colors.accentYellow,
    fontSize: 14,
    fontWeight: 'bold',
  },
  empty: {
    alignItems: 'center',
    padding: 48,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: 16,
  },
});
