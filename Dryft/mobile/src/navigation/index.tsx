import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';

import { useAuthStore } from '../store/authStore';
import { useOnboardingStore } from '../store/onboardingStore';
import { UserPublicProfile } from '../types';
import { ToastProvider } from '../components/Toast';
import { GlobalNotifications } from '../components/GlobalNotifications';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Onboarding Screens
import {
  WelcomeScreen,
  FeaturesScreen,
  SafetyScreen,
  PermissionsScreen,
  ProfilePhotoScreen,
  ProfileBioScreen,
  PreferencesSetupScreen,
  OnboardingCompleteScreen,
} from '../screens/onboarding';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Main Screens
import HomeScreen from '../screens/main/HomeScreen';
import StoreScreen from '../screens/main/StoreScreen';
import InventoryScreen from '../screens/main/InventoryScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

// Discover & Matching Screens
import DiscoverScreen from '../screens/discover/DiscoverScreen';
import MatchesScreen from '../screens/discover/MatchesScreen';

// Chat Screens
import ChatScreen from '../screens/chat/ChatScreen';

// Detail Screens
import ItemDetailScreen from '../screens/detail/ItemDetailScreen';
import CreatorScreen from '../screens/detail/CreatorScreen';

// Verification Screens
import VerificationStatusScreen from '../screens/verification/VerificationStatusScreen';
import CardVerificationScreen from '../screens/verification/CardVerificationScreen';
import IDVerificationScreen from '../screens/verification/IDVerificationScreen';

// Checkout Screens
import CheckoutScreen from '../screens/checkout/CheckoutScreen';
import CheckoutSuccessScreen from '../screens/checkout/CheckoutSuccessScreen';

// Settings
import SettingsScreen from '../screens/settings/SettingsScreen';
import HapticSettingsScreen from '../screens/settings/HapticSettingsScreen';
import SecuritySettingsScreen from '../screens/settings/SecuritySettingsScreen';

// Profile
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import PreferencesScreen from '../screens/profile/PreferencesScreen';

// Calls
import VideoCallScreen from '../screens/calls/VideoCallScreen';
import IncomingCallScreen from '../screens/calls/IncomingCallScreen';

// Companion
import CompanionScreen from '../screens/companion/CompanionScreen';

// Types
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type OnboardingStackParamList = {
  Welcome: undefined;
  Features: undefined;
  Safety: undefined;
  Permissions: undefined;
  ProfilePhoto: undefined;
  ProfileBio: undefined;
  PreferencesSetup: undefined;
  OnboardingComplete: undefined;
};

export type VerificationStackParamList = {
  VerificationStatus: undefined;
  CardVerification: undefined;
  IDVerification: undefined;
};

