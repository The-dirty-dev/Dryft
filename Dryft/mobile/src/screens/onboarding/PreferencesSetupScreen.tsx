import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { useOnboardingStore, getStepProgress } from '../../store/onboardingStore';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

type Gender = 'men' | 'women' | 'everyone';
type RelationshipType = 'dating' | 'casual' | 'friends' | 'open';

interface Preferences {
  interestedIn: Gender;
  ageRange: [number, number];
  distance: number;
  relationshipTypes: RelationshipType[];
  vrOnly: boolean;
}

const RELATIONSHIP_TYPES: { value: RelationshipType; label: string; description: string }[] = [
  { value: 'dating', label: 'Dating', description: 'Looking for a relationship' },
  { value: 'casual', label: 'Casual', description: 'Keeping it light' },
  { value: 'friends', label: 'Friends', description: 'Just want to hang out' },
  { value: 'open', label: 'Open to All', description: 'See what happens' },
];

export default function PreferencesSetupScreen() {
  const { completeStep } = useOnboardingStore();
  const progress = getStepProgress('preferences');
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [preferences, setPreferences] = useState<Preferences>({
    interestedIn: 'everyone',
    ageRange: [18, 50],
    distance: 50,
    relationshipTypes: ['dating'],
    vrOnly: false,
  });

  const handleGenderSelect = (gender: Gender) => {
    setPreferences({ ...preferences, interestedIn: gender });
  };

  const toggleRelationshipType = (type: RelationshipType) => {
    const current = preferences.relationshipTypes;
    let newTypes;
    if (current.includes(type)) {
      newTypes = current.filter((t) => t !== type);
      if (newTypes.length === 0) return; // Must have at least one
    } else {
      newTypes = [...current, type];
    }
    setPreferences({ ...preferences, relationshipTypes: newTypes });
  };

  const handleContinue = () => {
    // In a real app, we'd save these preferences to the backend
    completeStep('preferences');
  };

  const handleSkip = () => {
    completeStep('preferences');
  };

  return (
    <LinearGradient
      colors={[colors.surface, colors.backgroundSecondary, colors.background]}
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Your Preferences</Text>
        <Text style={styles.subtitle}>
          Help us find your perfect matches
        </Text>

        {/* Interested In */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Show Me</Text>
          <View style={styles.genderOptions}>
            {(['men', 'women', 'everyone'] as Gender[]).map((gender) => (
              <TouchableOpacity
                key={gender}
                style={[
                  styles.genderOption,
                  preferences.interestedIn === gender && styles.genderSelected,
                ]}
                onPress={() => handleGenderSelect(gender)}
              >
                <Text
                  style={[
                    styles.genderText,
                    preferences.interestedIn === gender && styles.genderTextSelected,
                  ]}
                >
                  {gender.charAt(0).toUpperCase() + gender.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Age Range */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Age Range</Text>
            <Text style={styles.rangeValue}>
              {preferences.ageRange[0]} - {preferences.ageRange[1]}+
            </Text>
          </View>
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>Min: {preferences.ageRange[0]}</Text>
            <Slider
              style={styles.slider}
              minimumValue={18}
              maximumValue={preferences.ageRange[1] - 1}
              value={preferences.ageRange[0]}
              onValueChange={(value) =>
                setPreferences({
                  ...preferences,
                  ageRange: [Math.round(value), preferences.ageRange[1]],
                })
              }
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={withAlpha(colors.text, '1A')}
              thumbTintColor={colors.primary}
            />
          </View>
          <View style={styles.sliderContainer}>
            <Text style={styles.sliderLabel}>Max: {preferences.ageRange[1]}</Text>
            <Slider
              style={styles.slider}
              minimumValue={preferences.ageRange[0] + 1}
              maximumValue={80}
              value={preferences.ageRange[1]}
              onValueChange={(value) =>
                setPreferences({
                  ...preferences,
                  ageRange: [preferences.ageRange[0], Math.round(value)],
                })
              }
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={withAlpha(colors.text, '1A')}
              thumbTintColor={colors.primary}
            />
          </View>
        </View>

        {/* Distance */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Maximum Distance</Text>
            <Text style={styles.rangeValue}>
              {preferences.distance === 100 ? 'Anywhere' : `${preferences.distance} mi`}
            </Text>
          </View>
          <Slider
            style={styles.distanceSlider}
            minimumValue={5}
            maximumValue={100}
            value={preferences.distance}
            onValueChange={(value) =>
              setPreferences({ ...preferences, distance: Math.round(value) })
            }
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={withAlpha(colors.text, '1A')}
            thumbTintColor={colors.primary}
          />
          <View style={styles.distanceLabels}>
            <Text style={styles.distanceLabel}>5 mi</Text>
            <Text style={styles.distanceLabel}>Anywhere</Text>
          </View>
        </View>

        {/* Relationship Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Looking For</Text>
          <Text style={styles.sectionSubtitle}>Select all that apply</Text>
          <View style={styles.relationshipOptions}>
            {RELATIONSHIP_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.relationshipOption,
                  preferences.relationshipTypes.includes(type.value) &&
                    styles.relationshipSelected,
                ]}
                onPress={() => toggleRelationshipType(type.value)}
              >
                <Text
                  style={[
                    styles.relationshipLabel,
                    preferences.relationshipTypes.includes(type.value) &&
                      styles.relationshipLabelSelected,
                  ]}
                >
                  {type.label}
                </Text>
                <Text
                  style={[
                    styles.relationshipDescription,
                    preferences.relationshipTypes.includes(type.value) &&
                      styles.relationshipDescriptionSelected,
                  ]}
                >
                  {type.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* VR Only Toggle */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.toggleOption}
            onPress={() => setPreferences({ ...preferences, vrOnly: !preferences.vrOnly })}
          >
            <View>
              <Text style={styles.toggleLabel}>VR Users Only</Text>
              <Text style={styles.toggleDescription}>
                Only show people who use VR
              </Text>
            </View>
            <View
              style={[
                styles.toggle,
                preferences.vrOnly && styles.toggleActive,
              ]}
            >
              <View
                style={[
                  styles.toggleThumb,
                  preferences.vrOnly && styles.toggleThumbActive,
                ]}
              />
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.note}>
          You can change these preferences anytime in Settings
        </Text>
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
    </LinearGradient>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
    marginBottom: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  rangeValue: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  genderOptions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  genderOption: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: withAlpha(colors.text, '0D'),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: withAlpha(colors.text, '1A'),
  },
  genderSelected: {
    backgroundColor: withAlpha(colors.primary, '33'),
    borderColor: colors.primary,
  },
  genderText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  genderTextSelected: {
    color: colors.primary,
  },
  sliderContainer: {
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  distanceSlider: {
    width: '100%',
    height: 40,
  },
  distanceLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
  },
  distanceLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  relationshipOptions: {
    gap: 12,
  },
  relationshipOption: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: withAlpha(colors.text, '0D'),
    borderWidth: 1,
    borderColor: withAlpha(colors.text, '1A'),
  },
  relationshipSelected: {
    backgroundColor: withAlpha(colors.primary, '33'),
    borderColor: colors.primary,
  },
  relationshipLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  relationshipLabelSelected: {
    color: colors.primary,
  },
  relationshipDescription: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  relationshipDescriptionSelected: {
    color: colors.text,
  },
  toggleOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: withAlpha(colors.text, '0D'),
    borderRadius: 12,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  toggle: {
    width: 52,
    height: 32,
    borderRadius: 16,
    backgroundColor: withAlpha(colors.text, '33'),
    padding: 2,
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.text,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  note: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
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
