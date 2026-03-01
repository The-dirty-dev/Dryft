import accessibilityService from '../../services/accessibility';
import * as Haptics from 'expo-haptics';

jest.mock('../../services/analytics', () => ({
  trackEvent: jest.fn(),
}));

describe('accessibilityService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await accessibilityService.updatePreferences({ hapticFeedback: true });
  });

  it('skips haptic feedback when disabled', async () => {
    await accessibilityService.updatePreferences({ hapticFeedback: false });

    await accessibilityService.triggerHaptic('light');

    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('triggers success notification haptic', async () => {
    await accessibilityService.triggerHaptic('success');

    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      (Haptics as any).NotificationFeedbackType.Success
    );
  });
});