export type MainTabParamList = {
  Discover: undefined;
  Home: undefined;
  Store: undefined;
  Inventory: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Verification: undefined;
  MainTabs: undefined;
  ItemDetail: { itemId: string };
  Creator: { creatorId: string };
  Checkout: { itemId: string; purchaseId: string; clientSecret: string };
  CheckoutSuccess: { purchaseId: string };
  Settings: undefined;
  HapticSettings: undefined;
  SecuritySettings: undefined;
  Matches: undefined;
  Chat: { matchId: string; user: UserPublicProfile };
  EditProfile: undefined;
  Preferences: undefined;
  VideoCall: {
    matchId: string;
    userId: string;
    userName: string;
    isIncoming: boolean;
    videoEnabled: boolean;
    callId: string;
  };
  IncomingCall: {
    callId: string;
    callerId: string;
    callerName: string;
    callerPhoto?: string;
    videoEnabled: boolean;
    matchId: string;
  };
  Companion: {
    sessionCode?: string;
    inBooth?: boolean;
    partnerName?: string;
    triggerHaptic?: boolean;
    hapticIntensity?: number;
  } | undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const VerificationStack = createNativeStackNavigator<VerificationStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

const withScreenBoundary = <P extends object>(Screen: React.ComponentType<P>) => {
  const WrappedScreen = (props: P) => (
    <ErrorBoundary level="screen">
      <Screen {...props} />
    </ErrorBoundary>
  );
  WrappedScreen.displayName = `WithScreenBoundary(${Screen.displayName || Screen.name || 'Screen'})`;
  return WrappedScreen;
};

// Onboarding
const WelcomeScreenWithBoundary = withScreenBoundary(WelcomeScreen);
const FeaturesScreenWithBoundary = withScreenBoundary(FeaturesScreen);
const SafetyScreenWithBoundary = withScreenBoundary(SafetyScreen);
const PermissionsScreenWithBoundary = withScreenBoundary(PermissionsScreen);
const ProfilePhotoScreenWithBoundary = withScreenBoundary(ProfilePhotoScreen);
const ProfileBioScreenWithBoundary = withScreenBoundary(ProfileBioScreen);
const PreferencesSetupScreenWithBoundary = withScreenBoundary(PreferencesSetupScreen);
const OnboardingCompleteScreenWithBoundary = withScreenBoundary(OnboardingCompleteScreen);

// Auth
const LoginScreenWithBoundary = withScreenBoundary(LoginScreen);
const RegisterScreenWithBoundary = withScreenBoundary(RegisterScreen);

// Main tabs
const DiscoverScreenWithBoundary = withScreenBoundary(DiscoverScreen);
const HomeScreenWithBoundary = withScreenBoundary(HomeScreen);
const StoreScreenWithBoundary = withScreenBoundary(StoreScreen);
const InventoryScreenWithBoundary = withScreenBoundary(InventoryScreen);
const ProfileScreenWithBoundary = withScreenBoundary(ProfileScreen);

// Discover & Matching
const MatchesScreenWithBoundary = withScreenBoundary(MatchesScreen);

// Chat
const ChatScreenWithBoundary = withScreenBoundary(ChatScreen);

// Detail
const ItemDetailScreenWithBoundary = withScreenBoundary(ItemDetailScreen);
const CreatorScreenWithBoundary = withScreenBoundary(CreatorScreen);

// Verification
const VerificationStatusScreenWithBoundary = withScreenBoundary(VerificationStatusScreen);
const CardVerificationScreenWithBoundary = withScreenBoundary(CardVerificationScreen);
const IDVerificationScreenWithBoundary = withScreenBoundary(IDVerificationScreen);

// Checkout
const CheckoutScreenWithBoundary = withScreenBoundary(CheckoutScreen);
const CheckoutSuccessScreenWithBoundary = withScreenBoundary(CheckoutSuccessScreen);

// Settings
const SettingsScreenWithBoundary = withScreenBoundary(SettingsScreen);
const HapticSettingsScreenWithBoundary = withScreenBoundary(HapticSettingsScreen);
const SecuritySettingsScreenWithBoundary = withScreenBoundary(SecuritySettingsScreen);

// Profile
const EditProfileScreenWithBoundary = withScreenBoundary(EditProfileScreen);
const PreferencesScreenWithBoundary = withScreenBoundary(PreferencesScreen);

// Calls
const VideoCallScreenWithBoundary = withScreenBoundary(VideoCallScreen);
const IncomingCallScreenWithBoundary = withScreenBoundary(IncomingCallScreen);

// Companion
const CompanionScreenWithBoundary = withScreenBoundary(CompanionScreen);

function OnboardingNavigator() {
  const { currentStep } = useOnboardingStore();

  const getInitialRoute = (): keyof OnboardingStackParamList => {
    switch (currentStep) {
      case 'welcome': return 'Welcome';
      case 'features': return 'Features';
      case 'safety': return 'Safety';
      case 'permissions': return 'Permissions';
      case 'profile_photo': return 'ProfilePhoto';
      case 'profile_bio': return 'ProfileBio';
      case 'preferences': return 'PreferencesSetup';
      case 'complete': return 'OnboardingComplete';
      default: return 'Welcome';
    }
  };

  return (
    <OnboardingStack.Navigator
      initialRouteName={getInitialRoute()}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <OnboardingStack.Screen name="Welcome" component={WelcomeScreenWithBoundary} />
      <OnboardingStack.Screen name="Features" component={FeaturesScreenWithBoundary} />
      <OnboardingStack.Screen name="Safety" component={SafetyScreenWithBoundary} />
      <OnboardingStack.Screen name="Permissions" component={PermissionsScreenWithBoundary} />
      <OnboardingStack.Screen name="ProfilePhoto" component={ProfilePhotoScreenWithBoundary} />
      <OnboardingStack.Screen name="ProfileBio" component={ProfileBioScreenWithBoundary} />
      <OnboardingStack.Screen name="PreferencesSetup" component={PreferencesSetupScreenWithBoundary} />
      <OnboardingStack.Screen name="OnboardingComplete" component={OnboardingCompleteScreenWithBoundary} />
    </OnboardingStack.Navigator>
  );
}

function VerificationNavigator() {
  return (
    <VerificationStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#1a1a2e' },
        headerTintColor: '#fff',
      }}
    >
      <VerificationStack.Screen
        name="VerificationStatus"
        component={VerificationStatusScreenWithBoundary}
        options={{ headerShown: false }}
      />
      <VerificationStack.Screen
        name="CardVerification"
        component={CardVerificationScreenWithBoundary}
        options={{ title: 'Card Verification' }}
      />
      <VerificationStack.Screen
        name="IDVerification"
        component={IDVerificationScreenWithBoundary}
        options={{ title: 'ID Verification' }}
      />
    </VerificationStack.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreenWithBoundary} />
      <AuthStack.Screen name="Register" component={RegisterScreenWithBoundary} />
    </AuthStack.Navigator>
  );
}

