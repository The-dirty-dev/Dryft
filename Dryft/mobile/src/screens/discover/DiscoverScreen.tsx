import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  Animated,
  PanResponder,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMatchingStore } from '../../store/matchingStore';
import { DiscoverProfile } from '../../types';
import { RootStackParamList } from '../../navigation';
import { Button } from '../../components/common';
import { useColors, ThemeColors } from '../../theme/ThemeProvider';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function DiscoverScreen() {
  const navigation = useNavigation<NavigationProp>();
  const colors = useColors();
  const styles = createStyles(colors);
  const {
    discoverProfiles,
    currentProfileIndex,
    isLoadingDiscover,
    loadDiscoverProfiles,
    swipe,
    nextProfile,
  } = useMatchingStore();

  const [showMatch, setShowMatch] = useState(false);
  const [matchedUser, setMatchedUser] = useState<DiscoverProfile | null>(null);

  const position = useRef(new Animated.ValueXY()).current;
  const rotate = position.x.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: ['-30deg', '0deg', '30deg'],
    extrapolate: 'clamp',
  });
  const likeOpacity = position.x.interpolate({
    inputRange: [0, width / 4],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const passOpacity = position.x.interpolate({
    inputRange: [-width / 4, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    loadDiscoverProfiles();
  }, []);

  const currentProfile = discoverProfiles[currentProfileIndex];
  const nextProfileData = discoverProfiles[currentProfileIndex + 1];

  const handleSwipe = async (direction: 'like' | 'pass') => {
    if (!currentProfile) return;

    const result = await swipe(currentProfile.id, direction);

    if (result?.matched) {
      setMatchedUser(currentProfile);
      setShowMatch(true);
    }

    nextProfile();
    position.setValue({ x: 0, y: 0 });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          Animated.spring(position, {
            toValue: { x: width + 100, y: gesture.dy },
            useNativeDriver: true,
          }).start(() => handleSwipe('like'));
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          Animated.spring(position, {
            toValue: { x: -width - 100, y: gesture.dy },
            useNativeDriver: true,
          }).start(() => handleSwipe('pass'));
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleButtonSwipe = (direction: 'like' | 'pass') => {
    const toValue = direction === 'like' ? width + 100 : -width - 100;
    Animated.spring(position, {
      toValue: { x: toValue, y: 0 },
      useNativeDriver: true,
    }).start(() => handleSwipe(direction));
  };

  const renderCard = (profile: DiscoverProfile, isTop: boolean) => {
    const cardStyle = isTop
      ? {
          transform: [
            { translateX: position.x },
            { translateY: position.y },
            { rotate },
          ],
        }
      : { transform: [{ scale: 0.95 }] };

    return (
      <Animated.View
        key={profile.id}
        style={[styles.card, cardStyle]}
        {...(isTop ? panResponder.panHandlers : {})}
      >
        <Image
          source={{
            uri: profile.profile_photo || 'https://via.placeholder.com/400',
          }}
          style={styles.cardImage}
        />
        <View style={styles.cardGradient}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>
              {profile.display_name}
              {profile.age ? `, ${profile.age}` : ''}
            </Text>
            {profile.distance_km !== undefined && (
              <Text style={styles.cardDistance}>
                {profile.distance_km < 1
                  ? (profile.distance_km * 0.621371).toFixed(1)
                  : Math.round(profile.distance_km * 0.621371)}{' '}
                miles away
              </Text>
            )}
            {profile.bio && (
              <Text style={styles.cardBio} numberOfLines={2}>
                {profile.bio}
              </Text>
            )}
            {profile.interests && profile.interests.length > 0 && (
              <View style={styles.interests}>
                {profile.interests.slice(0, 3).map((interest, i) => (
                  <View key={i} style={styles.interestTag}>
                    <Text style={styles.interestText}>{interest}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {isTop && (
          <>
            <Animated.View style={[styles.likeLabel, { opacity: likeOpacity }]}>
              <Text style={styles.likeLabelText}>LIKE</Text>
            </Animated.View>
            <Animated.View style={[styles.passLabel, { opacity: passOpacity }]}>
              <Text style={styles.passLabelText}>PASS</Text>
            </Animated.View>
          </>
        )}
      </Animated.View>
    );
  };

  if (isLoadingDiscover && discoverProfiles.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Finding people near you...</Text>
      </View>
    );
  }

  if (!currentProfile) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No more profiles</Text>
        <Text style={styles.emptySubtitle}>
          Check back later for new people to meet
        </Text>
        <Button
          title="Refresh"
          onPress={loadDiscoverProfiles}
          style={styles.refreshButton}
          textStyle={styles.refreshButtonText}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Matches' as any)}>
          <Text style={styles.matchesLink}>Matches</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardsContainer}>
        {nextProfileData && renderCard(nextProfileData, false)}
        {renderCard(currentProfile, true)}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.passButton]}
          onPress={() => handleButtonSwipe('pass')}
        >
          <Text style={styles.actionIcon}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.likeButton]}
          onPress={() => handleButtonSwipe('like')}
        >
          <Text style={styles.actionIcon}>♥</Text>
        </TouchableOpacity>
      </View>

      {/* Match Modal */}
      <Modal visible={showMatch} transparent animationType="fade">
        <View style={styles.matchModal}>
          <View style={styles.matchContent}>
            <Text style={styles.matchTitle}>It's a Match!</Text>
            <Text style={styles.matchSubtitle}>
              You and {matchedUser?.display_name} liked each other
            </Text>
            {matchedUser?.profile_photo && (
              <Image
                source={{ uri: matchedUser.profile_photo }}
                style={styles.matchPhoto}
              />
            )}
            <View style={styles.matchActions}>
              <Button
                title="Send Message"
                onPress={() => {
                  setShowMatch(false);
                  // Navigate to chat
                }}
                style={styles.matchButton}
                textStyle={styles.matchButtonText}
              />
              <Button
                title="Keep Swiping"
                onPress={() => setShowMatch(false)}
                style={styles.matchButtonSecondary}
                textStyle={styles.matchButtonSecondaryText}
                variant="secondary"
              />
            </View>
          </View>
        </View>
      </Modal>
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
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  matchesLink: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  cardsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    width: width - 40,
    height: height * 0.6,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    justifyContent: 'flex-end',
    padding: 20,
    backgroundColor: colors.overlay,
  },
  cardInfo: {
    gap: 4,
  },
  cardName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  cardDistance: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  cardBio: {
    fontSize: 14,
    color: colors.text,
    marginTop: 8,
  },
  interests: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  interestTag: {
    backgroundColor: `${colors.primary}4D`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  interestText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  likeLabel: {
    position: 'absolute',
    top: 50,
    left: 20,
    transform: [{ rotate: '-30deg' }],
    borderWidth: 4,
    borderColor: colors.like,
    borderRadius: 10,
    padding: 10,
  },
  likeLabelText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.like,
  },
  passLabel: {
    position: 'absolute',
    top: 50,
    right: 20,
    transform: [{ rotate: '30deg' }],
    borderWidth: 4,
    borderColor: colors.primary,
    borderRadius: 10,
    padding: 10,
  },
  passLabelText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    paddingVertical: 30,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passButton: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  likeButton: {
    backgroundColor: colors.primary,
  },
  actionIcon: {
    fontSize: 28,
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.background,
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
  refreshButton: {
    marginTop: 24,
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  refreshButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  matchModal: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchContent: {
    alignItems: 'center',
    padding: 40,
  },
  matchTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 8,
  },
  matchSubtitle: {
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  matchPhoto: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 4,
    borderColor: colors.primary,
    marginBottom: 32,
  },
  matchActions: {
    gap: 12,
    width: '100%',
  },
  matchButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 30,
    alignItems: 'center',
  },
  matchButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  matchButtonSecondary: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  matchButtonSecondaryText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
});
