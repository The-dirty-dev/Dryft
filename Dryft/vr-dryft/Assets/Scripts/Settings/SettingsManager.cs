using System;
using System.IO;
using UnityEngine;
using UnityEngine.Events;

namespace Drift.Settings
{
    [Serializable]
    public class VRSettings
    {
        public ComfortMode comfortMode = ComfortMode.Comfortable;
        public MovementType movementType = MovementType.Teleport;
        public TurnType turnType = TurnType.Snap;
        public int snapTurnAngle = 45;
        public float smoothTurnSpeed = 60f;
        public Handedness handedness = Handedness.Right;
        public bool showVignette = true;
        public float heightCalibration = 0f;
        public int voiceChatVolume = 80;
        public int musicVolume = 50;
        public int sfxVolume = 70;
        public bool spatialAudio = true;
    }

    [Serializable]
    public class SafetySettings
    {
        public bool panicButtonEnabled = true;
        public bool panicButtonVibration = true;
        public bool autoBlockOnReport = true;
        public bool hideBlockedContent = true;
        public ContentFilterLevel contentFilterLevel = ContentFilterLevel.Moderate;
        public bool requireConsentForHaptics = true;
        public bool safeWordEnabled = false;
        public string safeWord = "";
    }

    [Serializable]
    public class PrivacySettings
    {
        public bool showOnlineStatus = true;
        public bool showLastActive = true;
        public bool allowScreenshots = false;
        public bool shareActivityWithMatches = false;
    }

    [Serializable]
    public class HapticSettings
    {
        public bool enabled = false;
        public string deviceId = null;
        public string deviceName = null;
        public int intensity = 50;
        public bool allowRemoteControl = false;
        public bool requireConsent = true;
        public bool autoConnect = false;
    }

    [Serializable]
    public class AllLocalSettings
    {
        public VRSettings vr = new VRSettings();
        public SafetySettings safety = new SafetySettings();
        public PrivacySettings privacy = new PrivacySettings();
        public HapticSettings haptic = new HapticSettings();
        public long lastModified = 0;
        public int version = 1;
    }

    public enum ComfortMode { Comfortable, Moderate, Intense }
    public enum MovementType { Teleport, Smooth, Hybrid }
    public enum TurnType { Snap, Smooth }
    public enum Handedness { Right, Left }
    public enum ContentFilterLevel { Strict, Moderate, Relaxed }

    public class SettingsManager : MonoBehaviour
    {
        public static SettingsManager Instance { get; private set; }

        [Header("Events")]
        public UnityEvent<VRSettings> onVRSettingsChanged;
        public UnityEvent<SafetySettings> onSafetySettingsChanged;
        public UnityEvent<PrivacySettings> onPrivacySettingsChanged;
        public UnityEvent<HapticSettings> onHapticSettingsChanged;
        public UnityEvent onSettingsLoaded;
        public UnityEvent onSettingsSaved;

        private AllLocalSettings _settings;
        private string _settingsPath;
        private bool _isDirty;
        private float _autoSaveTimer;
        private const float AUTO_SAVE_INTERVAL = 5f;
        private const int SETTINGS_VERSION = 1;

        public VRSettings VR => _settings.vr;
        public SafetySettings Safety => _settings.safety;
        public PrivacySettings Privacy => _settings.privacy;
        public HapticSettings Haptic => _settings.haptic;
        public bool IsDirty => _isDirty;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            _settingsPath = Path.Combine(Application.persistentDataPath, "settings.json");
            LoadSettings();
        }

        private void Update()
        {
            if (_isDirty)
            {
                _autoSaveTimer += Time.deltaTime;
                if (_autoSaveTimer >= AUTO_SAVE_INTERVAL)
                {
                    SaveSettings();
                }
            }
        }

        private void OnApplicationPause(bool pauseStatus)
        {
            if (pauseStatus && _isDirty)
            {
                SaveSettings();
            }
        }

        private void OnApplicationQuit()
        {
            if (_isDirty)
            {
                SaveSettings();
            }
        }

        #region Load/Save