function MainTabNavigator() {
  return (
    <MainTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a1a2e',
          borderTopColor: '#16213e',
        },
        tabBarActiveTintColor: '#e94560',
        tabBarInactiveTintColor: '#8892b0',
      }}
    >
      <MainTab.Screen
        name="Discover"
        component={DiscoverScreenWithBoundary}
        options={{
          tabBarLabel: 'Discover',
        }}
      />
      <MainTab.Screen
        name="Home"
        component={HomeScreenWithBoundary}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      <MainTab.Screen
        name="Store"
        component={StoreScreenWithBoundary}
        options={{
          tabBarLabel: 'Store',
        }}
      />
      <MainTab.Screen
        name="Inventory"
        component={InventoryScreenWithBoundary}
        options={{
          tabBarLabel: 'Inventory',
        }}
      />
      <MainTab.Screen
        name="Profile"
        component={ProfileScreenWithBoundary}
        options={{
          tabBarLabel: 'Profile',
        }}
      />
    </MainTab.Navigator>
  );
}

function RootNavigator({ isVerified }: { isVerified: boolean }) {
  return (
    <RootStack.Navigator
      initialRouteName={isVerified ? 'MainTabs' : 'Verification'}
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1a1a2e',
        },
        headerTintColor: '#fff',
      }}
    >
      <RootStack.Screen
        name="Verification"
        component={VerificationNavigator}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="MainTabs"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="ItemDetail"
        component={ItemDetailScreenWithBoundary}
        options={{ title: 'Item Details' }}
      />
      <RootStack.Screen
        name="Creator"
        component={CreatorScreenWithBoundary}
        options={{ title: 'Creator' }}
      />
      <RootStack.Screen
        name="Checkout"
        component={CheckoutScreenWithBoundary}
        options={{ title: 'Checkout' }}
      />
      <RootStack.Screen
        name="CheckoutSuccess"
        component={CheckoutSuccessScreenWithBoundary}
        options={{ title: 'Purchase Complete', headerLeft: () => null }}
      />
      <RootStack.Screen
        name="Settings"
        component={SettingsScreenWithBoundary}
        options={{ title: 'Settings' }}
      />
      <RootStack.Screen
        name="HapticSettings"
        component={HapticSettingsScreenWithBoundary}
        options={{ title: 'Haptic Device' }}
      />
      <RootStack.Screen
        name="SecuritySettings"
        component={SecuritySettingsScreenWithBoundary}
        options={{ title: 'Security' }}
      />
      <RootStack.Screen
        name="Matches"
        component={MatchesScreenWithBoundary}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="Chat"
        component={ChatScreenWithBoundary}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="EditProfile"
        component={EditProfileScreenWithBoundary}
        options={{ title: 'Edit Profile' }}
      />
      <RootStack.Screen
        name="Preferences"
        component={PreferencesScreenWithBoundary}
        options={{ title: 'Preferences' }}
      />
      <RootStack.Screen
        name="VideoCall"
        component={VideoCallScreenWithBoundary}
        options={{
          headerShown: false,
          animation: 'fade',
          gestureEnabled: false,
        }}
      />
      <RootStack.Screen
        name="IncomingCall"
        component={IncomingCallScreenWithBoundary}
        options={{
          headerShown: false,
          animation: 'fade',
          presentation: 'fullScreenModal',
          gestureEnabled: false,
        }}
      />
      <RootStack.Screen
        name="Companion"
        component={CompanionScreenWithBoundary}
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
    </RootStack.Navigator>
  );
}

export default function Navigation() {
  const { isAuthenticated, isLoading, isVerified, initialize } = useAuthStore();
  const { hasCompletedOnboarding } = useOnboardingStore();

  React.useEffect(() => {
    initialize();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f23' }}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  const renderContent = () => {
    if (!isAuthenticated) {
      return <AuthNavigator />;
    }

    if (!hasCompletedOnboarding) {
      return <OnboardingNavigator />;
    }

    return <RootNavigator isVerified={isVerified} />;
  };

  return (
    <ToastProvider>
      <NavigationContainer>
        {isAuthenticated && hasCompletedOnboarding && <GlobalNotifications />}
        {renderContent()}
      </NavigationContainer>
    </ToastProvider>
  );
}
