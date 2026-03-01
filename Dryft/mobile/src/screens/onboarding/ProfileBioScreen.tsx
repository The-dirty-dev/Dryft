import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useOnboardingStore, getStepProgress } from '../../store/onboardingStore';
import { Input } from '../../components/common';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

const MAX_BIO_LENGTH = 500;
const MIN_BIO_LENGTH = 20;

const BIO_PROMPTS = [
  "What are you looking for?",
  "What makes you unique?",
  "Your ideal virtual date would be...",
  "Three things about you:",
];

const INTERESTS = [
  'Gaming', 'Music', 'Movies', 'Travel', 'Fitness', 'Art',
  'Reading', 'Cooking', 'Photography', 'Tech', 'Nature', 'Sports',
  'Dancing', 'Fashion', 'Anime', 'Meditation', 'Wine', 'Hiking',
  'Comedy', 'Science', 'Writing', 'Yoga', 'Concerts', 'Podcasts',
];

export default function ProfileBioScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { profileData, setProfileBio, setInterests, completeStep } = useOnboardingStore();
  const progress = getStepProgress('profile_bio');
  const [bio, setBio] = useState(profileData.bio);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(profileData.interests);

  const handleBioChange = (text: string) => {
    if (text.length <= MAX_BIO_LENGTH) {
      setBio(text);
      setProfileBio(text);
    }
  };

  const toggleInterest = (interest: string) => {
    let newInterests;
    if (selectedInterests.includes(interest)) {
      newInterests = selectedInterests.filter((i) => i !== interest);
    } else if (selectedInterests.length < 10) {
      newInterests = [...selectedInterests, interest];
    } else {
      return; // Max 10 interests
    }
    setSelectedInterests(newInterests);
    setInterests(newInterests);
  };

  const handleContinue = () => {
    completeStep('profile_bio');
  };

  const handleSkip = () => {
    completeStep('profile_bio');
  };

  const bioProgress = Math.min(bio.length / MIN_BIO_LENGTH, 1);

  return (
    <LinearGradient
      colors={[colors.surface, colors.backgroundSecondary, colors.background]}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>About You</Text>
          <Text style={styles.subtitle}>
            Help others get to know you better
          </Text>

          <View style={styles.bioSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Bio</Text>
              <Text style={styles.charCount}>
                {bio.length}/{MAX_BIO_LENGTH}
              </Text>
            </View>

            <View style={styles.bioInputContainer}>
              <Input
                style={styles.bioInput}
                value={bio}
                onChangeText={handleBioChange}
                placeholder="Write something about yourself..."
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
              />
              {bio.length < MIN_BIO_LENGTH && (
                <View style={styles.bioProgressContainer}>
                  <View style={styles.bioProgressBar}>
                    <View
                      style={[
                        styles.bioProgressFill,
                        { width: `${bioProgress * 100}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.bioProgressText}>
                    {MIN_BIO_LENGTH - bio.length} more characters
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.promptsContainer}>
              <Text style={styles.promptsLabel}>Need inspiration?</Text>
              <View style={styles.promptsList}>
                {BIO_PROMPTS.map((prompt, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.promptChip}
                    onPress={() => handleBioChange(bio + (bio ? '\n\n' : '') + prompt + ' ')}
                  >
                    <Text style={styles.promptText}>{prompt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.interestsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Interests</Text>
              <Text style={styles.interestCount}>
                {selectedInterests.length}/10
              </Text>
            </View>
            <Text style={styles.interestsSubtitle}>
              Select up to 10 interests to help find compatible matches
            </Text>

            <View style={styles.interestsGrid}>
              {INTERESTS.map((interest) => (
                <TouchableOpacity
                  key={interest}
                  style={[
                    styles.interestChip,
                    selectedInterests.includes(interest) && styles.interestSelected,
                  ]}
                  onPress={() => toggleInterest(interest)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.interestText,
                      selectedInterests.includes(interest) && styles.interestTextSelected,
                    ]}
                  >
                    {interest}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>Continue</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
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
    backgroundColor: withAlpha(colors.text, '1A'),
    borderRadius: 2,
    marginRight: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  bioSection: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  charCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  bioInputContainer: {
    backgroundColor: withAlpha(colors.text, '0D'),
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  bioInput: {
    fontSize: 16,
    color: colors.text,
    minHeight: 120,
    lineHeight: 24,
  },
  bioProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  bioProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: withAlpha(colors.text, '1A'),
    borderRadius: 2,
    marginRight: 12,
  },
  bioProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  bioProgressText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  promptsContainer: {
    marginTop: 8,
  },
  promptsLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  promptsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  promptChip: {
    backgroundColor: withAlpha(colors.primary, '26'),
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: withAlpha(colors.primary, '4D'),
  },
  promptText: {
    fontSize: 12,
    color: colors.primary,
  },
  interestsSection: {
    marginBottom: 24,
  },
  interestCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  interestsSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    backgroundColor: withAlpha(colors.text, '0D'),
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: withAlpha(colors.text, '1A'),
  },
  interestSelected: {
    backgroundColor: withAlpha(colors.primary, '33'),
    borderColor: colors.primary,
  },
  interestText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  interestTextSelected: {
    color: colors.primary,
    fontWeight: '500',
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  continueButton: {
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
    color: colors.text,
  },
});
