import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useOnboardingStore, getStepProgress } from '../../store/onboardingStore';

const PHOTO_SLOTS = 6;
const MIN_PHOTOS = 1;

export default function ProfilePhotoScreen() {
  const { profileData, setProfilePhoto, removeProfilePhoto, completeStep } = useOnboardingStore();
  const progress = getStepProgress('profile_photo');
  const [isUploading, setIsUploading] = useState(false);

  const handleAddPhoto = async (source: 'camera' | 'library') => {
    try {
      setIsUploading(true);

      let result;
      if (source === 'camera') {
        result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        setProfilePhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to add photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const showImageOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleAddPhoto('camera');
          } else if (buttonIndex === 2) {
            handleAddPhoto('library');
          }
        }
      );
    } else {
      Alert.alert('Add Photo', 'Choose an option', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take Photo', onPress: () => handleAddPhoto('camera') },
        { text: 'Choose from Library', onPress: () => handleAddPhoto('library') },
      ]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    Alert.alert('Remove Photo', 'Are you sure you want to remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeProfilePhoto(index) },
    ]);
  };

  const handleContinue = () => {
    if (profileData.photos.length < MIN_PHOTOS) {
      Alert.alert(
        'Add a Photo',
        'Please add at least one photo to continue. This helps others recognize you.',
        [{ text: 'OK' }]
      );
      return;
    }
    completeStep('profile_photo');
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Photos?',
      'Profiles with photos get 10x more matches. Are you sure you want to skip?',
      [
        { text: 'Add Photos', style: 'cancel' },
        { text: 'Skip Anyway', onPress: () => completeStep('profile_photo') },
      ]
    );
  };

  const renderPhotoSlot = (index: number) => {
    const photo = profileData.photos[index];
    const isMainPhoto = index === 0;

    if (photo) {
      return (
        <TouchableOpacity
          key={index}
          style={[styles.photoSlot, isMainPhoto && styles.mainPhotoSlot]}
          onPress={() => handleRemovePhoto(index)}
          activeOpacity={0.8}
        >
          <Image source={{ uri: photo }} style={styles.photoImage} />
          <View style={styles.removeButton}>
            <Text style={styles.removeButtonText}>×</Text>
          </View>
          {isMainPhoto && (
            <View style={styles.mainBadge}>
              <Text style={styles.mainBadgeText}>Main</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.photoSlot,
          styles.emptySlot,
          isMainPhoto && styles.mainPhotoSlot,
        ]}
        onPress={showImageOptions}
        disabled={isUploading || profileData.photos.length !== index}
        activeOpacity={0.7}
      >
        <View style={styles.addIcon}>
          <Text style={styles.addIconText}>+</Text>
        </View>
        {isMainPhoto && (
          <Text style={styles.addText}>Add main photo</Text>
        )}
      </TouchableOpacity>
    );
  };

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
        <Text style={styles.title}>Add Photos</Text>
        <Text style={styles.subtitle}>
          Show your best self. Add up to {PHOTO_SLOTS} photos.
        </Text>

        <View style={styles.photoGrid}>
          <View style={styles.mainPhotoContainer}>
            {renderPhotoSlot(0)}
          </View>
          <View style={styles.smallPhotosGrid}>
            {[1, 2, 3, 4, 5].map((index) => renderPhotoSlot(index))}
          </View>
        </View>

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Photo Tips</Text>
          <View style={styles.tipItem}>
            <Text style={styles.tipIcon}>✓</Text>
            <Text style={styles.tipText}>Clear photo of your face</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipIcon}>✓</Text>
            <Text style={styles.tipText}>Good lighting</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipIcon}>✓</Text>
            <Text style={styles.tipText}>Recent photos (within 1 year)</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipIcon}>✗</Text>
            <Text style={styles.tipText}>Group photos as main</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipIcon}>✗</Text>
            <Text style={styles.tipText}>Heavy filters or editing</Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomSection}>
        <Text style={styles.photoCount}>
          {profileData.photos.length}/{PHOTO_SLOTS} photos added
        </Text>
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
    paddingHorizontal: 24,
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
  photoGrid: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  mainPhotoContainer: {
    marginRight: 12,
  },
  mainPhotoSlot: {
    width: 160,
    height: 200,
  },
  smallPhotosGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoSlot: {
    width: 72,
    height: 96,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  emptySlot: {
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  addIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(233, 69, 96, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  addIconText: {
    fontSize: 20,
    color: '#e94560',
    fontWeight: '600',
  },
  addText: {
    fontSize: 11,
    color: '#8892b0',
    textAlign: 'center',
    marginTop: 4,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  mainBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#e94560',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  mainBadgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  tipsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipIcon: {
    fontSize: 14,
    color: '#2ecc71',
    marginRight: 8,
    width: 16,
  },
  tipText: {
    fontSize: 13,
    color: '#8892b0',
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  photoCount: {
    fontSize: 14,
    color: '#8892b0',
    textAlign: 'center',
    marginBottom: 16,
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
