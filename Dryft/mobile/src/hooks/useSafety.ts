import { useState, useEffect, useCallback, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import {
  safetyService,
  EmergencyContact,
  SafetyCheck,
  LocationSharingSettings,
  ScamWarning,
} from '../services/safety';

// ============================================================================
// useEmergencyContacts - Manage emergency contacts
// ============================================================================

/**
 * React hook `useEmergencyContacts`.
 * @returns Hook state and actions.
 * @example
 * const value = useEmergencyContacts();
 */
export function useEmergencyContacts() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      await safetyService.initialize();
      setContacts(safetyService.getEmergencyContacts());
      setIsLoading(false);
    };
    load();
  }, []);

  const addContact = useCallback(
    async (name: string, phone: string, relationship: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const contact = await safetyService.addEmergencyContact(name, phone, relationship);
      if (contact) {
        setContacts(safetyService.getEmergencyContacts());
        return true;
      }
      return false;
    },
    []
  );

  const removeContact = useCallback(async (contactId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const success = await safetyService.removeEmergencyContact(contactId);
    if (success) {
      setContacts(safetyService.getEmergencyContacts());
    }
    return success;
  }, []);

  const verifyContact = useCallback(async (contactId: string) => {
    const success = await safetyService.verifyContact(contactId);
    if (success) {
      setContacts(safetyService.getEmergencyContacts());
    }
    return success;
  }, []);

  const verifiedContacts = useMemo(
    () => contacts.filter((c) => c.isVerified),
    [contacts]
  );

  return {
    contacts,
    verifiedContacts,
    verifiedCount: verifiedContacts.length,
    isLoading,
    addContact,
    removeContact,
    verifyContact,
  };
}

// ============================================================================
// useEmergencyAlert - Trigger emergency alerts
// ============================================================================

/**
 * React hook `useEmergencyAlert`.
 * @returns Hook state and actions.
 * @example
 * const value = useEmergencyAlert();
 */
export function useEmergencyAlert() {
  const [isTriggering, setIsTriggering] = useState(false);

  const triggerAlert = useCallback(async (includeLocation: boolean = true) => {
    setIsTriggering(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    const success = await safetyService.triggerEmergencyAlert(includeLocation);

    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setIsTriggering(false);
    return success;
  }, []);

  const callEmergencyServices = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await safetyService.callEmergencyServices();
  }, []);

  return {
    isTriggering,
    triggerAlert,
    callEmergencyServices,
  };
}

// ============================================================================
// useSafetyCheck - Schedule safety check-ins for dates
// ============================================================================

/**
 * React hook `useSafetyCheck`.
 * @returns Hook state and actions.
 * @example
 * const value = useSafetyCheck();
 */
export function useSafetyCheck() {
  const [pendingChecks, setPendingChecks] = useState<SafetyCheck[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      await safetyService.initialize();
      setPendingChecks(safetyService.getPendingSafetyChecks());
      setIsLoading(false);
    };
    load();
  }, []);

  const scheduleCheck = useCallback(
    async (
      matchId: string,
      matchName: string,
      scheduledAt: Date,
      location?: { latitude: number; longitude: number; address?: string }
    ) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const check = await safetyService.scheduleSafetyCheck(
        matchId,
        matchName,
        scheduledAt,
        location
      );

      if (check) {
        setPendingChecks(safetyService.getPendingSafetyChecks());
        return check;
      }
      return null;
    },
    []
  );

  const confirmCheck = useCallback(async (checkId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await safetyService.confirmSafetyCheck(checkId);
    if (success) {
      setPendingChecks(safetyService.getPendingSafetyChecks());
    }
    return success;
  }, []);

  const cancelCheck = useCallback(async (checkId: string) => {
    const success = await safetyService.cancelSafetyCheck(checkId);
    if (success) {
      setPendingChecks(safetyService.getPendingSafetyChecks());
    }
    return success;
  }, []);

  return {
    pendingChecks,
    hasPendingChecks: pendingChecks.length > 0,
    isLoading,
    scheduleCheck,
    confirmCheck,
    cancelCheck,
  };
}

// ============================================================================
// useLocationSharing - Location sharing preferences
// ============================================================================

/**
 * React hook `useLocationSharing`.
 * @returns Hook state and actions.
 * @example
 * const value = useLocationSharing();
 */
