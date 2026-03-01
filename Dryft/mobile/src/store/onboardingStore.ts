import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type OnboardingStep =
  | 'welcome'
  | 'features'
  | 'safety'
  | 'permissions'
  | 'profile_photo'
  | 'profile_bio'
  | 'preferences'
  | 'complete';

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  profileData: {
    photos: string[];
    bio: string;
    interests: string[];
  };
  permissionsGranted: {
    notifications: boolean;
    camera: boolean;
    microphone: boolean;
    location: boolean;
  };

  // Actions
  setCurrentStep: (step: OnboardingStep) => void;
  completeStep: (step: OnboardingStep) => void;
  setProfilePhoto: (uri: string) => void;
  removeProfilePhoto: (index: number) => void;
  setProfileBio: (bio: string) => void;
  setInterests: (interests: string[]) => void;
  setPermission: (permission: keyof OnboardingState['permissionsGranted'], granted: boolean) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  'welcome',
  'features',
  'safety',
  'permissions',
  'profile_photo',
  'profile_bio',
  'preferences',
  'complete',
];

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      hasCompletedOnboarding: false,
      currentStep: 'welcome',
      completedSteps: [],
      profileData: {
        photos: [],
        bio: '',
        interests: [],
      },
      permissionsGranted: {
        notifications: false,
        camera: false,
        microphone: false,
        location: false,
      },

      setCurrentStep: (step) => set({ currentStep: step }),

      completeStep: (step) => {
        const { completedSteps } = get();
        if (!completedSteps.includes(step)) {
          const newCompletedSteps = [...completedSteps, step];
          const currentIndex = ONBOARDING_STEPS.indexOf(step);
          const nextStep = ONBOARDING_STEPS[currentIndex + 1] || 'complete';

          set({
            completedSteps: newCompletedSteps,
            currentStep: nextStep,
          });
        }
      },

      setProfilePhoto: (uri) => {
        const { profileData } = get();
        if (profileData.photos.length < 6) {
          set({
            profileData: {
              ...profileData,
              photos: [...profileData.photos, uri],
            },
          });
        }
      },

      removeProfilePhoto: (index) => {
        const { profileData } = get();
        set({
          profileData: {
            ...profileData,
            photos: profileData.photos.filter((_, i) => i !== index),
          },
        });
      },

      setProfileBio: (bio) => {
        const { profileData } = get();
        set({
          profileData: {
            ...profileData,
            bio,
          },
        });
      },

      setInterests: (interests) => {
        const { profileData } = get();
        set({
          profileData: {
            ...profileData,
            interests,
          },
        });
      },

      setPermission: (permission, granted) => {
        const { permissionsGranted } = get();
        set({
          permissionsGranted: {
            ...permissionsGranted,
            [permission]: granted,
          },
        });
      },

      completeOnboarding: () => set({
        hasCompletedOnboarding: true,
        currentStep: 'complete',
      }),

      resetOnboarding: () => set({
        hasCompletedOnboarding: false,
        currentStep: 'welcome',
        completedSteps: [],
        profileData: {
          photos: [],
          bio: '',
          interests: [],
        },
        permissionsGranted: {
          notifications: false,
          camera: false,
          microphone: false,
          location: false,
        },
      }),
    }),
    {
      name: 'dryft-onboarding',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export const getNextStep = (currentStep: OnboardingStep): OnboardingStep => {
  const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);
  return ONBOARDING_STEPS[currentIndex + 1] || 'complete';
};

export const getPreviousStep = (currentStep: OnboardingStep): OnboardingStep | null => {
  const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);
  return currentIndex > 0 ? ONBOARDING_STEPS[currentIndex - 1] : null;
};

export const getStepProgress = (currentStep: OnboardingStep): number => {
  const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);
  return (currentIndex + 1) / ONBOARDING_STEPS.length;
};
