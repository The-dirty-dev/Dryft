import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  chatMediaService,
  MediaAttachment,
} from '../../services/chatMedia';

// ============================================================================
// Types
// ============================================================================

interface ChatImagePickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (attachments: MediaAttachment[]) => void;
  maxSelections?: number;
}

// ============================================================================
// Chat Image Picker Component
// ============================================================================

export function ChatImagePicker({
  visible,
  onClose,
  onSelect,
  maxSelections = 10,
}: ChatImagePickerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<MediaAttachment[]>([]);

  const handlePickFromLibrary = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsLoading(true);

    const result = await chatMediaService.pickImage({
      allowsMultipleSelection: true,
      selectionLimit: maxSelections - selectedImages.length,
    });

    setIsLoading(false);

    if (result) {
      setSelectedImages((prev) => [...prev, ...result].slice(0, maxSelections));
    }
  };

  const handleTakePhoto = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsLoading(true);

    const result = await chatMediaService.takePhoto({});

    setIsLoading(false);

    if (result) {
      setSelectedImages((prev) => [...prev, result].slice(0, maxSelections));
    }
  };

  const handleRemoveImage = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleSend = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect(selectedImages);
    setSelectedImages([]);
    onClose();
  };

  const handleClose = () => {
    setSelectedImages([]);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={24} color="#9CA3AF" />
            </TouchableOpacity>
            <Text style={styles.title}>Share Photos</Text>
            {selectedImages.length > 0 ? (
              <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
                <Text style={styles.sendButtonText}>
                  Send ({selectedImages.length})
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.sendButtonPlaceholder} />
            )}
          </View>

          {/* Selected Images Preview */}
          {selectedImages.length > 0 && (
            <View style={styles.previewContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.previewScroll}
              >
                {selectedImages.map((image) => (
                  <View key={image.id} style={styles.previewItem}>
                    <Image
                      source={{ uri: image.uri }}
                      style={styles.previewImage}
                    />
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemoveImage(image.id)}
                    >
                      <Ionicons name="close-circle" size={24} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
              <Text style={styles.previewCount}>
                {selectedImages.length}/{maxSelections} photos selected
              </Text>
            </View>
          )}

          {/* Options */}
          <View style={styles.options}>
            <TouchableOpacity
              style={styles.optionButton}
              onPress={handlePickFromLibrary}
              disabled={isLoading || selectedImages.length >= maxSelections}
            >
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                style={styles.optionIcon}
              >
                <Ionicons name="images" size={28} color="#fff" />
              </LinearGradient>
              <Text style={styles.optionLabel}>Photo Library</Text>
              <Text style={styles.optionDescription}>
                Choose from your photos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={handleTakePhoto}
              disabled={isLoading || selectedImages.length >= maxSelections}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.optionIcon}
              >
                <Ionicons name="camera" size={28} color="#fff" />
              </LinearGradient>
              <Text style={styles.optionLabel}>Camera</Text>
              <Text style={styles.optionDescription}>
                Take a new photo
              </Text>
            </TouchableOpacity>
          </View>

          {/* Loading Indicator */}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#8B5CF6" />
            </View>
          )}

          {/* Info */}
          <View style={styles.infoContainer}>
            <Ionicons name="information-circle" size={18} color="#6B7280" />
            <Text style={styles.infoText}>
              Photos are shared privately and can only be seen by your match
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ============================================================================
// Chat Image Message Component
// ============================================================================

interface ChatImageMessageProps {
  uri: string;
  width: number;
  height: number;
  isSent: boolean;
  onPress?: () => void;
  isLoading?: boolean;
  uploadProgress?: number;
}

export function ChatImageMessage({
  uri,
  width,
  height,
  isSent,
  onPress,
  isLoading,
  uploadProgress,
}: ChatImageMessageProps) {
  const maxWidth = Dimensions.get('window').width * 0.65;
  const aspectRatio = width / height;

  let displayWidth = maxWidth;
  let displayHeight = maxWidth / aspectRatio;

  if (displayHeight > 300) {
    displayHeight = 300;
    displayWidth = displayHeight * aspectRatio;
  }

  return (
    <TouchableOpacity
      style={[
        styles.imageMessage,
        isSent && styles.imageMessageSent,
        { width: displayWidth },
      ]}
      onPress={onPress}
      disabled={isLoading}
      activeOpacity={0.9}
    >
      <Image
        source={{ uri }}
        style={[styles.messageImage, { width: displayWidth, height: displayHeight }]}
        resizeMode="cover"
      />

      {isLoading && (
        <View style={styles.imageLoadingOverlay}>
          <View style={styles.uploadProgressContainer}>
            <View
              style={[
                styles.uploadProgressBar,
                { width: `${uploadProgress || 0}%` },
              ]}
            />
          </View>
          <Text style={styles.uploadProgressText}>
            {uploadProgress || 0}%
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ============================================================================
// Image Viewer Modal
// ============================================================================

interface ImageViewerProps {
  visible: boolean;
  uri: string;
  onClose: () => void;
  onSave?: () => void;
}

export function ImageViewer({ visible, uri, onClose, onSave }: ImageViewerProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.viewerContainer}>
        {/* Header */}
        <View style={styles.viewerHeader}>
          <TouchableOpacity style={styles.viewerButton} onPress={onClose}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {onSave && (
            <TouchableOpacity style={styles.viewerButton} onPress={onSave}>
              <Ionicons name="download-outline" size={28} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* Image */}
        <View style={styles.viewerImageContainer}>
          <Image
            source={{ uri }}
            style={styles.viewerImage}
            resizeMode="contain"
          />
        </View>
      </View>
    </Modal>
  );
}

// ============================================================================
// Styles
// ============================================================================

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: height * 0.7,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  sendButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  sendButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  sendButtonPlaceholder: {
    width: 80,
  },
  previewContainer: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  previewScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  previewItem: {
    position: 'relative',
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
  previewCount: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
  },
  options: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  optionButton: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  optionIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
  },

  // Image Message
  imageMessage: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#2a2a2a',
  },
  imageMessageSent: {
    alignSelf: 'flex-end',
  },
  messageImage: {
    borderRadius: 16,
  },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadProgressContainer: {
    width: '60%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  uploadProgressBar: {
    height: '100%',
    backgroundColor: '#8B5CF6',
  },
  uploadProgressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginTop: 8,
  },

  // Image Viewer
  viewerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  viewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  viewerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: {
    width: width,
    height: height - 200,
  },
});

export default ChatImagePicker;
