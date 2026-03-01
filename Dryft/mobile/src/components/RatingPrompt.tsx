import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { appRatingService, RatingTrigger } from '../services/appRating';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// Types
// ============================================================================

interface RatingPromptProps {
  visible: boolean;
  trigger?: RatingTrigger;
  onClose: () => void;
  onRated?: () => void;
  onFeedback?: (feedback: string, rating: number) => void;
}

type PromptStep = 'initial' | 'happy' | 'unhappy' | 'feedback' | 'thanks';

// ============================================================================
// Trigger Messages
// ============================================================================

const TRIGGER_MESSAGES: Record<RatingTrigger, { title: string; subtitle: string }> = {
  match_created: {
    title: "You got a match! 🎉",
    subtitle: "How's your Dryft experience so far?",
  },
  first_message_sent: {
    title: 'Great conversation starter!',
    subtitle: "How's your Dryft experience so far?",
  },
  conversation_milestone: {
    title: "You're connecting! 💬",
    subtitle: 'Are you enjoying Dryft?',
  },
  vr_session_completed: {
    title: 'Amazing VR session! 🥽',
    subtitle: "How's your experience with Dryft VR?",
  },
  profile_verified: {
    title: 'Profile verified! ✓',
    subtitle: 'Are you enjoying Dryft?',
  },
  subscription_started: {
    title: 'Welcome to Premium! ⭐',
    subtitle: "How's your Dryft experience?",
  },
  positive_interaction: {
    title: "You're on a roll!",
    subtitle: 'Are you enjoying Dryft?',
  },
  app_milestone: {
    title: 'Thanks for being here!',
    subtitle: "We'd love to hear your thoughts",
  },
  manual: {
    title: 'How are we doing?',
    subtitle: 'Your feedback helps us improve',
  },
};

// ============================================================================
// Main Component
// ============================================================================

export function RatingPrompt({
  visible,
  trigger = 'manual',
  onClose,
  onRated,
  onFeedback,
}: RatingPromptProps) {
  const theme = useTheme();
  const [step, setStep] = useState<PromptStep>('initial');
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [feedback, setFeedback] = useState('');
  const [animation] = useState(new Animated.Value(0));

  const triggerMessage = TRIGGER_MESSAGES[trigger];

  useEffect(() => {
    if (visible) {
      setStep('initial');
      setSelectedRating(0);
      setFeedback('');
      Animated.spring(animation, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
      }).start();
    } else {
      animation.setValue(0);
    }
  }, [visible, animation]);

  const handleStarPress = (rating: number) => {
    setSelectedRating(rating);

    if (rating >= 4) {
      setStep('happy');
    } else {
      setStep('unhappy');
    }
  };

  const handleRateOnStore = async () => {
    await appRatingService.showNativeReviewPrompt();
    setStep('thanks');
    onRated?.();

    setTimeout(() => {
      onClose();
    }, 2000);
  };

  const handleSubmitFeedback = () => {
    onFeedback?.(feedback, selectedRating);
    appRatingService.recordUserRated();
    setStep('thanks');

    setTimeout(() => {
      onClose();
    }, 2000);
  };

  const handleAskLater = () => {
    appRatingService.recordAskLater();
    onClose();
  };

  const handleNoThanks = () => {
    appRatingService.recordUserDeclined();
    onClose();
  };

  const scale = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
        <Animated.View
          style={[
            styles.container,
            {
              backgroundColor: theme.colors.surface,
              transform: [{ scale }],
            },
          ]}
        >
          {step === 'initial' && (
            <InitialStep
              theme={theme}
              title={triggerMessage.title}
              subtitle={triggerMessage.subtitle}
              selectedRating={selectedRating}
              onStarPress={handleStarPress}
              onAskLater={handleAskLater}
            />
          )}

          {step === 'happy' && (
            <HappyStep
              theme={theme}
              rating={selectedRating}
              onRateOnStore={handleRateOnStore}
              onNoThanks={handleNoThanks}
            />
          )}

          {step === 'unhappy' && (
            <UnhappyStep
              theme={theme}
              rating={selectedRating}
              onGiveFeedback={() => setStep('feedback')}
              onNoThanks={handleNoThanks}
            />
          )}

          {step === 'feedback' && (
            <FeedbackStep
              theme={theme}
              feedback={feedback}
              onFeedbackChange={setFeedback}
              onSubmit={handleSubmitFeedback}
              onCancel={() => setStep('unhappy')}
            />
          )}

          {step === 'thanks' && <ThanksStep theme={theme} />}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ============================================================================
// Step Components
// ============================================================================

interface InitialStepProps {
  theme: any;
  title: string;
  subtitle: string;
  selectedRating: number;
  onStarPress: (rating: number) => void;
  onAskLater: () => void;
}

