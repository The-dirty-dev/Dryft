import { useState, useEffect, useCallback } from 'react';
import {
  appUpdateService,
  VersionInfo,
  UpdateCheckResult,
} from '../services/appUpdate';

// ============================================================================
// useAppUpdate - Main update checking hook
// ============================================================================

/**
 * React hook `useAppUpdate`.
 * @param checkOnMount - Hook parameter.
 * @returns Hook state and actions.
 * @example
 * const value = useAppUpdate(checkOnMount);
 */
export function useAppUpdate(checkOnMount: boolean = true) {
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdate = useCallback(async (force: boolean = false) => {
    setIsChecking(true);
    setError(null);

    try {
      const checkResult = await appUpdateService.checkForUpdate(force);
      setResult(checkResult);
      return checkResult;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    if (checkOnMount) {
      checkForUpdate();
    }
  }, [checkOnMount, checkForUpdate]);

  const showUpdatePrompt = useCallback(() => {
    if (result?.versionInfo) {
      appUpdateService.showUpdateAlert(result.versionInfo);
    }
  }, [result]);

  const skipVersion = useCallback(async () => {
    if (result?.versionInfo.latestVersion) {
      await appUpdateService.skipVersion(result.versionInfo.latestVersion);
      setResult((prev) =>
        prev ? { ...prev, shouldShowPrompt: false } : null
      );
    }
  }, [result]);

  const remindLater = useCallback(async () => {
    await appUpdateService.remindLater();
    setResult((prev) =>
      prev ? { ...prev, shouldShowPrompt: false } : null
    );
  }, []);

  const openStore = useCallback(() => {
    appUpdateService.openStore();
  }, []);

  return {
    isChecking,
    isUpdateAvailable: result?.isUpdateAvailable || false,
    isUpdateRequired: result?.isUpdateRequired || false,
    shouldShowPrompt: result?.shouldShowPrompt || false,
    versionInfo: result?.versionInfo || null,
    error,
    checkForUpdate,
    showUpdatePrompt,
    skipVersion,
    remindLater,
    openStore,
  };
}

// ============================================================================
// useVersionInfo - Get current app version info
// ============================================================================

/**
 * React hook `useVersionInfo`.
 * @returns Hook state and actions.
 * @example
 * const value = useVersionInfo();
 */
export function useVersionInfo() {
  return {
    currentVersion: appUpdateService.getCurrentVersion(),
    buildNumber: appUpdateService.getBuildNumber(),
    storeUrl: appUpdateService.getStoreUrl(),
  };
}

// ============================================================================
// useRequiredUpdate - Handle required updates
// ============================================================================

/**
 * React hook `useRequiredUpdate`.
 * @returns Hook state and actions.
 * @example
 * const value = useRequiredUpdate();
 */
export function useRequiredUpdate() {
  const { isUpdateRequired, versionInfo, isChecking } = useAppUpdate(true);
  const [showBlocker, setShowBlocker] = useState(false);

  useEffect(() => {
    if (isUpdateRequired && !isChecking) {
      setShowBlocker(true);
    }
  }, [isUpdateRequired, isChecking]);

  const openStore = useCallback(() => {
    appUpdateService.openStore();
  }, []);

  return {
    showBlocker,
    versionInfo,
    openStore,
  };
}

export default useAppUpdate;
