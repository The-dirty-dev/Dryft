import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import type { TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import apiClient from '../../api/client';
import { Input } from '../../components/common';

interface SearchResult {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender: {
    id: string;
    display_name: string | null;
    profile_photo: string | null;
  };
  other_user?: {
    id: string;
    display_name: string | null;
    profile_photo: string | null;
  };
  content: string;
  type: string;
  highlighted_content: string;
  created_at: string;
}

type MessageSearchRouteProp = RouteProp<
  { MessageSearch: { conversationId?: string; matchId?: string; userName?: string } },
  'MessageSearch'
>;

export default function MessageSearchScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<MessageSearchRouteProp>();
  const { conversationId, matchId, userName } = route.params || {};

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    // Auto-focus on mount
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.trim().length < 2) {
        setResults([]);
        setSearched(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setSearched(true);

        let response;
        if (conversationId) {
          // Search within conversation
          response = await apiClient.get<{ query: string; results: SearchResult[] }>(
            `/v1/chat/conversations/${conversationId}/search?q=${encodeURIComponent(searchQuery)}&limit=50`
          );
        } else {
          // Search all conversations
          response = await apiClient.get<{ query: string; results: SearchResult[] }>(
            `/v1/chat/search?q=${encodeURIComponent(searchQuery)}&limit=50`
          );
        }

        if (response.success && response.data) {
          setResults(response.data.results);
        } else {
          setError(response.error || 'Search failed');
        }
      } catch (err: any) {
        setError(err.message || 'Search failed');
      } finally {
        setLoading(false);
      }
    },
    [conversationId]
  );

  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);

      // Debounce search
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        performSearch(text);
      }, 300);
    },
    [performSearch]
  );

  const handleResultPress = useCallback(
    (result: SearchResult) => {
      Keyboard.dismiss();
      navigation.navigate('Chat', {
        matchId: matchId || result.conversation_id,
        user: {
          id: result.other_user?.id || result.sender.id,
          display_name: result.other_user?.display_name || result.sender.display_name,
          profile_photo: result.other_user?.profile_photo || result.sender.profile_photo,
        },
        highlightMessageId: result.id,
      });
    },
    [navigation, matchId]
  );

  const renderHighlightedText = useCallback((text: string) => {
    // Split on ** markers and render highlighted portions
    const parts = text.split(/\*\*(.*?)\*\*/);
    return (
      <Text style={styles.resultContent}>
        {parts.map((part, index) => {
          // Odd indices are highlighted (wrapped in **)
          if (index % 2 === 1) {
            return (
              <Text key={index} style={styles.highlightedText}>
                {part}
              </Text>
            );
          }
          return <Text key={index}>{part}</Text>;
        })}
      </Text>
    );
  }, []);

  const renderResult = useCallback(
    ({ item }: { item: SearchResult }) => {
      const displayUser = item.other_user || item.sender;

      return (
        <TouchableOpacity style={styles.resultCard} onPress={() => handleResultPress(item)}>
          <View style={styles.resultHeader}>
            {displayUser.profile_photo ? (
              <Image
                source={{ uri: displayUser.profile_photo }}
                style={styles.resultAvatar}
              />
            ) : (
              <View style={[styles.resultAvatar, styles.resultAvatarPlaceholder]}>
                <Text style={styles.resultAvatarText}>
                  {displayUser.display_name?.charAt(0) || '?'}
                </Text>
              </View>
            )}
            <View style={styles.resultMeta}>
              <Text style={styles.resultName}>
                {conversationId ? '' : displayUser.display_name}
              </Text>
              <Text style={styles.resultDate}>{formatDate(item.created_at)}</Text>
            </View>
          </View>

          {renderHighlightedText(item.highlighted_content)}
        </TouchableOpacity>
      );
    },
    [conversationId, handleResultPress, renderHighlightedText]
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>

        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Input
            ref={inputRef}
            style={styles.searchInput}
            placeholder={
              conversationId
                ? `Search in ${userName || 'conversation'}...`
                : 'Search all messages...'
            }
            placeholderTextColor="#6B7280"
            value={query}
            onChangeText={handleQueryChange}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => performSearch(query)}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setQuery('');
                setResults([]);
                setSearched(false);
              }}
              style={styles.clearButton}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#EC4899" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !searched ? (
        <View style={styles.hintContainer}>
          <Text style={styles.hintIcon}>💬</Text>
          <Text style={styles.hintTitle}>Search Messages</Text>
          <Text style={styles.hintText}>
            {conversationId
              ? `Search through your conversation${userName ? ` with ${userName}` : ''}`
              : 'Find messages across all your conversations'}
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>No Results</Text>
          <Text style={styles.emptyText}>
            No messages found for "{query}"
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderResult}
          contentContainerStyle={styles.resultsList}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <Text style={styles.resultsCount}>
              {results.length} result{results.length !== 1 ? 's' : ''} found
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F2E',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 24,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F2E',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    height: '100%',
  },
  clearButton: {
    padding: 4,
  },
  clearButtonText: {
    color: '#6B7280',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    color: '#F87171',
    fontSize: 16,
    textAlign: 'center',
  },
  hintContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  hintIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  hintTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  hintText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
  },
  resultsList: {
    paddingVertical: 16,
  },
  resultsCount: {
    color: '#9CA3AF',
    fontSize: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  resultCard: {
    backgroundColor: '#1F1F2E',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  resultAvatarPlaceholder: {
    backgroundColor: '#6B46C1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  resultMeta: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  resultDate: {
    color: '#6B7280',
    fontSize: 12,
  },
  resultContent: {
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 20,
  },
  highlightedText: {
    backgroundColor: 'rgba(236, 72, 153, 0.3)',
    color: '#EC4899',
    fontWeight: '600',
  },
});
