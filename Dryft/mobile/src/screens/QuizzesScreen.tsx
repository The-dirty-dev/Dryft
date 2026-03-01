import React, { useState } from 'react';
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

const CATEGORY_COLORS: Record<string, string[]> = {
  KNOW_YOUR_PARTNER: ['#6B46C1', '#9333EA'],
  COMPATIBILITY: ['#EC4899', '#F472B6'],
  COMMUNICATION: ['#3B82F6', '#60A5FA'],
  LOVE_LANGUAGE: ['#EF4444', '#F87171'],
  FUTURE_GOALS: ['#10B981', '#34D399'],
  FUN: ['#F59E0B', '#FBBF24'],
  RELATIONSHIP_HEALTH: ['#8B5CF6', '#A78BFA'],
};

export default function QuizzesScreen() {
  const navigation = useNavigation<any>();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();

  const { quizzes, categories, loading, refresh } = useQuizzes(selectedCategory);

  const renderQuiz = ({ item }: { item: Quiz }) => {
    const colors = CATEGORY_COLORS[item.category] || ['#6B46C1', '#9333EA'];

    return (
      <TouchableOpacity
        style={styles.quizCard}
        onPress={() => navigation.navigate('QuizDetail', { quizId: item.id })}
      >
        <LinearGradient colors={colors} style={styles.quizGradient}>
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
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#fff" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    color: '#fff',
    fontSize: 24,
  },
  headerTitle: {
    color: '#fff',
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
    backgroundColor: '#1F1F2E',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 4,
    minWidth: 80,
  },
  categoryCardActive: {
    backgroundColor: '#6B46C1',
  },
  categoryIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  categoryName: {
    color: '#fff',
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
    color: '#9CA3AF',
    fontSize: 14,
  },
  clearFilter: {
    color: '#EC4899',
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
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 'auto',
  },
  attemptedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  premiumBadge: {
    backgroundColor: '#FCD34D',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  premiumText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '600',
  },
  quizTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  quizDesc: {
    color: 'rgba(255,255,255,0.8)',
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
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  xpBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  xpText: {
    color: '#FCD34D',
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
    color: '#9CA3AF',
    fontSize: 16,
  },
});
