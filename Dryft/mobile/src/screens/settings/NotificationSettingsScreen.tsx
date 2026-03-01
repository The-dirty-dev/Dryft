import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import {
  notificationService,
  NotificationCategory,
  CategorySettings,
} from '../../services/notifications';

interface CategoryConfig {
  key: NotificationCategory;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const CATEGORIES: CategoryConfig[] = [
  {
    key: 'MESSAGE',
    title: 'Messages',
    description: 'New messages from your matches',
    icon: 'chatbubble',
  },
  {
    key: 'MATCH',
    title: 'Matches',
    description: 'When you match with someone',
    icon: 'heart',
  },
  {
    key: 'LIKE',
    title: 'Likes',
    description: 'When someone likes your profile',
    icon: 'thumbs-up',
  },
  {
    key: 'SUPER_LIKE',
    title: 'Super Likes',
    description: 'When someone super likes you',
    icon: 'star',
  },
  {
    key: 'VR_INVITE',
    title: 'VR Sessions',
    description: 'VR session invites and updates',
    icon: 'glasses',
  },
  {
    key: 'PROFILE_VIEW',
    title: 'Profile Views',
    description: 'When someone views your profile',
    icon: 'eye',
  },
  {
    key: 'SAFETY',
    title: 'Safety Alerts',
    description: 'Important safety notifications',
    icon: 'shield-checkmark',
  },
  {
    key: 'SYSTEM',
    title: 'System',
    description: 'Account and app updates',
    icon: 'settings',
  },
  {
    key: 'PROMO',
    title: 'Promotions',
    description: 'Special offers and features',
    icon: 'gift',
  },
];

export default function NotificationSettingsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [categorySettings, setCategorySettings] = useState<Record<NotificationCategory, CategorySettings>>({} as any);
  const [quietHours, setQuietHours] = useState({ enabled: false, start: 1320, end: 420 });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<NotificationCategory | null>(null);

  useEffect(() => {
    loadSettings();
    checkPermissions();
  }, []);

  const loadSettings = async () => {
    const settings = await notificationService.getAllCategorySettings();
    setCategorySettings(settings);

    const hours = await notificationService.getQuietHours();
    setQuietHours(hours);
  };

