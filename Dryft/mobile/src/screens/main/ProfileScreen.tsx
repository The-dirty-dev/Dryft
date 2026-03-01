import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { RootStackParamList } from '../../navigation';
import { Avatar, Button, Card } from '../../components/common';
import { useColors, ThemeColors } from '../../theme/ThemeProvider';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation();
  const colors = useColors();
  const styles = createStyles(colors);
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(t('alerts.title.logout'), t('alerts.settings.logoutMessage'), [
      { text: t('alerts.actions.cancel'), style: 'cancel' },
      {
        text: t('alerts.actions.logout'),
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Avatar
            uri={user?.profile_photo}
            name={user?.display_name || user?.email}
            size={100}
            style={styles.avatar}
          />
        </View>
        <Text style={styles.name}>{user?.display_name || 'User'}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        {user?.verified ? (
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        ) : (
          <View style={styles.unverifiedBadge}>
            <Text style={styles.unverifiedText}>Not Verified</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <Card style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <Text style={styles.menuItemText}>Edit Profile</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </TouchableOpacity>
          </Card>

          <Card style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('Preferences')}
            >
              <Text style={styles.menuItemText}>Discovery Preferences</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </TouchableOpacity>
          </Card>

          <Card style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuItemText}>Purchase History</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </TouchableOpacity>
          </Card>

          {!user?.verified && (
            <Card style={styles.menuCard}>
              <TouchableOpacity style={styles.menuItem}>
                <Text style={styles.menuItemText}>Complete Verification</Text>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>
            </Card>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Creator</Text>

          <Card style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuItemText}>Become a Creator</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </TouchableOpacity>
          </Card>

          <Card style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuItemText}>My Store</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </TouchableOpacity>
          </Card>

          <Card style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuItemText}>Earnings</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </TouchableOpacity>
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>

          <Card style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuItemText}>Notifications</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </TouchableOpacity>
          </Card>

          <Card style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuItemText}>Privacy</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </TouchableOpacity>
          </Card>

          <Card style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem}>
              <Text style={styles.menuItemText}>Help & Support</Text>
              <Text style={styles.menuItemArrow}>›</Text>
            </TouchableOpacity>
          </Card>
        </View>

        <Button
          title="Logout"
          variant="outline"
          onPress={handleLogout}
          style={styles.logoutButton}
          textStyle={styles.logoutText}
        />

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: colors.surface,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    borderWidth: 3,
    borderColor: colors.primary,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  email: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  verifiedBadge: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: `${colors.success}33`,
  },
  verifiedText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  unverifiedBadge: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: `${colors.warning}33`,
  },
  unverifiedText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuCard: {
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    color: colors.text,
  },
  menuItemArrow: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  logoutButton: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  logoutText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 100,
  },
});