function InitialStep({
  theme,
  title,
  subtitle,
  selectedRating,
  onStarPress,
  onAskLater,
}: InitialStepProps) {
  return (
    <>
      {/* Logo */}
      <View style={[styles.logo, { backgroundColor: theme.colors.primary }]}>
        <Text style={[styles.logoText, { color: theme.colors.text }]}>D</Text>
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>

      {/* Star Rating */}
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onStarPress(star)}
            style={styles.starButton}
          >
            <Ionicons
              name={star <= selectedRating ? 'star' : 'star-outline'}
              size={40}
              color={star <= selectedRating ? theme.colors.warning : theme.colors.textMuted}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Ask Later */}
      <TouchableOpacity onPress={onAskLater} style={styles.askLaterButton}>
        <Text style={[styles.askLaterText, { color: theme.colors.textSecondary }]}>
          Ask me later
        </Text>
      </TouchableOpacity>
    </>
  );
}

interface HappyStepProps {
  theme: any;
  rating: number;
  onRateOnStore: () => void;
  onNoThanks: () => void;
}

function HappyStep({ theme, rating, onRateOnStore, onNoThanks }: HappyStepProps) {
  return (
    <>
      {/* Happy Icon */}
      <View style={[styles.emojiContainer, { backgroundColor: theme.colors.success + '20' }]}>
        <Text style={styles.emoji}>😊</Text>
      </View>

      {/* Message */}
      <Text style={[styles.title, { color: theme.colors.text }]}>We're so glad!</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        Would you mind rating us on the {Platform.OS === 'ios' ? 'App Store' : 'Play Store'}? It
        really helps!
      </Text>

      {/* Stars display */}
      <View style={styles.starsDisplayContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={24}
            color={star <= rating ? theme.colors.warning : theme.colors.textMuted}
          />
        ))}
      </View>

      {/* Buttons */}
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
        onPress={onRateOnStore}
      >
        <Ionicons name="star" size={20} color={theme.colors.text} />
        <Text style={[styles.primaryButtonText, { color: theme.colors.text }]}>Rate on Store</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onNoThanks} style={styles.secondaryButton}>
        <Text style={[styles.secondaryButtonText, { color: theme.colors.textSecondary }]}>
          No thanks
        </Text>
      </TouchableOpacity>
    </>
  );
}

interface UnhappyStepProps {
  theme: any;
  rating: number;
  onGiveFeedback: () => void;
  onNoThanks: () => void;
}

function UnhappyStep({ theme, rating, onGiveFeedback, onNoThanks }: UnhappyStepProps) {
  return (
    <>
      {/* Sad Icon */}
      <View style={[styles.emojiContainer, { backgroundColor: theme.colors.warning + '20' }]}>
        <Text style={styles.emoji}>😔</Text>
      </View>

      {/* Message */}
      <Text style={[styles.title, { color: theme.colors.text }]}>We're sorry to hear that</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        Would you like to tell us how we can improve? Your feedback is valuable to us.
      </Text>

      {/* Stars display */}
      <View style={styles.starsDisplayContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={24}
            color={star <= rating ? theme.colors.warning : theme.colors.textMuted}
          />
        ))}
      </View>

      {/* Buttons */}
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
        onPress={onGiveFeedback}
      >
        <Ionicons name="chatbubble" size={20} color={theme.colors.text} />
        <Text style={[styles.primaryButtonText, { color: theme.colors.text }]}>Give Feedback</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onNoThanks} style={styles.secondaryButton}>
        <Text style={[styles.secondaryButtonText, { color: theme.colors.textSecondary }]}>
          No thanks
        </Text>
      </TouchableOpacity>
    </>
  );
}

