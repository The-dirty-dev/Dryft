import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { RootStackParamList } from '../../navigation';
import { Input } from '../../components/common';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const GENDER_OPTIONS = [
  { label: 'Man', value: 'male' },
  { label: 'Woman', value: 'female' },
  { label: 'Non-binary', value: 'non-binary' },
  { label: 'Other', value: 'other' },
];

const INTEREST_SUGGESTIONS = [
  'Travel', 'Music', 'Movies', 'Gaming', 'Fitness', 'Cooking',
  'Reading', 'Art', 'Photography', 'Dancing', 'Hiking', 'Yoga',
  'Coffee', 'Wine', 'Dogs', 'Cats', 'Beach', 'Mountains',
];

interface ProfileData {
  display_name?: string;
  bio?: string;
  birth_date?: string;
  gender?: string;
  looking_for?: string[];
  interests?: string[];
  job_title?: string;
  company?: string;
  school?: string;
  height?: number;
  profile_photo_url?: string;
  photos?: string[];
}

export default function EditProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, refreshUser } = useAuthStore();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({});
  const [newInterest, setNewInterest] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await api.get('/v1/profile');
      setProfile(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.patch('/v1/profile', {
        display_name: profile.display_name,
        bio: profile.bio,
        birth_date: profile.birth_date,
        gender: profile.gender,
        looking_for: profile.looking_for,
        interests: profile.interests,
        job_title: profile.job_title,
        company: profile.company,
        school: profile.school,
        height: profile.height,
      });
      await refreshUser?.();
      Alert.alert('Success', 'Profile updated!');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePickPhoto = async (isMain: boolean) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('photo', {
        uri: asset.uri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      } as any);
      if (isMain) {
        formData.append('main', 'true');
      }

      try {
        const response = await api.post('/v1/profile/photos', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (isMain) {
          setProfile((prev) => ({ ...prev, profile_photo_url: response.data.photo_key }));
        } else {
          setProfile((prev) => ({ ...prev, photos: response.data.photos }));
        }
        await refreshUser?.();
      } catch (error) {
        Alert.alert('Error', 'Failed to upload photo');
      }
    }
  };

  const handleDeletePhoto = async (index: number) => {
    Alert.alert('Delete Photo', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await api.delete(`/v1/profile/photos/${index}`);
            setProfile((prev) => ({ ...prev, photos: response.data.photos }));
          } catch (error) {
            Alert.alert('Error', 'Failed to delete photo');
          }
        },
      },
    ]);
  };

  const toggleLookingFor = (gender: string) => {
    const current = profile.looking_for || [];
    if (current.includes(gender)) {
      setProfile((prev) => ({
        ...prev,
        looking_for: current.filter((g) => g !== gender),
      }));
    } else {
      setProfile((prev) => ({
        ...prev,
        looking_for: [...current, gender],
      }));
    }
  };

  const addInterest = (interest: string) => {
    const trimmed = interest.trim();
    if (!trimmed || (profile.interests?.length || 0) >= 10) return;
    if (profile.interests?.includes(trimmed)) return;

    setProfile((prev) => ({
      ...prev,
      interests: [...(prev.interests || []), trimmed],
    }));
    setNewInterest('');
  };

  const removeInterest = (interest: string) => {
    setProfile((prev) => ({
      ...prev,
      interests: prev.interests?.filter((i) => i !== interest) || [],
    }));
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Photos Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <Text style={styles.sectionSubtitle}>Add up to 6 photos</Text>

          <View style={styles.photosGrid}>
            {/* Main Photo */}
            <TouchableOpacity
              style={[styles.photoSlot, styles.mainPhotoSlot]}
              onPress={() => handlePickPhoto(true)}
            >
              {profile.profile_photo_url ? (
                <Image
                  source={{ uri: profile.profile_photo_url }}
                  style={styles.photo}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.addPhotoPlaceholder}>
                  <Text style={styles.addPhotoIcon}>+</Text>
                  <Text style={styles.addPhotoText}>Main</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Gallery Photos */}
            {[0, 1, 2, 3, 4, 5].map((index) => {
              const photo = profile.photos?.[index];
              return (
                <TouchableOpacity
                  key={index}
                  style={styles.photoSlot}
                  onPress={() => photo ? handleDeletePhoto(index) : handlePickPhoto(false)}
                >
                  {photo ? (
                    <>
                      <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />
                      <View style={styles.deleteOverlay}>
                        <Text style={styles.deleteIcon}>✕</Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.addPhotoPlaceholder}>
                      <Text style={styles.addPhotoIcon}>+</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About You</Text>

          <Text style={styles.label}>Display Name</Text>
          <Input
            style={styles.input}
            value={profile.display_name || ''}
            onChangeText={(text) => setProfile((prev) => ({ ...prev, display_name: text }))}
            placeholder="Your name"
            placeholderTextColor={colors.textSecondary}
            maxLength={50}
          />

          <Text style={styles.label}>Bio</Text>
          <Input
            style={[styles.input, styles.textArea]}
            value={profile.bio || ''}
            onChangeText={(text) => setProfile((prev) => ({ ...prev, bio: text }))}
            placeholder="Write something about yourself..."
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={500}
            numberOfLines={4}
          />

          <Text style={styles.label}>Birthday</Text>
          <Input
            style={styles.input}
            value={profile.birth_date || ''}
            onChangeText={(text) => setProfile((prev) => ({ ...prev, birth_date: text }))}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numbers-and-punctuation"
          />
        </View>

        {/* Gender */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>I am a</Text>
          <View style={styles.optionsRow}>
            {GENDER_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  profile.gender === option.value && styles.optionButtonActive,
                ]}
                onPress={() => setProfile((prev) => ({ ...prev, gender: option.value }))}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    profile.gender === option.value && styles.optionButtonTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Looking For */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interested In</Text>
          <View style={styles.optionsRow}>
            {GENDER_OPTIONS.slice(0, 3).map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  profile.looking_for?.includes(option.value) && styles.optionButtonActive,
                ]}
                onPress={() => toggleLookingFor(option.value)}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    profile.looking_for?.includes(option.value) && styles.optionButtonTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Interests */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <Text style={styles.sectionSubtitle}>Add up to 10 interests</Text>

          <View style={styles.tagsContainer}>
            {profile.interests?.map((interest) => (
              <TouchableOpacity
                key={interest}
                style={styles.tag}
                onPress={() => removeInterest(interest)}
              >
                <Text style={styles.tagText}>{interest}</Text>
                <Text style={styles.tagRemove}>✕</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.addInterestRow}>
            <Input
              style={[styles.input, { flex: 1 }]}
              value={newInterest}
              onChangeText={setNewInterest}
              placeholder="Add interest..."
              placeholderTextColor={colors.textSecondary}
              maxLength={50}
              onSubmitEditing={() => addInterest(newInterest)}
            />
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => addInterest(newInterest)}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.suggestionsContainer}>
            {INTEREST_SUGGESTIONS.filter(
              (s) => !profile.interests?.includes(s)
            ).slice(0, 8).map((suggestion) => (
              <TouchableOpacity
                key={suggestion}
                style={styles.suggestionTag}
                onPress={() => addInterest(suggestion)}
              >
                <Text style={styles.suggestionText}>+ {suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Work & Education */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Work & Education</Text>

          <Text style={styles.label}>Job Title</Text>
          <Input
            style={styles.input}
            value={profile.job_title || ''}
            onChangeText={(text) => setProfile((prev) => ({ ...prev, job_title: text }))}
            placeholder="What do you do?"
            placeholderTextColor={colors.textSecondary}
            maxLength={100}
          />

          <Text style={styles.label}>Company</Text>
          <Input
            style={styles.input}
            value={profile.company || ''}
            onChangeText={(text) => setProfile((prev) => ({ ...prev, company: text }))}
            placeholder="Where do you work?"
            placeholderTextColor={colors.textSecondary}
            maxLength={100}
          />

          <Text style={styles.label}>School</Text>
          <Input
            style={styles.input}
            value={profile.school || ''}
            onChangeText={(text) => setProfile((prev) => ({ ...prev, school: text }))}
            placeholder="Where did you study?"
            placeholderTextColor={colors.textSecondary}
            maxLength={100}
          />
        </View>

        {/* Height */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Height</Text>
          <Input
            style={styles.input}
            value={profile.height?.toString() || ''}
            onChangeText={(text) => {
              const num = parseInt(text, 10);
              setProfile((prev) => ({ ...prev, height: isNaN(num) ? undefined : num }));
            }}
            placeholder="Height in cm (e.g., 175)"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
      borderBottomColor: colors.border,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    sectionSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
      marginTop: 16,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text,
    },
    textArea: {
      height: 120,
      textAlignVertical: 'top',
    },
    photosGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    photoSlot: {
      width: '30%',
      aspectRatio: 1,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    mainPhotoSlot: {
      width: '45%',
      borderColor: colors.primary,
      borderWidth: 2,
    },
    photo: {
      width: '100%',
      height: '100%',
    },
    addPhotoPlaceholder: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    addPhotoIcon: {
      fontSize: 32,
      color: colors.primary,
    },
    addPhotoText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    deleteOverlay: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: withAlpha(colors.primary, 'E6'),
      justifyContent: 'center',
      alignItems: 'center',
    },
    deleteIcon: {
      color: colors.text,
      fontSize: 12,
      fontWeight: 'bold',
    },
    optionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 12,
    },
    optionButton: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    optionButtonText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    optionButtonTextActive: {
      color: colors.text,
    },
    tagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      gap: 8,
    },
    tagText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '500',
    },
    tagRemove: {
      color: colors.text,
      fontSize: 12,
    },
    addInterestRow: {
      flexDirection: 'row',
      gap: 12,
    },
    addButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      justifyContent: 'center',
      borderRadius: 12,
    },
    addButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    suggestionsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 16,
    },
    suggestionTag: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: withAlpha(colors.primary, '1A'),
      borderWidth: 1,
      borderColor: withAlpha(colors.primary, '4D'),
    },
    suggestionText: {
      color: colors.primary,
      fontSize: 13,
    },
    footer: {
      padding: 20,
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
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
}
