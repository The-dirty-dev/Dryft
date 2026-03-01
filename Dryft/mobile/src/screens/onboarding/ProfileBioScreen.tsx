import React, { useState } from 'react';
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
      colors={['#1a1a2e', '#16213e', '#0f0f23']}
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
                placeholderTextColor="#666"
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
              colors={['#e94560', '#c73e54']}
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

const styles = StyleSheet.create({
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
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8892b0',
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
    color: '#fff',
  },
  charCount: {
    fontSize: 12,
    color: '#8892b0',
  },
  bioInputContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  bioInput: {
    fontSize: 16,
    color: '#fff',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginRight: 12,
  },
  bioProgressFill: {
    height: '100%',
    backgroundColor: '#e94560',
    borderRadius: 2,
  },
  bioProgressText: {
    fontSize: 12,
    color: '#8892b0',
  },
  promptsContainer: {
    marginTop: 8,
  },
  promptsLabel: {
    fontSize: 12,
    color: '#8892b0',
    marginBottom: 8,
  },
  promptsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  promptChip: {
    backgroundColor: 'rgba(233, 69, 96, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(233, 69, 96, 0.3)',
  },
  promptText: {
    fontSize: 12,
    color: '#e94560',
  },
  interestsSection: {
    marginBottom: 24,
  },
  interestCount: {
    fontSize: 12,
    color: '#8892b0',
  },
  interestsSubtitle: {
    fontSize: 13,
    color: '#8892b0',
    marginBottom: 16,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  interestSelected: {
    backgroundColor: 'rgba(233, 69, 96, 0.2)',
    borderColor: '#e94560',
  },
  interestText: {
    fontSize: 14,
    color: '#8892b0',
  },
  interestTextSelected: {
    color: '#e94560',
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
    color: '#fff',
  },
});