  const checkPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setPermissionGranted(status === 'granted');
  };

  const requestPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setPermissionGranted(status === 'granted');

    if (status !== 'granted') {
      Alert.alert(
        t('alerts.notifications.disabledTitle'),
        t('alerts.notifications.disabledMessage'),
        [
          { text: t('alerts.notifications.disabledCancel'), style: 'cancel' },
          { text: t('alerts.notifications.disabledOpenSettings'), onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const updateCategorySetting = useCallback(
    async (category: NotificationCategory, updates: Partial<CategorySettings>) => {
      const newSettings = {
        ...categorySettings[category],
        ...updates,
      };

      setCategorySettings((prev) => ({
        ...prev,
        [category]: newSettings,
      }));

      await notificationService.setCategorySettings(category, updates);
    },
    [categorySettings]
  );

  const updateQuietHours = async (updates: Partial<typeof quietHours>) => {
    const newHours = { ...quietHours, ...updates };
    setQuietHours(newHours);
    await notificationService.setQuietHours(newHours.enabled, newHours.start, newHours.end);
  };

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
  };

  const timeToDate = (minutes: number): Date => {
    const date = new Date();
    date.setHours(Math.floor(minutes / 60));
    date.setMinutes(minutes % 60);
    return date;
  };

  const dateToMinutes = (date: Date): number => {
    return date.getHours() * 60 + date.getMinutes();
  };

  const renderCategoryItem = (config: CategoryConfig) => {
    const settings = categorySettings[config.key];
    const isExpanded = expandedCategory === config.key;

    if (!settings) return null;

    return (
      <View
        key={config.key}
        style={[styles.categoryItem, { backgroundColor: theme.colors.surface }]}
      >
        <TouchableOpacity
          style={styles.categoryHeader}
          onPress={() => setExpandedCategory(isExpanded ? null : config.key)}
        >
          <View style={styles.categoryLeft}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
              <Ionicons name={config.icon} size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.categoryInfo}>
              <Text style={[styles.categoryTitle, { color: theme.colors.text }]}>
                {config.title}
              </Text>
              <Text style={[styles.categoryDescription, { color: theme.colors.textSecondary }]}>
                {config.description}
              </Text>
            </View>
          </View>
          <View style={styles.categoryRight}>
            <Switch
              value={settings.enabled}
              onValueChange={(value) => updateCategorySetting(config.key, { enabled: value })}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.text}
            />
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={theme.colors.textSecondary}
              style={styles.expandIcon}
            />
          </View>
        </TouchableOpacity>

        {isExpanded && settings.enabled && (
          <View style={[styles.categoryDetails, { borderTopColor: theme.colors.border }]}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.colors.text }]}>Sound</Text>
              <Switch
                value={settings.sound}
                onValueChange={(value) => updateCategorySetting(config.key, { sound: value })}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.text}
              />
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.colors.text }]}>Vibration</Text>
              <Switch
                value={settings.vibration}
                onValueChange={(value) => updateCategorySetting(config.key, { vibration: value })}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.text}
              />
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.colors.text }]}>Show Preview</Text>
              <Switch
                value={settings.showPreview}
                onValueChange={(value) => updateCategorySetting(config.key, { showPreview: value })}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.text}
              />
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Permission Status */}
        {permissionGranted === false && (
          <TouchableOpacity
            style={[styles.permissionBanner, { backgroundColor: theme.colors.warning + '20' }]}
            onPress={requestPermissions}
          >
            <Ionicons name="warning" size={24} color={theme.colors.warning} />
            <View style={styles.permissionText}>
              <Text style={[styles.permissionTitle, { color: theme.colors.warning }]}>
                Notifications Disabled
              </Text>
              <Text style={[styles.permissionSubtitle, { color: theme.colors.textSecondary }]}>
                Tap to enable notifications
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.warning} />
          </TouchableOpacity>
        )}

        {/* Quiet Hours */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            QUIET HOURS
          </Text>
          <View style={[styles.quietHoursCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.quietHoursHeader}>
              <View style={styles.quietHoursInfo}>
                <Ionicons name="moon" size={24} color={theme.colors.primary} />
                <View style={styles.quietHoursText}>
                  <Text style={[styles.quietHoursTitle, { color: theme.colors.text }]}>
                    Do Not Disturb
                  </Text>
                  <Text style={[styles.quietHoursSubtitle, { color: theme.colors.textSecondary }]}>
                    Mute notifications during specific hours
                  </Text>
                </View>
              </View>
              <Switch
                value={quietHours.enabled}
                onValueChange={(value) => updateQuietHours({ enabled: value })}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.text}
              />
            </View>

            {quietHours.enabled && (
              <View style={[styles.quietHoursSchedule, { borderTopColor: theme.colors.border }]}>
                <TouchableOpacity
                  style={styles.timeSelector}
                  onPress={() => setShowStartPicker(true)}
                >
                  <Text style={[styles.timeLabel, { color: theme.colors.textSecondary }]}>
                    From
                  </Text>
                  <Text style={[styles.timeValue, { color: theme.colors.text }]}>
                    {formatTime(quietHours.start)}
                  </Text>
                </TouchableOpacity>
                <Ionicons name="arrow-forward" size={20} color={theme.colors.textMuted} />
                <TouchableOpacity
                  style={styles.timeSelector}
                  onPress={() => setShowEndPicker(true)}
                >
                  <Text style={[styles.timeLabel, { color: theme.colors.textSecondary }]}>
                    To
                  </Text>
                  <Text style={[styles.timeValue, { color: theme.colors.text }]}>
                    {formatTime(quietHours.end)}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          <Text style={[styles.quietHoursNote, { color: theme.colors.textMuted }]}>
            Safety alerts will still come through during quiet hours
          </Text>
        </View>

        {/* Notification Categories */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            NOTIFICATION TYPES
          </Text>
          {CATEGORIES.map(renderCategoryItem)}
        </View>

        {/* Info Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>
            You can also manage notification settings in your device's Settings app.
          </Text>
          {Platform.OS === 'android' && (
            <TouchableOpacity
              style={[styles.channelsButton, { borderColor: theme.colors.border }]}
              onPress={() => Linking.openSettings()}
            >
              <Ionicons name="settings-outline" size={18} color={theme.colors.text} />
              <Text style={[styles.channelsButtonText, { color: theme.colors.text }]}>
                Open Channel Settings
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Time Pickers */}
      {showStartPicker && (
        <DateTimePicker
          value={timeToDate(quietHours.start)}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowStartPicker(Platform.OS === 'ios');
            if (date) {
              updateQuietHours({ start: dateToMinutes(date) });
            }
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={timeToDate(quietHours.end)}
          mode="time"
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setShowEndPicker(Platform.OS === 'ios');
            if (date) {
              updateQuietHours({ end: dateToMinutes(date) });
            }
          }}
        />
      )}
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
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    gap: 12,
  },
  permissionText: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  permissionSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  quietHoursCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  quietHoursHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  quietHoursInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  quietHoursText: {
    flex: 1,
  },
  quietHoursTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  quietHoursSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  quietHoursSchedule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderTopWidth: 1,
    gap: 16,
  },
  timeSelector: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  quietHoursNote: {
    fontSize: 12,
    marginTop: 8,
    marginLeft: 4,
  },
  categoryItem: {
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  categoryDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  categoryRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expandIcon: {
    marginLeft: 4,
  },
  categoryDetails: {
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 14,
  },
  footer: {
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  footerText: {
    fontSize: 13,
    textAlign: 'center',
  },
  channelsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  channelsButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