interface FeedbackStepProps {
  theme: any;
  feedback: string;
  onFeedbackChange: (text: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function FeedbackStep({
  theme,
  feedback,
  onFeedbackChange,
  onSubmit,
  onCancel,
}: FeedbackStepProps) {
  return (
    <>
      {/* Header */}
      <Text style={[styles.title, { color: theme.colors.text }]}>Share Your Feedback</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        What could we do better?
      </Text>

      {/* Text Input */}
      <TextInput
        style={[
          styles.feedbackInput,
          {
            backgroundColor: theme.colors.background,
            color: theme.colors.text,
            borderColor: theme.colors.border,
          },
        ]}
        placeholder="Tell us what you think..."
        placeholderTextColor={theme.colors.textMuted}
        multiline
        value={feedback}
        onChangeText={onFeedbackChange}
        maxLength={500}
        textAlignVertical="top"
      />

      {/* Character count */}
      <Text style={[styles.charCount, { color: theme.colors.textMuted }]}>
        {feedback.length}/500
      </Text>

      {/* Buttons */}
      <TouchableOpacity
        style={[
          styles.primaryButton,
          { backgroundColor: feedback.trim() ? theme.colors.primary : theme.colors.border },
        ]}
        onPress={onSubmit}
        disabled={!feedback.trim()}
      >
        <Ionicons name="send" size={20} color={theme.colors.text} />
        <Text style={[styles.primaryButtonText, { color: theme.colors.text }]}>Submit Feedback</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onCancel} style={styles.secondaryButton}>
        <Text style={[styles.secondaryButtonText, { color: theme.colors.textSecondary }]}>
          Cancel
        </Text>
      </TouchableOpacity>
    </>
  );
}

interface ThanksStepProps {
  theme: any;
}

function ThanksStep({ theme }: ThanksStepProps) {
  return (
    <>
      {/* Thank you Icon */}
      <View style={[styles.emojiContainer, { backgroundColor: theme.colors.primary + '20' }]}>
        <Text style={styles.emoji}>💜</Text>
      </View>

      {/* Message */}
      <Text style={[styles.title, { color: theme.colors.text }]}>Thank you!</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        Your feedback helps us make Dryft better for everyone.
      </Text>
    </>
  );
}

// ============================================================================
// Compact Rating Banner
// ============================================================================

interface RatingBannerProps {
  visible: boolean;
  trigger?: RatingTrigger;
  onPress: () => void;
  onDismiss: () => void;
}

export function RatingBanner({ visible, trigger = 'manual', onPress, onDismiss }: RatingBannerProps) {
  const theme = useTheme();
  const [animation] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(animation, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, animation]);

  if (!visible) return null;

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [100, 0],
  });

  return (
    <Animated.View
      style={[
        styles.bannerContainer,
        {
          backgroundColor: theme.colors.surface,
          shadowColor: theme.colors.backgroundDarkest,
          transform: [{ translateY }],
          opacity: animation,
        },
      ]}
    >
      <TouchableOpacity style={styles.bannerContent} onPress={onPress}>
        <View style={[styles.bannerIcon, { backgroundColor: theme.colors.primary + '20' }]}>
          <Ionicons name="star" size={24} color={theme.colors.primary} />
        </View>
        <View style={styles.bannerText}>
          <Text style={[styles.bannerTitle, { color: theme.colors.text }]}>
            Enjoying Dryft?
          </Text>
          <Text style={[styles.bannerSubtitle, { color: theme.colors.textSecondary }]}>
            Tap to rate your experience
          </Text>
        </View>
        <TouchableOpacity onPress={onDismiss} style={styles.bannerDismiss}>
          <Ionicons name="close" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ============================================================================
// Hook for Rating Prompts
// ============================================================================

export function useRatingPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [currentTrigger, setCurrentTrigger] = useState<RatingTrigger>('manual');

  const checkForPrompt = useCallback(async () => {
    if (appRatingService.hasPendingPrompt()) {
      const trigger = appRatingService.getPendingTrigger();
      if (trigger) {
        setCurrentTrigger(trigger);
        setShowBanner(true);
        appRatingService.clearPendingPrompt();
      }
    }
  }, []);

  const recordMatch = useCallback(async () => {
    const shouldPrompt = await appRatingService.recordMatch();
    if (shouldPrompt) {
      setCurrentTrigger('match_created');
      setShowBanner(true);
    }
  }, []);

  const recordMessage = useCallback(async (isFirst: boolean = false) => {
    const shouldPrompt = await appRatingService.recordMessageSent(isFirst);
    if (shouldPrompt) {
      setCurrentTrigger(isFirst ? 'first_message_sent' : 'conversation_milestone');
      setShowBanner(true);
    }
  }, []);

  const recordVRSession = useCallback(async () => {
    const shouldPrompt = await appRatingService.recordVRSessionCompleted();
    if (shouldPrompt) {
      setCurrentTrigger('vr_session_completed');
      setShowBanner(true);
    }
  }, []);

  const handleBannerPress = useCallback(() => {
    setShowBanner(false);
    setShowPrompt(true);
  }, []);

  const handleBannerDismiss = useCallback(() => {
    setShowBanner(false);
    appRatingService.recordAskLater();
  }, []);

  const handlePromptClose = useCallback(() => {
    setShowPrompt(false);
  }, []);

  return {
    showPrompt,
    showBanner,
    currentTrigger,
    checkForPrompt,
    recordMatch,
    recordMessage,
    recordVRSession,
    handleBannerPress,
    handleBannerDismiss,
    handlePromptClose,
    setShowPrompt,
  };
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
  },
  emojiContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  starButton: {
    padding: 4,
  },
  starsDisplayContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 24,
  },
  askLaterButton: {
    padding: 8,
  },
  askLaterText: {
    fontSize: 14,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    padding: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
  },
  feedbackInput: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    fontSize: 15,
    marginBottom: 8,
  },
  charCount: {
    alignSelf: 'flex-end',
    fontSize: 12,
    marginBottom: 16,
  },

  // Banner styles
  bannerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  bannerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  bannerDismiss: {
    padding: 8,
  },
});
