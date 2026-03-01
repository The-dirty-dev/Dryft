import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useMatchingStore } from '../../store/matchingStore';
import { useChatSocket } from '../../hooks/useChatSocket';
import { Match } from '../../types';
import { RootStackParamList } from '../../navigation';
import { Button } from '../../components/common';
import { useColors, ThemeColors } from '../../theme/ThemeProvider';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function MatchesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const colors = useColors();
  const styles = createStyles(colors);
  const { matches, isLoadingMatches, loadMatches, unmatch } = useMatchingStore();
  const [refreshing, setRefreshing] = useState(false);

  // WebSocket handlers for real-time updates
  const handleNewMessage = useCallback(
    (payload: { conversation_id: string; sender_id: string; content: string; created_at: number }) => {
      const store = useMatchingStore.getState();
      const updatedMatches = store.matches
        .map((match) => {
          if (match.other_user.id === payload.sender_id) {
            return {
              ...match,
              last_message: payload.content,
              last_message_at: new Date(payload.created_at).toISOString(),
              unread_count: (match.unread_count || 0) + 1,
            };
          }
          return match;
        })
        .sort((a, b) => {
          const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
          const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
          return bTime - aTime;
        });
      useMatchingStore.setState({ matches: updatedMatches });
    },
    []
  );

  const handleNewMatch = useCallback(
    (payload: { match_id: string; conversation_id: string; user: { id: string; display_name: string; photo_url?: string }; matched_at: number }) => {
      const newMatch: Match = {
        id: payload.match_id,
        other_user: {
          id: payload.user.id,
          display_name: payload.user.display_name,
          profile_photo: payload.user.photo_url,
        },
        matched_at: new Date(payload.matched_at).toISOString(),
        unread_count: 0,
      };
      const store = useMatchingStore.getState();
      useMatchingStore.setState({ matches: [newMatch, ...store.matches] });
    },
    []
  );

  const handleUnmatched = useCallback(
    (payload: { match_id: string }) => {
      const store = useMatchingStore.getState();
      useMatchingStore.setState({
        matches: store.matches.filter((match) => match.id !== payload.match_id),
      });
    },
    []
  );

  useChatSocket({
    onNewMessage: handleNewMessage,
    onNewMatch: handleNewMatch,
    onUnmatched: handleUnmatched,
  });

  useEffect(() => {
    loadMatches();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMatches();
    setRefreshing(false);
  };

  const handleMatchPress = (match: Match) => {
    navigation.navigate('Chat' as any, { matchId: match.id, user: match.other_user });
  };

  const handleUnmatch = (match: Match) => {
    Alert.alert(
      t('alerts.matches.unmatchTitle'),
      t('alerts.matches.unmatchMessage', { name: match.other_user.display_name }),
      [
        { text: t('alerts.matches.unmatchCancel'), style: 'cancel' },
        {
          text: t('alerts.matches.unmatchConfirm'),
          style: 'destructive',
          onPress: () => unmatch(match.id),
        },
      ]
    );
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return 'Today';
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const renderMatch = ({ item }: { item: Match }) => (
    <TouchableOpacity
      style={styles.matchItem}
      onPress={() => handleMatchPress(item)}
      onLongPress={() => handleUnmatch(item)}
    >
      <Image
        source={{
          uri: item.other_user.profile_photo || 'https://via.placeholder.com/100',
        }}
        style={styles.matchPhoto}
      />
      {item.unread_count > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unread_count}</Text>
        </View>
      )}
      <View style={styles.matchInfo}>
        <View style={styles.matchHeader}>
          <Text style={styles.matchName}>{item.other_user.display_name}</Text>
          <Text style={styles.matchTime}>
            {item.last_message_at
              ? formatTime(item.last_message_at)
              : formatTime(item.matched_at)}
          </Text>
        </View>
        <Text
          style={[
            styles.matchMessage,
            item.unread_count > 0 && styles.unreadMessage,
          ]}
          numberOfLines={1}
        >
          {item.last_message || 'Start a conversation!'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderNewMatches = () => {
    const newMatches = matches.filter((m) => !m.last_message);
    if (newMatches.length === 0) return null;

    return (
      <View style={styles.newMatchesSection}>
        <Text style={styles.sectionTitle}>New Matches</Text>
        <FlatList
          horizontal
          data={newMatches}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.newMatchItem}
              onPress={() => handleMatchPress(item)}
            >
              <Image
                source={{
                  uri: item.other_user.profile_photo || 'https://via.placeholder.com/80',
                }}
                style={styles.newMatchPhoto}
              />
              <Text style={styles.newMatchName} numberOfLines={1}>
                {item.other_user.display_name}
              </Text>
            </TouchableOpacity>
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.newMatchesList}
        />
      </View>
    );
  };

  if (isLoadingMatches && matches.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const conversationMatches = matches.filter((m) => m.last_message);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Matches</Text>
        <View style={styles.placeholder} />
      </View>

      {matches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No matches yet</Text>
          <Text style={styles.emptySubtitle}>
            Keep swiping to find your perfect match
          </Text>
          <Button
            title="Start Discovering"
            onPress={() => navigation.goBack()}
            style={styles.discoverButton}
            textStyle={styles.discoverButtonText}
          />
        </View>
      ) : (
        <FlatList
          data={conversationMatches}
          keyExtractor={(item) => item.id}
          renderItem={renderMatch}
          ListHeaderComponent={renderNewMatches}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    fontSize: 28,
    color: colors.text,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  placeholder: {
    width: 28,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  discoverButton: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  discoverButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  listContent: {
    paddingBottom: 100,
  },
  newMatchesSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSecondary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  newMatchesList: {
    paddingHorizontal: 16,
    gap: 16,
  },
  newMatchItem: {
    alignItems: 'center',
    width: 80,
  },
  newMatchPhoto: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  newMatchName: {
    marginTop: 8,
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
  },
  matchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  matchPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  unreadBadge: {
    position: 'absolute',
    left: 60,
    top: 10,
    backgroundColor: colors.primary,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  unreadText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
  },
  matchInfo: {
    flex: 1,
    marginLeft: 16,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  matchName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  matchTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  matchMessage: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  unreadMessage: {
    color: colors.text,
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: colors.backgroundSecondary,
    marginLeft: 96,
  },
});
