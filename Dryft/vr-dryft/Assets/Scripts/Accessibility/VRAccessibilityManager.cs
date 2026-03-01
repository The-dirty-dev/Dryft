using System;
using System.Collections;
using UnityEngine;
using UnityEngine.Events;

namespace Drift.Accessibility
{
    [Serializable]
    public class AccessibilitySettings
    {
        // Visual
        public bool highContrast = false;
        public ColorBlindMode colorBlindMode = ColorBlindMode.None;
        public float uiScale = 1f;
        public bool largeText = false;
        public bool reduceFlashing = true;

        // Comfort
        public bool comfortVignette = true;
        public float vignetteIntensity = 0.5f;
        public bool snapTurning = true;
        public int snapTurnAngle = 45;
        public bool teleportOnly = false;
        public bool seatedMode = false;

        // Audio
        public bool spatialAudio = true;
        public bool audioDescriptions = false;
        public float masterVolume = 1f;
        public bool subtitles = true;
        public float subtitleSize = 1f;

        // Haptics
        public bool hapticFeedback = true;
        public float hapticIntensity = 1f;
        public bool hapticWarnings = true;

        // Interaction
        public bool oneHandedMode = false;
        public Hand dominantHand = Hand.Right;
        public float interactionDistance = 3f;
        public bool gazeInteraction = false;
        public float gazeTime = 1.5f;
    }

    public enum ColorBlindMode
    {
        None,
        Protanopia,     // Red-blind
        Deuteranopia,   // Green-blind
        Tritanopia,     // Blue-blind
        Achromatopsia   // Total color blindness
    }

    public enum Hand
    {
        Left,
        Right
    }

    public class VRAccessibilityManager : MonoBehaviour
    {
        public static VRAccessibilityManager Instance { get; private set; }

        [Header("Settings")]
        [SerializeField] private AccessibilitySettings settings = new AccessibilitySettings();

        [Header("References")]
        [SerializeField] private Material vignetteMaterial;
        [SerializeField] private AudioSource audioDescriptionSource;
        [SerializeField] private GameObject subtitlePanel;

        [Header("Audio Cues")]
        [SerializeField] private AudioClip uiSelectSound;
        [SerializeField] private AudioClip uiConfirmSound;
        [SerializeField] private AudioClip uiBackSound;
        [SerializeField] private AudioClip errorSound;
        [SerializeField] private AudioClip warningSound;
        [SerializeField] private AudioClip successSound;
        [SerializeField] private AudioClip notificationSound;

        [Header("Events")]
        public UnityEvent<AccessibilitySettings> onSettingsChanged;

        private AudioSource _audioSource;
        private const string SETTINGS_KEY = "drift_vr_accessibility";

        public AccessibilitySettings Settings => settings;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            _audioSource = gameObject.AddComponent<AudioSource>();
            LoadSettings();
        }

        private void Start()
        {
            ApplySettings();
        }

        #region Settings Management

        public void LoadSettings()
        {
            var json = PlayerPrefs.GetString(SETTINGS_KEY, "");
            if (!string.IsNullOrEmpty(json))
            {
                settings = JsonUtility.FromJson<AccessibilitySettings>(json);
            }
        }

        public void SaveSettings()
        {
            var json = JsonUtility.ToJson(settings);
            PlayerPrefs.SetString(SETTINGS_KEY, json);
            PlayerPrefs.Save();
        }

        public void ApplySettings()
        {
            ApplyVisualSettings();
            ApplyComfortSettings();
            ApplyAudioSettings();
            onSettingsChanged?.Invoke(settings);
        }

        public void UpdateSetting<T>(Action<AccessibilitySettings, T> setter, T value)
        {
            setter(settings, value);
            SaveSettings();
            ApplySettings();
        }

        public void ResetToDefaults()
        {
            settings = new AccessibilitySettings();
            SaveSettings();
            ApplySettings();
        }

        #endregion

        #region Visual Accessibility

        private void ApplyVisualSettings()
        {
            // Apply vignette
            if (vignetteMaterial != null)
            {
                vignetteMaterial.SetFloat("_Intensity", settings.comfortVignette ? settings.vignetteIntensity : 0f);
            }

            // Apply color blind filter
            ApplyColorBlindFilter(settings.colorBlindMode);

            // Apply UI scale
            // This would be handled by individual UI components
        }

        private void ApplyColorBlindFilter(ColorBlindMode mode)
        {
            // In a real implementation, you'd apply a post-processing effect
            // or use a color lookup table (LUT) for each color blind mode
            switch (mode)
            {
                case ColorBlindMode.Protanopia:
                    // Apply red-blind correction
                    break;
                case ColorBlindMode.Deuteranopia:
                    // Apply green-blind correction
                    break;
                case ColorBlindMode.Tritanopia:
                    // Apply blue-blind correction
                    break;
                case ColorBlindMode.Achromatopsia:
                    // Apply grayscale
                    break;
                default:
                    // No filter
                    break;
            }
        }

