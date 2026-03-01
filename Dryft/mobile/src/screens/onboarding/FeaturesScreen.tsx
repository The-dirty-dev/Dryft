import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useOnboardingStore, getStepProgress } from '../../store/onboardingStore';

const { width } = Dimensions.get('window');

interface Feature {
  id: string;
  icon: string;
  title: string;
  description: string;
  color: string;
}

const FEATURES: Feature[] = [
  {
    id: 'vr',
    icon: '🥽',
    title: 'Immersive VR Dating',
    description:
      'Meet in stunning virtual environments. Walk, talk, and interact like you\'re really there together.',
    color: '#9b59b6',
  },
  {
    id: 'avatar',
    icon: '🎭',
    title: 'Custom Avatars',
    description:
      'Express yourself with fully customizable avatars. Unlock exclusive outfits, effects, and accessories.',
    color: '#3498db',
  },
  {
    id: 'voice',
    icon: '🎤',
    title: 'Voice Chat',
    description:
      'Have real conversations with spatial audio. Hear them as if they\'re right next to you.',
    color: '#e74c3c',
  },
  {
    id: 'haptic',
    icon: '📳',
    title: 'Haptic Connection',
    description:
      'Connect compatible devices for an extra dimension of intimacy. Feel closer than ever.',
    color: '#e94560',
  },
  {
    id: 'mobile',
    icon: '📱',
    title: 'Mobile Companion',
    description:
      'Stay connected when not in VR. Chat, browse matches, and manage your profile anywhere.',
    color: '#2ecc71',
  },
];

export default function FeaturesScreen() {
  const { completeStep } = useOnboardingStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const progress = getStepProgress('features');

  const handleNext = () => {
    if (currentIndex < FEATURES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      completeStep('features');
    }
  };

  const handleSkip = () => {
    completeStep('features');
  };

  const renderFeature = ({ item, index }: { item: Feature; index: number }) => {
    const inputRange = [
      (index - 1) * width,
      index * width,
      (index + 1) * width,
    ];

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.8, 1, 0.8],
      extrapolate: 'clamp',
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.5, 1, 0.5],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.featureSlide}>
        <Animated.View
          style={[
            styles.featureContent,
            { transform: [{ scale }], opacity },
          ]}
        >
          <View style={[styles.iconContainer, { backgroundColor: `${item.color}20` }]}>
            <Text style={styles.icon}>{item.icon}</Text>
          </View>
          <Text style={styles.featureTitle}>{item.title}</Text>
          <Text style={styles.featureDescription}>{item.description}</Text>
        </Animated.View>
      </View>
    );
  };

  const renderDots = () => (
    <View style={styles.dotsContainer}>
      {FEATURES.map((_, index) => {
        const inputRange = [
          (index - 1) * width,
          index * width,
          (index + 1) * width,
        ];

        const dotWidth = scrollX.interpolate({
          inputRange,
          outputRange: [8, 24, 8],
          extrapolate: 'clamp',
        });

        const dotOpacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.3, 1, 0.3],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                width: dotWidth,
                opacity: dotOpacity,
              },
            ]}
          />
        );
      })}
    </View>
  );

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f0f23']}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Discover Dryft</Text>

        <Animated.FlatList
          ref={flatListRef}
          data={FEATURES}
          renderItem={renderFeature}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / width);
            setCurrentIndex(index);
          }}
        />

        {renderDots()}
      </View>

      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#e94560', '#c73e54']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>
              {currentIndex === FEATURES.length - 1 ? 'Continue' : 'Next'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginRight: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#e94560',
    borderRadius: 2,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: 14,
    color: '#8892b0',
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 24,
  },
  featureSlide: {
    width,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  featureContent: {
    alignItems: 'center',
    maxWidth: 320,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  icon: {
    fontSize: 56,
  },
  featureTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  featureDescription: {
    fontSize: 16,
    color: '#8892b0',
    textAlign: 'center',
    lineHeight: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e94560',
    marginHorizontal: 4,
  },
  bottomSection: {
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  nextButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});