export function useLocationSharing() {
  const [settings, setSettings] = useState<LocationSharingSettings>({
    enabled: true,
    showExactLocation: false,
    showDistance: true,
    showCity: true,
    shareWithMatches: true,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      await safetyService.initialize();
      setSettings(safetyService.getLocationSettings());
      setIsLoading(false);
    };
    load();
  }, []);

  const updateSettings = useCallback(
    async (newSettings: Partial<LocationSharingSettings>) => {
      await safetyService.updateLocationSettings(newSettings);
      setSettings(safetyService.getLocationSettings());
    },
    []
  );

  const toggleEnabled = useCallback(async () => {
    await updateSettings({ enabled: !settings.enabled });
  }, [settings.enabled, updateSettings]);

  const toggleExactLocation = useCallback(async () => {
    await updateSettings({ showExactLocation: !settings.showExactLocation });
  }, [settings.showExactLocation, updateSettings]);

  const toggleDistance = useCallback(async () => {
    await updateSettings({ showDistance: !settings.showDistance });
  }, [settings.showDistance, updateSettings]);

  const toggleCity = useCallback(async () => {
    await updateSettings({ showCity: !settings.showCity });
  }, [settings.showCity, updateSettings]);

  return {
    settings,
    isLoading,
    updateSettings,
    toggleEnabled,
    toggleExactLocation,
    toggleDistance,
    toggleCity,
  };
}

// ============================================================================
// useScamDetection - Detect potential scams in messages
// ============================================================================

/**
 * React hook `useScamDetection`.
 * @returns Hook state and actions.
 * @example
 * const value = useScamDetection();
 */
export function useScamDetection() {
  const [warnings, setWarnings] = useState<ScamWarning[]>([]);
  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());

  const analyzeMessage = useCallback((message: string): ScamWarning | null => {
    return safetyService.analyzeMessageForScams(message);
  }, []);

  const addWarning = useCallback((warning: ScamWarning) => {
    if (!dismissedWarnings.has(warning.id)) {
      setWarnings((prev) => [...prev, warning]);
    }
  }, [dismissedWarnings]);

  const dismissWarning = useCallback((warningId: string) => {
    setDismissedWarnings((prev) => new Set([...prev, warningId]));
    setWarnings((prev) => prev.filter((w) => w.id !== warningId));
  }, []);

  const clearWarnings = useCallback(() => {
    setWarnings([]);
  }, []);

  const activeWarnings = useMemo(
    () => warnings.filter((w) => !dismissedWarnings.has(w.id)),
    [warnings, dismissedWarnings]
  );

  return {
    warnings: activeWarnings,
    hasWarnings: activeWarnings.length > 0,
    highSeverityCount: activeWarnings.filter((w) => w.severity === 'high').length,
    analyzeMessage,
    addWarning,
    dismissWarning,
    clearWarnings,
  };
}

// ============================================================================
// useSafetyTips - Get safety tips
// ============================================================================

/**
 * React hook `useSafetyTips`.
 * @returns Hook state and actions.
 * @example
 * const value = useSafetyTips();
 */
export function useSafetyTips() {
  const tips = useMemo(() => safetyService.getSafetyTips(), []);

  const getRandomTip = useCallback(() => {
    return tips[Math.floor(Math.random() * tips.length)];
  }, [tips]);

  return {
    tips,
    getRandomTip,
    tipCount: tips.length,
  };
}

// ============================================================================
// useSafety - Combined safety hook
// ============================================================================

/**
 * React hook `useSafety`.
 * @returns Hook state and actions.
 * @example
 * const value = useSafety();
 */
export function useSafety() {
  const emergencyContacts = useEmergencyContacts();
  const emergencyAlert = useEmergencyAlert();
  const safetyCheck = useSafetyCheck();
  const locationSharing = useLocationSharing();
  const scamDetection = useScamDetection();
  const safetyTips = useSafetyTips();

  const isFullySetup = useMemo(() => {
    return emergencyContacts.verifiedCount >= 1;
  }, [emergencyContacts.verifiedCount]);

  return {
    // Emergency Contacts
    ...emergencyContacts,

    // Emergency Alert
    triggerAlert: emergencyAlert.triggerAlert,
    callEmergencyServices: emergencyAlert.callEmergencyServices,
    isTriggering: emergencyAlert.isTriggering,

    // Safety Check
    pendingChecks: safetyCheck.pendingChecks,
    scheduleCheck: safetyCheck.scheduleCheck,
    confirmCheck: safetyCheck.confirmCheck,
    cancelCheck: safetyCheck.cancelCheck,

    // Location Sharing
    locationSettings: locationSharing.settings,
    updateLocationSettings: locationSharing.updateSettings,

    // Scam Detection
    analyzeMessage: scamDetection.analyzeMessage,
    scamWarnings: scamDetection.warnings,
    hasScamWarnings: scamDetection.hasWarnings,
    dismissWarning: scamDetection.dismissWarning,

    // Safety Tips
    safetyTips: safetyTips.tips,
    getRandomTip: safetyTips.getRandomTip,

    // Setup Status
    isFullySetup,
  };
}

export default useSafety;
