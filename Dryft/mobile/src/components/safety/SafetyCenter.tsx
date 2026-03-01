import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  useEmergencyContacts,
  useEmergencyAlert,
  useLocationSharing,
  useSafetyTips,
} from '../../hooks/useSafety';
import { EmergencyContact } from '../../services/safety';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

// ============================================================================
// Emergency Button Component
// ============================================================================

interface EmergencyButtonProps {
  onPress: () => void;
  isLoading?: boolean;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}

function EmergencyButton({ onPress, isLoading, styles, colors }: EmergencyButtonProps) {
  const [pressCount, setPressCount] = useState(0);
  const [lastPressTime, setLastPressTime] = useState(0);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const now = Date.now();
    if (now - lastPressTime > 2000) {
      // Reset if more than 2 seconds since last press
      setPressCount(1);
    } else {
      setPressCount((prev) => prev + 1);
    }
    setLastPressTime(now);

    // Require 3 quick presses to trigger
    if (pressCount >= 2) {
      onPress();
      setPressCount(0);
    }
  };

  return (
    <TouchableOpacity
      style={styles.emergencyButton}
      onPress={handlePress}
      disabled={isLoading}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={[colors.error, colors.primaryDark]}
        style={styles.emergencyButtonGradient}
      >
        <Ionicons name="alert-circle" size={40} color={colors.text} />
        <Text style={styles.emergencyButtonText}>
          {isLoading ? 'Sending Alert...' : 'Emergency Alert'}
        </Text>
        <Text style={styles.emergencyButtonHint}>
          Press 3 times quickly to activate
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ============================================================================
// Add Contact Modal
// ============================================================================

interface AddContactModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string, phone: string, relationship: string) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}