        public Color GetAccessibleColor(Color original)
        {
            if (settings.highContrast)
            {
                // Increase contrast
                float brightness = (original.r + original.g + original.b) / 3f;
                return brightness > 0.5f ? Color.white : Color.black;
            }

            return original;
        }

        public float GetScaledUISize(float baseSize)
        {
            float scale = settings.uiScale;
            if (settings.largeText) scale *= 1.5f;
            return baseSize * scale;
        }

        #endregion

        #region Comfort Settings

        private void ApplyComfortSettings()
        {
            // These settings are typically read by locomotion systems
            Debug.Log($"Comfort settings applied: Snap={settings.snapTurning}, Vignette={settings.comfortVignette}");
        }

        public bool ShouldUseSnapTurning() => settings.snapTurning;
        public int GetSnapTurnAngle() => settings.snapTurnAngle;
        public bool IsTeleportOnly() => settings.teleportOnly;
        public bool IsSeatedMode() => settings.seatedMode;

        public void TriggerComfortVignette(float intensity = 1f)
        {
            if (settings.comfortVignette && vignetteMaterial != null)
            {
                StartCoroutine(FlashVignette(intensity));
            }
        }

        private IEnumerator FlashVignette(float targetIntensity)
        {
            float currentIntensity = vignetteMaterial.GetFloat("_Intensity");
            float flashIntensity = Mathf.Max(currentIntensity, targetIntensity * settings.vignetteIntensity);

            // Flash up
            float elapsed = 0f;
            while (elapsed < 0.1f)
            {
                elapsed += Time.deltaTime;
                vignetteMaterial.SetFloat("_Intensity", Mathf.Lerp(currentIntensity, flashIntensity, elapsed / 0.1f));
                yield return null;
            }

            // Fade back
            elapsed = 0f;
            while (elapsed < 0.2f)
            {
                elapsed += Time.deltaTime;
                vignetteMaterial.SetFloat("_Intensity", Mathf.Lerp(flashIntensity, currentIntensity, elapsed / 0.2f));
                yield return null;
            }

            vignetteMaterial.SetFloat("_Intensity", currentIntensity);
        }

        #endregion

        #region Audio Accessibility

        private void ApplyAudioSettings()
        {
            AudioListener.volume = settings.masterVolume;

            if (subtitlePanel != null)
            {
                subtitlePanel.SetActive(settings.subtitles);
            }
        }

        public void PlayAudioCue(AudioCueType cueType)
        {
            if (_audioSource == null) return;

            AudioClip clip = cueType switch
            {
                AudioCueType.Select => uiSelectSound,
                AudioCueType.Confirm => uiConfirmSound,
                AudioCueType.Back => uiBackSound,
                AudioCueType.Error => errorSound,
                AudioCueType.Warning => warningSound,
                AudioCueType.Success => successSound,
                AudioCueType.Notification => notificationSound,
                _ => null
            };

            if (clip != null)
            {
                _audioSource.PlayOneShot(clip);
            }
        }

        public void PlayAudioDescription(string description)
        {
            if (!settings.audioDescriptions || audioDescriptionSource == null) return;

            // In a real implementation, you'd use text-to-speech
            // or pre-recorded audio descriptions
            Debug.Log($"Audio Description: {description}");
        }

        public void ShowSubtitle(string text, float duration = 3f)
        {
            if (!settings.subtitles) return;
            StartCoroutine(DisplaySubtitle(text, duration));
        }

        private IEnumerator DisplaySubtitle(string text, float duration)
        {
            // This would update a UI text component
            Debug.Log($"Subtitle: {text}");
            yield return new WaitForSeconds(duration);
        }

        #endregion

        #region Haptic Feedback

        public void TriggerHaptic(Hand hand, float intensity, float duration)
        {
            if (!settings.hapticFeedback) return;

            float adjustedIntensity = intensity * settings.hapticIntensity;

            // Get the appropriate controller and trigger haptics
            var device = hand == Hand.Left
                ? UnityEngine.XR.XRNode.LeftHand
                : UnityEngine.XR.XRNode.RightHand;

            // In a real implementation, you'd use the XR input system
            Debug.Log($"Haptic: {hand}, intensity={adjustedIntensity}, duration={duration}");
        }

        public void TriggerWarningHaptic()
        {
            if (!settings.hapticWarnings) return;

            TriggerHaptic(Hand.Left, 1f, 0.3f);
            TriggerHaptic(Hand.Right, 1f, 0.3f);
            PlayAudioCue(AudioCueType.Warning);
        }

        #endregion

        #region Interaction Accessibility

        public Hand GetDominantHand() => settings.dominantHand;

        public bool IsOneHandedMode() => settings.oneHandedMode;

        public float GetInteractionDistance() => settings.interactionDistance;

        public bool UseGazeInteraction() => settings.gazeInteraction;

        public float GetGazeTime() => settings.gazeTime;

        #endregion
    }

    public enum AudioCueType
    {
        Select,
        Confirm,
        Back,
        Error,
        Warning,
        Success,
        Notification
    }
}