        public void LoadSettings()
        {
            try
            {
                if (File.Exists(_settingsPath))
                {
                    var json = File.ReadAllText(_settingsPath);
                    _settings = JsonUtility.FromJson<AllLocalSettings>(json);

                    // Handle version migrations
                    if (_settings.version < SETTINGS_VERSION)
                    {
                        MigrateSettings(_settings.version);
                    }

                    Debug.Log("Settings loaded successfully");
                }
                else
                {
                    _settings = new AllLocalSettings();
                    Debug.Log("No settings file found, using defaults");
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to load settings: {e.Message}");
                _settings = new AllLocalSettings();
            }

            ApplySettings();
            onSettingsLoaded?.Invoke();
        }

        public void SaveSettings()
        {
            try
            {
                _settings.lastModified = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                _settings.version = SETTINGS_VERSION;

                var json = JsonUtility.ToJson(_settings, true);
                File.WriteAllText(_settingsPath, json);

                _isDirty = false;
                _autoSaveTimer = 0f;

                Debug.Log("Settings saved successfully");
                onSettingsSaved?.Invoke();
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to save settings: {e.Message}");
            }
        }

        private void MigrateSettings(int fromVersion)
        {
            // Handle migrations from older versions
            Debug.Log($"Migrating settings from version {fromVersion} to {SETTINGS_VERSION}");
            _settings.version = SETTINGS_VERSION;
            _isDirty = true;
        }

        #endregion

        #region VR Settings

        public void SetComfortMode(ComfortMode mode)
        {
            if (_settings.vr.comfortMode != mode)
            {
                _settings.vr.comfortMode = mode;
                MarkDirty();
                ApplyVRSettings();
                onVRSettingsChanged?.Invoke(_settings.vr);
            }
        }

        public void SetMovementType(MovementType type)
        {
            if (_settings.vr.movementType != type)
            {
                _settings.vr.movementType = type;
                MarkDirty();
                ApplyVRSettings();
                onVRSettingsChanged?.Invoke(_settings.vr);
            }
        }

        public void SetTurnType(TurnType type)
        {
            if (_settings.vr.turnType != type)
            {
                _settings.vr.turnType = type;
                MarkDirty();
                ApplyVRSettings();
                onVRSettingsChanged?.Invoke(_settings.vr);
            }
        }

        public void SetSnapTurnAngle(int angle)
        {
            angle = Mathf.Clamp(angle, 15, 90);
            if (_settings.vr.snapTurnAngle != angle)
            {
                _settings.vr.snapTurnAngle = angle;
                MarkDirty();
                ApplyVRSettings();
                onVRSettingsChanged?.Invoke(_settings.vr);
            }
        }

        public void SetSmoothTurnSpeed(float speed)
        {
            speed = Mathf.Clamp(speed, 30f, 180f);
            if (!Mathf.Approximately(_settings.vr.smoothTurnSpeed, speed))
            {
                _settings.vr.smoothTurnSpeed = speed;
                MarkDirty();
                ApplyVRSettings();
                onVRSettingsChanged?.Invoke(_settings.vr);
            }
        }

        public void SetHandedness(Handedness handedness)
        {
            if (_settings.vr.handedness != handedness)
            {
                _settings.vr.handedness = handedness;
                MarkDirty();
                ApplyVRSettings();
                onVRSettingsChanged?.Invoke(_settings.vr);
            }
        }

        public void SetShowVignette(bool show)
        {
            if (_settings.vr.showVignette != show)
            {
                _settings.vr.showVignette = show;
                MarkDirty();
                ApplyVRSettings();
                onVRSettingsChanged?.Invoke(_settings.vr);
            }
        }

        public void SetHeightCalibration(float height)
        {
            if (!Mathf.Approximately(_settings.vr.heightCalibration, height))
            {
                _settings.vr.heightCalibration = height;
                MarkDirty();
                ApplyVRSettings();
                onVRSettingsChanged?.Invoke(_settings.vr);
            }
        }

        public void SetVoiceChatVolume(int volume)
        {
            volume = Mathf.Clamp(volume, 0, 100);
            if (_settings.vr.voiceChatVolume != volume)
            {
                _settings.vr.voiceChatVolume = volume;
                MarkDirty();
                ApplyAudioSettings();
                onVRSettingsChanged?.Invoke(_settings.vr);
            }
        }

        public void SetMusicVolume(int volume)
        {
            volume = Mathf.Clamp(volume, 0, 100);
            if (_settings.vr.musicVolume != volume)
            {
                _settings.vr.musicVolume = volume;
                MarkDirty();
                ApplyAudioSettings();
                onVRSettingsChanged?.Invoke(_settings.vr);
            }
        }

        public void SetSFXVolume(int volume)
        {
            volume = Mathf.Clamp(volume, 0, 100);
            if (_settings.vr.sfxVolume != volume)
            {
                _settings.vr.sfxVolume = volume;
                MarkDirty();
                ApplyAudioSettings();
                onVRSettingsChanged?.Invoke(_settings.vr);
            }
        }

        public void SetSpatialAudio(bool enabled)
        {
            if (_settings.vr.spatialAudio != enabled)
            {
                _settings.vr.spatialAudio = enabled;
                MarkDirty();
                ApplyAudioSettings();
                onVRSettingsChanged?.Invoke(_settings.vr);
            }
        }

        #endregion

        #region Safety Settings

        public void SetPanicButtonEnabled(bool enabled)
        {
            if (_settings.safety.panicButtonEnabled != enabled)
            {
                _settings.safety.panicButtonEnabled = enabled;
                MarkDirty();
                onSafetySettingsChanged?.Invoke(_settings.safety);
            }
        }

        public void SetPanicButtonVibration(bool enabled)
        {
            if (_settings.safety.panicButtonVibration != enabled)
            {
                _settings.safety.panicButtonVibration = enabled;
                MarkDirty();
                onSafetySettingsChanged?.Invoke(_settings.safety);
            }
        }

        public void SetAutoBlockOnReport(bool enabled)
        {
            if (_settings.safety.autoBlockOnReport != enabled)
            {
                _settings.safety.autoBlockOnReport = enabled;
                MarkDirty();
                onSafetySettingsChanged?.Invoke(_settings.safety);
            }
        }

        public void SetContentFilterLevel(ContentFilterLevel level)
        {
            if (_settings.safety.contentFilterLevel != level)
            {
                _settings.safety.contentFilterLevel = level;
                MarkDirty();
                onSafetySettingsChanged?.Invoke(_settings.safety);
            }
        }

        public void SetSafeWord(string safeWord, bool enabled)
        {
            _settings.safety.safeWord = safeWord ?? "";
            _settings.safety.safeWordEnabled = enabled;
            MarkDirty();
            onSafetySettingsChanged?.Invoke(_settings.safety);
        }

        #endregion

        #region Privacy Settings

        public void SetShowOnlineStatus(bool show)
        {
            if (_settings.privacy.showOnlineStatus != show)
            {
                _settings.privacy.showOnlineStatus = show;
                MarkDirty();
                onPrivacySettingsChanged?.Invoke(_settings.privacy);
            }
        }

        public void SetAllowScreenshots(bool allow)
        {
            if (_settings.privacy.allowScreenshots != allow)
            {
                _settings.privacy.allowScreenshots = allow;
                MarkDirty();
                onPrivacySettingsChanged?.Invoke(_settings.privacy);
            }
        }

        #endregion

        #region Haptic Settings

        public void SetHapticEnabled(bool enabled)
        {
            if (_settings.haptic.enabled != enabled)
            {
                _settings.haptic.enabled = enabled;
                MarkDirty();
                onHapticSettingsChanged?.Invoke(_settings.haptic);
            }
        }

        public void SetHapticDevice(string deviceId, string deviceName)
        {
            _settings.haptic.deviceId = deviceId;
            _settings.haptic.deviceName = deviceName;
            MarkDirty();
            onHapticSettingsChanged?.Invoke(_settings.haptic);
        }

        public void SetHapticIntensity(int intensity)
        {
            intensity = Mathf.Clamp(intensity, 0, 100);
            if (_settings.haptic.intensity != intensity)
            {
                _settings.haptic.intensity = intensity;
                MarkDirty();
                onHapticSettingsChanged?.Invoke(_settings.haptic);
            }
        }

        public void SetAllowRemoteHapticControl(bool allow)
        {
            if (_settings.haptic.allowRemoteControl != allow)
            {
                _settings.haptic.allowRemoteControl = allow;
                MarkDirty();
                onHapticSettingsChanged?.Invoke(_settings.haptic);
            }
        }

        #endregion

        #region Apply Settings

        private void ApplySettings()
        {
            ApplyVRSettings();
            ApplyAudioSettings();
        }

        private void ApplyVRSettings()
        {
            // Apply comfort vignette
            // This would interface with your VR locomotion system
            Debug.Log($"Applied VR settings: {_settings.vr.comfortMode}, {_settings.vr.movementType}");
        }

        private void ApplyAudioSettings()
        {
            // Apply audio mixer settings
            // AudioMixer would be referenced here
            Debug.Log($"Applied audio: Voice={_settings.vr.voiceChatVolume}, Music={_settings.vr.musicVolume}, SFX={_settings.vr.sfxVolume}");
        }

        #endregion

        #region Utilities

        private void MarkDirty()
        {
            _isDirty = true;
            _autoSaveTimer = 0f;
        }

        public void ResetToDefaults()
        {
            _settings = new AllLocalSettings();
            MarkDirty();
            ApplySettings();

            onVRSettingsChanged?.Invoke(_settings.vr);
            onSafetySettingsChanged?.Invoke(_settings.safety);
            onPrivacySettingsChanged?.Invoke(_settings.privacy);
            onHapticSettingsChanged?.Invoke(_settings.haptic);
        }

        public string ExportSettings()
        {
            return JsonUtility.ToJson(_settings, true);
        }

        public void ImportSettings(string json)
        {
            try
            {
                var imported = JsonUtility.FromJson<AllLocalSettings>(json);
                if (imported != null)
                {
                    _settings = imported;
                    MarkDirty();
                    ApplySettings();

                    onVRSettingsChanged?.Invoke(_settings.vr);
                    onSafetySettingsChanged?.Invoke(_settings.safety);
                    onPrivacySettingsChanged?.Invoke(_settings.privacy);
                    onHapticSettingsChanged?.Invoke(_settings.haptic);
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to import settings: {e.Message}");
            }
        }

        #endregion
    }
}