function AddContactModal({ visible, onClose, onAdd, styles, colors }: AddContactModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');

  const handleAdd = () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Error', 'Please fill in name and phone number');
      return;
    }
    onAdd(name.trim(), phone.trim(), relationship.trim() || 'Friend');
    setName('');
    setPhone('');
    setRelationship('');
    onClose();
  };

  const relationships = ['Parent', 'Sibling', 'Friend', 'Partner', 'Other'];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Emergency Contact</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Contact name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 (555) 123-4567"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Relationship</Text>
            <View style={styles.relationshipOptions}>
              {relationships.map((rel) => (
                <TouchableOpacity
                  key={rel}
                  style={[
                    styles.relationshipOption,
                    relationship === rel && styles.relationshipOptionSelected,
                  ]}
                  onPress={() => setRelationship(rel)}
                >
                  <Text
                    style={[
                      styles.relationshipOptionText,
                      relationship === rel && styles.relationshipOptionTextSelected,
                    ]}
                  >
                    {rel}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
            <Text style={styles.addButtonText}>Add Contact</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ============================================================================
// Contact Card Component
// ============================================================================

interface ContactCardProps {
  contact: EmergencyContact;
  onRemove: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}

function ContactCard({ contact, onRemove, styles, colors }: ContactCardProps) {
  const handleRemove = () => {
    Alert.alert(
      'Remove Contact',
      `Are you sure you want to remove ${contact.name} as an emergency contact?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: onRemove },
      ]
    );
  };

  return (
    <View style={styles.contactCard}>
      <View style={styles.contactInfo}>
        <View style={styles.contactAvatar}>
          <Text style={styles.contactInitial}>
            {contact.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.contactDetails}>
          <View style={styles.contactNameRow}>
            <Text style={styles.contactName}>{contact.name}</Text>
            {contact.isVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              </View>
            )}
          </View>
          <Text style={styles.contactPhone}>{contact.phone}</Text>
          <Text style={styles.contactRelationship}>{contact.relationship}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.removeButton} onPress={handleRemove}>
        <Ionicons name="trash-outline" size={20} color={colors.error} />
      </TouchableOpacity>
    </View>
  );
}

// ============================================================================
// Safety Center Screen
// ============================================================================

interface SafetyCenterProps {
  onBack?: () => void;
}

export function SafetyCenter({ onBack }: SafetyCenterProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { contacts, addContact, removeContact, isLoading } = useEmergencyContacts();
  const { triggerAlert, callEmergencyServices, isTriggering } = useEmergencyAlert();
  const { settings, toggleEnabled, toggleDistance, toggleCity } = useLocationSharing();
  const { tips } = useSafetyTips();

  const [showAddContact, setShowAddContact] = useState(false);

  const handleTriggerAlert = async () => {
    Alert.alert(
      'Send Emergency Alert',
      'This will send an SMS with your location to all verified emergency contacts. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Alert',
          style: 'destructive',
          onPress: async () => {
            const success = await triggerAlert(true);
            if (success) {
              Alert.alert('Alert Sent', 'Your emergency contacts have been notified.');
            }
          },
        },
      ]
    );
  };

  const handleCallEmergency = () => {
    Alert.alert('Call Emergency Services', 'This will call 911. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call 911', style: 'destructive', onPress: callEmergencyServices },
    ]);
  };

  const handleAddContact = async (name: string, phone: string, relationship: string) => {
    const success = await addContact(name, phone, relationship);
    if (success) {
      Alert.alert(
        'Contact Added',
        'A verification message will be sent to this contact.'
      );
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Safety Center</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Emergency Section */}
        <View style={styles.section}>
          <EmergencyButton onPress={handleTriggerAlert} isLoading={isTriggering} styles={styles} colors={colors} />

          <TouchableOpacity style={styles.call911Button} onPress={handleCallEmergency}>
            <Ionicons name="call" size={20} color={colors.text} />
            <Text style={styles.call911Text}>Call 911</Text>
          </TouchableOpacity>
        </View>

        {/* Emergency Contacts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Emergency Contacts</Text>
            <TouchableOpacity
              style={styles.addContactButton}
              onPress={() => setShowAddContact(true)}
            >
              <Ionicons name="add" size={20} color={colors.accent} />
              <Text style={styles.addContactText}>Add</Text>
            </TouchableOpacity>
          </View>

          {contacts.length === 0 ? (
            <View style={styles.emptyContacts}>
              <Ionicons name="people-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyContactsText}>
                Add emergency contacts who will be notified if you trigger an alert.
              </Text>
            </View>
          ) : (
            <View style={styles.contactsList}>
              {contacts.map((contact) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  onRemove={() => removeContact(contact.id)}
                  styles={styles}
                  colors={colors}
                />
              ))}
            </View>
          )}
        </View>

        {/* Location Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location Privacy</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Location Sharing</Text>
              <Text style={styles.settingDescription}>
                Allow matches to see your general location
              </Text>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={toggleEnabled}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Show Distance</Text>
              <Text style={styles.settingDescription}>
                Display distance on your profile
              </Text>
            </View>
            <Switch
              value={settings.showDistance}
              onValueChange={toggleDistance}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Show City</Text>
              <Text style={styles.settingDescription}>
                Display your city on your profile
              </Text>
            </View>
            <Switch
              value={settings.showCity}
              onValueChange={toggleCity}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>
        </View>

        {/* Safety Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety Tips</Text>

          <View style={styles.tipsGrid}>
            {tips.slice(0, 4).map((tip, index) => (
              <View key={index} style={styles.tipCard}>
                <View style={styles.tipIcon}>
                  <Ionicons name={tip.icon as any} size={24} color={colors.accent} />
                </View>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipDescription}>{tip.description}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <AddContactModal
        visible={showAddContact}
        onClose={() => setShowAddContact(false)}
        onAdd={handleAddContact}
        styles={styles}
        colors={colors}
      />
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

function createStyles(colors: ThemeColors) {
  const text70 = withAlpha(colors.text, 'B3');
  const accent20 = withAlpha(colors.accent, '33');

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.backgroundDarkest,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.surface,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    headerSpacer: {
      width: 40,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 16,
      paddingBottom: 40,
    },
    section: {
      marginBottom: 32,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
    },
    emergencyButton: {
      borderRadius: 20,
      overflow: 'hidden',
      marginBottom: 16,
    },
    emergencyButtonGradient: {
      padding: 24,
      alignItems: 'center',
    },
    emergencyButtonText: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginTop: 12,
    },
    emergencyButtonHint: {
      fontSize: 13,
      color: text70,
      marginTop: 8,
    },
    call911Button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.error,
    },
    call911Text: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    addContactButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    addContactText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.accent,
    },
    emptyContacts: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 24,
      alignItems: 'center',
    },
    emptyContactsText: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 12,
      lineHeight: 20,
    },
    contactsList: {
      gap: 12,
    },
    contactCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
    },
    contactInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    contactAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contactInitial: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    contactDetails: {
      marginLeft: 12,
      flex: 1,
    },
    contactNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    contactName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    verifiedBadge: {
      marginLeft: 4,
    },
    contactPhone: {
      fontSize: 14,
      color: colors.textTertiary,
      marginTop: 2,
    },
    contactRelationship: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    removeButton: {
      padding: 8,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
    },
    settingInfo: {
      flex: 1,
      marginRight: 16,
    },
    settingLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    settingDescription: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
    },
    tipsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    tipCard: {
      flex: 1,
      minWidth: '45%',
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
    },
    tipIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: accent20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    tipTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    tipDescription: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 16,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 40,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 24,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    inputGroup: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textTertiary,
      marginBottom: 8,
    },
    input: {
      backgroundColor: colors.backgroundDarkest,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    relationshipOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    relationshipOption: {
      backgroundColor: colors.backgroundDarkest,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    relationshipOptionSelected: {
      backgroundColor: accent20,
      borderColor: colors.accent,
    },
    relationshipOptionText: {
      fontSize: 14,
      color: colors.textTertiary,
    },
    relationshipOptionTextSelected: {
      color: colors.accent,
    },
    addButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    addButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
  });
}

export default SafetyCenter;
