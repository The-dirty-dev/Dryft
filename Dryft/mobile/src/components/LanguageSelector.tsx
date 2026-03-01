import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  SUPPORTED_LANGUAGES,
  SupportedLanguage,
  changeLanguage,
  getCurrentLanguage,
} from '../i18n';

interface LanguageSelectorProps {
  style?: object;
  showFlag?: boolean;
  showNativeName?: boolean;
}

export function LanguageSelector({
  style,
  showFlag = true,
  showNativeName = true,
}: LanguageSelectorProps) {
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const currentLang = getCurrentLanguage();
  const currentLanguageInfo = SUPPORTED_LANGUAGES[currentLang];

  const handleLanguageSelect = async (lang: SupportedLanguage) => {
    await changeLanguage(lang);
    setModalVisible(false);
  };

  const languages = Object.entries(SUPPORTED_LANGUAGES).map(([code, info]) => ({
    code: code as SupportedLanguage,
    ...info,
  }));

  return (
    <>
      <TouchableOpacity
        style={[styles.selector, style]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        {showFlag && <Text style={styles.flag}>{currentLanguageInfo.flag}</Text>}
        <Text style={styles.selectedLanguage}>
          {showNativeName ? currentLanguageInfo.nativeName : currentLanguageInfo.name}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('settings.language')}</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={languages}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.languageItem,
                    item.code === currentLang && styles.languageItemSelected,
                  ]}
                  onPress={() => handleLanguageSelect(item.code)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.languageFlag}>{item.flag}</Text>
                  <View style={styles.languageInfo}>
                    <Text style={styles.languageNative}>{item.nativeName}</Text>
                    <Text style={styles.languageName}>{item.name}</Text>
                  </View>
                  {item.code === currentLang && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

// Hook for using translations with type safety
export function useLocalization() {
  const { t, i18n } = useTranslation();

  return {
    t,
    currentLanguage: i18n.language as SupportedLanguage,
    changeLanguage,
    languages: SUPPORTED_LANGUAGES,
    isRTL: false, // Add RTL support if needed
  };
}

// Formatted date/time based on locale
export function useLocalizedDate() {
  const { i18n } = useTranslation();

  const formatDate = (date: Date, options?: Intl.DateTimeFormatOptions) => {
    return new Intl.DateTimeFormat(i18n.language, options).format(date);
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
      return i18n.t('time.justNow');
    } else if (diffMins < 60) {
      return i18n.t('time.minutesAgo', { count: diffMins });
    } else if (diffHours < 24) {
      return i18n.t('time.hoursAgo', { count: diffHours });
    } else {
      return i18n.t('time.daysAgo', { count: diffDays });
    }
  };

  return { formatDate, formatRelativeTime };
}

// Number formatting based on locale
export function useLocalizedNumber() {
  const { i18n } = useTranslation();

  const formatNumber = (num: number, options?: Intl.NumberFormatOptions) => {
    return new Intl.NumberFormat(i18n.language, options).format(num);
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDistance = (miles: number, unit: 'miles' | 'kilometers' = 'miles') => {
    if (unit === 'kilometers') {
      const km = miles * 1.60934;
      return `${formatNumber(Math.round(km))} km`;
    }
    return `${formatNumber(Math.round(miles))} mi`;
  };

  return { formatNumber, formatCurrency, formatDistance };
}

const styles = StyleSheet.create({
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  flag: {
    fontSize: 20,
    marginRight: 12,
  },
  selectedLanguage: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  chevron: {
    fontSize: 20,
    color: '#8892b0',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#8892b0',
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  languageItemSelected: {
    backgroundColor: 'rgba(233, 69, 96, 0.1)',
  },
  languageFlag: {
    fontSize: 28,
    marginRight: 16,
  },
  languageInfo: {
    flex: 1,
  },
  languageNative: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 2,
  },
  languageName: {
    fontSize: 13,
    color: '#8892b0',
  },
  checkmark: {
    fontSize: 18,
    color: '#e94560',
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginLeft: 60,
  },
});

export default LanguageSelector;
