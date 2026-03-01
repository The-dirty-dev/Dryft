import {
  useOnboardingStore,
  getNextStep,
  getPreviousStep,
  getStepProgress,
} from '../store/onboardingStore';

describe('onboardingStore', () => {
  beforeEach(() => {
    useOnboardingStore.setState(
      {
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
      },
      false
    );
  });

  it('advances to the next step when completing a step', () => {
    useOnboardingStore.getState().completeStep('welcome');

    const state = useOnboardingStore.getState();
    expect(state.completedSteps).toContain('welcome');
    expect(state.currentStep).toBe('features');
  });

  it('does not duplicate completed steps', () => {
    useOnboardingStore.getState().completeStep('welcome');
    useOnboardingStore.getState().completeStep('welcome');

    const state = useOnboardingStore.getState();
    expect(state.completedSteps).toEqual(['welcome']);
  });

  it('adds and removes profile photos', () => {
    useOnboardingStore.getState().setProfilePhoto('file://photo-1.jpg');
    useOnboardingStore.getState().setProfilePhoto('file://photo-2.jpg');
    useOnboardingStore.getState().removeProfilePhoto(0);

    const state = useOnboardingStore.getState();
    expect(state.profileData.photos).toEqual(['file://photo-2.jpg']);
  });

  it('limits profile photos to six', () => {
    const store = useOnboardingStore.getState();
    for (let i = 0; i < 7; i += 1) {
      store.setProfilePhoto(`file://photo-${i}.jpg`);
    }

    const state = useOnboardingStore.getState();
    expect(state.profileData.photos).toHaveLength(6);
  });

  it('updates permissions and marks onboarding complete', () => {
    useOnboardingStore.getState().setPermission('camera', true);
    useOnboardingStore.getState().completeOnboarding();

    const state = useOnboardingStore.getState();
    expect(state.permissionsGranted.camera).toBe(true);
    expect(state.hasCompletedOnboarding).toBe(true);
    expect(state.currentStep).toBe('complete');
  });
});

describe('onboarding helpers', () => {
  it('computes next and previous steps', () => {
    expect(getNextStep('welcome')).toBe('features');
    expect(getPreviousStep('welcome')).toBeNull();
    expect(getPreviousStep('features')).toBe('welcome');
  });

  it('returns step progress as a fraction', () => {
    const progress = getStepProgress('features');
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThanOrEqual(1);
  });
});
