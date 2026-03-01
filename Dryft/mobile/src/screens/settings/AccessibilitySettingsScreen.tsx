import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemeContext, ColorBlindMode } from '../../theme/ThemeProvider';
import { useAccessibilitySettings, announceForAccessibility } from '../../utils/accessibility';
import { AccessibleToggle, AccessibleText } from '../../components/AccessibleComponents';

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  const theme = useTheme();

  return (
    <View style={[styles.settingRow, { borderBottomColor: theme.colors.divider }]}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingLabel, { color: theme.colors.text }]}>{label}</Text>
        {description && (
          <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
            {description}
          </Text>
        )}
      </View>
      <View style={styles.settingControl}>{children}</View>
    </View>
  );
}

interface ColorBlindOptionProps {
  mode: ColorBlindMode;
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}

function ColorBlindOption({
  mode,
  label,
  description,
  selected,
  onSelect,
}: ColorBlindOptionProps) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      accessible={true}
      accessibilityLabel={`${label}. ${description}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onSelect}
      style={[
        styles.colorBlindOption,
        {
          backgroundColor: selected ? theme.colors.primary + '20' : theme.colors.surface,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
        },
      ]}
    >
      <View style={styles.colorBlindOptionHeader}>
        <Text
          style={[
            styles.colorBlindOptionLabel,
            { color: selected ? theme.colors.primary : theme.colors.text },
          ]}
        >
          {label}
        </Text>
        {selected && (
          <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
        )}
      </View>
      <Text style={[styles.colorBlindOptionDesc, { color: theme.colors.textSecondary }]}>
        {description}
      </Text>
      <ColorPreview mode={mode} />
    </TouchableOpacity>
  );
}

interface ColorPreviewProps {
  mode: ColorBlindMode;
}

function ColorPreview({ mode }: ColorPreviewProps) {
  const theme = useTheme();

  // Show sample colors affected by this mode
  const getPreviewColors = () => {
    switch (mode) {
      case 'protanopia':
        return [theme.colors.error, theme.colors.success, theme.colors.info, theme.colors.warning];
      case 'deuteranopia':
        return [theme.colors.error, theme.colors.success, theme.colors.info, theme.colors.warning];
      case 'tritanopia':
        return [theme.colors.info, theme.colors.warning, theme.colors.accentPink, theme.colors.success];
      default:
        return [theme.colors.primary, theme.colors.success, theme.colors.info, theme.colors.warning];
    }
  };

  const colors = getPreviewColors();

  return (
    <View style={styles.colorPreview}>
      {colors.map((color, index) => (
        <View
          key={index}
          style={[styles.colorSwatch, { backgroundColor: color }]}
          accessible={true}
          accessibilityLabel={`Color sample ${index + 1}`}
        />
      ))}
    </View>
  );
}

export default function AccessibilitySettingsScreen({ navigation }: any) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { colorBlindMode, setColorBlindMode } = useThemeContext();
  const { settings, updateSetting, resetSettings } = useAccessibilitySettings();

  const handleColorBlindModeChange = (mode: ColorBlindMode) => {
    setColorBlindMode(mode);
    const modeNames = {
      none: 'Standard colors',
      protanopia: 'Protanopia mode',
      deuteranopia: 'Deuteranopia mode',
      tritanopia: 'Tritanopia mode',
    };
    announceForAccessibility(`${modeNames[mode]} selected`);
  };

  const handleToggle = (key: keyof typeof settings, value: boolean) => {
    updateSetting(key, value);
    announceForAccessibility(`${key} ${value ? 'enabled' : 'disabled'}`);
  };

  const handleResetSettings = () => {
    Alert.alert(
      t('settings.accessibility.resetTitle'),
      t('settings.accessibility.resetMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.reset'),
          style: 'destructive',
          onPress: () => {
            resetSettings();
            announceForAccessibility('Accessibility settings reset to defaults');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Visual Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            {t('settings.accessibility.visual')}
          </Text>

          <SettingRow
            label={t('settings.accessibility.highContrast')}
            description={t('settings.accessibility.highContrastDesc')}
          >
            <AccessibleToggle
              label={t('settings.accessibility.highContrast')}
              value={settings.highContrast}
              onValueChange={(value) => handleToggle('highContrast', value)}
            />
          </SettingRow>

          <SettingRow
            label={t('settings.accessibility.largeButtons')}
            description={t('settings.accessibility.largeButtonsDesc')}
          >
            <AccessibleToggle
              label={t('settings.accessibility.largeButtons')}
              value={settings.largeButtons}
              onValueChange={(value) => handleToggle('largeButtons', value)}
            />
          </SettingRow>

          <SettingRow
            label={t('settings.accessibility.extendedTouch')}
            description={t('settings.accessibility.extendedTouchDesc')}
          >
            <AccessibleToggle
              label={t('settings.accessibility.extendedTouch')}
              value={settings.extendedTouchTargets}
              onValueChange={(value) => handleToggle('extendedTouchTargets', value)}
            />
          </SettingRow>
        </View>

        {/* Color Blind Modes Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            {t('settings.accessibility.colorBlindMode')}
          </Text>
          <Text style={[styles.sectionDescription, { color: theme.colors.textMuted }]}>
            {t('settings.accessibility.colorBlindModeDesc')}
          </Text>

          <View style={styles.colorBlindOptions}>
            <ColorBlindOption
              mode="none"
              label={t('settings.accessibility.colorBlindNone')}
              description={t('settings.accessibility.colorBlindNoneDesc')}
              selected={colorBlindMode === 'none'}
              onSelect={() => handleColorBlindModeChange('none')}
            />
            <ColorBlindOption
              mode="protanopia"
              label={t('settings.accessibility.colorBlindProtanopia')}
              description={t('settings.accessibility.colorBlindProtanopiaDesc')}
              selected={colorBlindMode === 'protanopia'}
              onSelect={() => handleColorBlindModeChange('protanopia')}
            />
            <ColorBlindOption
              mode="deuteranopia"
              label={t('settings.accessibility.colorBlindDeuteranopia')}
              description={t('settings.accessibility.colorBlindDeuteranopiaDesc')}
              selected={colorBlindMode === 'deuteranopia'}
              onSelect={() => handleColorBlindModeChange('deuteranopia')}
            />
            <ColorBlindOption
              mode="tritanopia"
              label={t('settings.accessibility.colorBlindTritanopia')}
              description={t('settings.accessibility.colorBlindTritanopiaDesc')}
              selected={colorBlindMode === 'tritanopia'}
              onSelect={() => handleColorBlindModeChange('tritanopia')}
            />
          </View>
        </View>

        {/* Motion Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            {t('settings.accessibility.motion')}
          </Text>

          <SettingRow
            label={t('settings.accessibility.reduceMotion')}
            description={t('settings.accessibility.reduceMotionDesc')}
          >
            <AccessibleToggle
              label={t('settings.accessibility.reduceMotion')}
              value={settings.reduceMotion}
              onValueChange={(value) => handleToggle('reduceMotion', value)}
            />
          </SettingRow>
        </View>

        {/* Audio Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            {t('settings.accessibility.audio')}
          </Text>

          <SettingRow
            label={t('settings.accessibility.hapticFeedback')}
            description={t('settings.accessibility.hapticFeedbackDesc')}
          >
            <AccessibleToggle
              label={t('settings.accessibility.hapticFeedback')}
              value={settings.hapticFeedback}
              onValueChange={(value) => handleToggle('hapticFeedback', value)}
            />
          </SettingRow>

          <SettingRow
            label={t('settings.accessibility.audioDescriptions')}
            description={t('settings.accessibility.audioDescriptionsDesc')}
          >
            <AccessibleToggle
              label={t('settings.accessibility.audioDescriptions')}
              value={settings.audioDescriptions}
              onValueChange={(value) => handleToggle('audioDescriptions', value)}
            />
          </SettingRow>
        </View>

        {/* Reset Button */}
        <TouchableOpacity
          accessible={true}
          accessibilityLabel={t('settings.accessibility.resetLabel')}
          accessibilityRole="button"
          onPress={handleResetSettings}
          style={[styles.resetButton, { borderColor: theme.colors.error }]}
        >
          <Text style={[styles.resetButtonText, { color: theme.colors.error }]}>
            {t('settings.accessibility.resetButton')}
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
  settingControl: {
    alignItems: 'flex-end',
  },
  colorBlindOptions: {
    gap: 12,
  },
  colorBlindOption: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
  },
  colorBlindOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  colorBlindOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  colorBlindOptionDesc: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 12,
  },
  colorPreview: {
    flexDirection: 'row',
    gap: 8,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  resetButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    marginTop: 8,
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 40,
  },
});
