import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { api } from '../../services/api';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

interface Preferences {
  age_min: number;
  age_max: number;
  distance_max: number;
  show_me: boolean;
  show_distance: boolean;
  show_age: boolean;
  global_mode: boolean;
  notify_matches: boolean;
  notify_messages: boolean;
  notify_likes: boolean;
}

const DEFAULT_PREFERENCES: Preferences = {
  age_min: 18,
  age_max: 50,
  distance_max: 50,
  show_me: true,
  show_distance: true,
  show_age: true,
  global_mode: false,
  notify_matches: true,
  notify_messages: true,
  notify_likes: true,
};

export default function PreferencesScreen() {
  const navigation = useNavigation();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const switchTrackColor = useMemo(
    () => ({ false: colors.backgroundSecondary, true: colors.primary }),
    [colors]
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await api.get('/v1/profile/preferences');
      setPreferences({ ...DEFAULT_PREFERENCES, ...response.data });
    } catch (error) {
      console.error('Failed to load preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.patch('/v1/profile/preferences', preferences);
      setHasChanges(false);
      Alert.alert('Success', 'Preferences saved!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Discovery Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discovery</Text>

          {/* Age Range */}
          <View style={styles.sliderSection}>
            <View style={styles.sliderHeader}>
              <Text style={styles.label}>Age Range</Text>
              <Text style={styles.sliderValue}>
                {preferences.age_min} - {preferences.age_max}
              </Text>
            </View>

            <View style={styles.dualSliderContainer}>
              <Text style={styles.sliderLabel}>Min: {preferences.age_min}</Text>
              <Slider
                style={styles.slider}
                minimumValue={18}
                maximumValue={preferences.age_max}
                value={preferences.age_min}
                onValueChange={(value) => updatePreference('age_min', Math.round(value))}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.backgroundSecondary}
                thumbTintColor={colors.primary}
              />

              <Text style={styles.sliderLabel}>Max: {preferences.age_max}</Text>
              <Slider
                style={styles.slider}
                minimumValue={preferences.age_min}
                maximumValue={99}
                value={preferences.age_max}
                onValueChange={(value) => updatePreference('age_max', Math.round(value))}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.backgroundSecondary}
                thumbTintColor={colors.primary}
              />
            </View>
          </View>

          {/* Distance */}
          <View style={styles.sliderSection}>
            <View style={styles.sliderHeader}>
              <Text style={styles.label}>Maximum Distance</Text>
              <Text style={styles.sliderValue}>
                {preferences.global_mode ? 'Global' : `${preferences.distance_max} km`}
              </Text>
            </View>

            {!preferences.global_mode && (
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={500}
                value={preferences.distance_max}
                onValueChange={(value) => updatePreference('distance_max', Math.round(value))}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.backgroundSecondary}
                thumbTintColor={colors.primary}
              />
            )}

            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleLabel}>Global Mode</Text>
                <Text style={styles.toggleDescription}>Match with people anywhere</Text>
              </View>
              <Switch
                value={preferences.global_mode}
                onValueChange={(value) => updatePreference('global_mode', value)}
                trackColor={switchTrackColor}
                thumbColor={colors.text}
              />
            </View>
          </View>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>Show Me in Discovery</Text>
              <Text style={styles.toggleDescription}>
                Turn off to hide your profile from others
              </Text>
            </View>
            <Switch
              value={preferences.show_me}
              onValueChange={(value) => updatePreference('show_me', value)}
              trackColor={switchTrackColor}
              thumbColor={colors.text}
            />
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>Show Distance</Text>
              <Text style={styles.toggleDescription}>
                Display your distance on your profile
              </Text>
            </View>
            <Switch
              value={preferences.show_distance}
              onValueChange={(value) => updatePreference('show_distance', value)}
              trackColor={switchTrackColor}
              thumbColor={colors.text}
            />
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>Show Age</Text>
              <Text style={styles.toggleDescription}>Display your age on your profile</Text>
            </View>
            <Switch
              value={preferences.show_age}
              onValueChange={(value) => updatePreference('show_age', value)}
              trackColor={switchTrackColor}
              thumbColor={colors.text}
            />
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>New Matches</Text>
              <Text style={styles.toggleDescription}>
                Get notified when you have a new match
              </Text>
            </View>
            <Switch
              value={preferences.notify_matches}
              onValueChange={(value) => updatePreference('notify_matches', value)}
              trackColor={switchTrackColor}
              thumbColor={colors.text}
            />
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>Messages</Text>
              <Text style={styles.toggleDescription}>Get notified for new messages</Text>
            </View>
            <Switch
              value={preferences.notify_messages}
              onValueChange={(value) => updatePreference('notify_messages', value)}
              trackColor={switchTrackColor}
              thumbColor={colors.text}
            />
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>Likes</Text>
              <Text style={styles.toggleDescription}>
                Get notified when someone likes you
              </Text>
            </View>
            <Switch
              value={preferences.notify_likes}
              onValueChange={(value) => updatePreference('notify_likes', value)}
              trackColor={switchTrackColor}
              thumbColor={colors.text}
            />
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Save Button */}
      {hasChanges && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.saveButtonText}>Save Preferences</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSecondary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 20,
  },
  sliderSection: {
    marginBottom: 24,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  sliderValue: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  dualSliderContainer: {
    marginTop: 8,
  },
  sliderLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: -8,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSecondary,
  },
  toggleLabel: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    maxWidth: 260,
  },
  footer: {
    padding: 20,
    paddingBottom: 34,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.backgroundSecondary,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 40,
  },
});
