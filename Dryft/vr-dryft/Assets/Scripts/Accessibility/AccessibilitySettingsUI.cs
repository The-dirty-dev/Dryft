using System;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace Drift.Accessibility
{
    /// <summary>
    /// UI controller for VR accessibility settings panel.
    /// </summary>
    public class AccessibilitySettingsUI : MonoBehaviour
    {
        [Header("Visual Settings")]
        [SerializeField] private Toggle highContrastToggle;
        [SerializeField] private TMP_Dropdown colorBlindModeDropdown;
        [SerializeField] private Slider uiScaleSlider;
        [SerializeField] private TMP_Text uiScaleValue;
        [SerializeField] private Toggle largeTextToggle;
        [SerializeField] private Toggle reduceFlashingToggle;

        [Header("Comfort Settings")]
        [SerializeField] private Toggle comfortVignetteToggle;
        [SerializeField] private Slider vignetteIntensitySlider;
        [SerializeField] private TMP_Text vignetteIntensityValue;
        [SerializeField] private Toggle snapTurningToggle;
        [SerializeField] private TMP_Dropdown snapAngleDropdown;
        [SerializeField] private Toggle teleportOnlyToggle;
        [SerializeField] private Toggle seatedModeToggle;

        [Header("Audio Settings")]
        [SerializeField] private Toggle spatialAudioToggle;
        [SerializeField] private Toggle audioDescriptionsToggle;
        [SerializeField] private Slider masterVolumeSlider;
        [SerializeField] private TMP_Text masterVolumeValue;
        [SerializeField] private Toggle subtitlesToggle;
        [SerializeField] private Slider subtitleSizeSlider;
        [SerializeField] private TMP_Text subtitleSizeValue;

        [Header("Haptics Settings")]
        [SerializeField] private Toggle hapticFeedbackToggle;
        [SerializeField] private Slider hapticIntensitySlider;
        [SerializeField] private TMP_Text hapticIntensityValue;
        [SerializeField] private Toggle hapticWarningsToggle;

        [Header("Interaction Settings")]
        [SerializeField] private Toggle oneHandedModeToggle;
        [SerializeField] private TMP_Dropdown dominantHandDropdown;
        [SerializeField] private Slider interactionDistanceSlider;
        [SerializeField] private TMP_Text interactionDistanceValue;
        [SerializeField] private Toggle gazeInteractionToggle;
        [SerializeField] private Slider gazeTimeSlider;
        [SerializeField] private TMP_Text gazeTimeValue;

        [Header("Buttons")]
        [SerializeField] private Button resetButton;
        [SerializeField] private Button saveButton;
        [SerializeField] private Button closeButton;

        [Header("References")]
        [SerializeField] private ColorBlindPostProcess colorBlindEffect;

        private bool _isInitializing;

        private void Start()
        {
            SetupDropdowns();
            SetupEventListeners();
            LoadSettings();
        }

        private void SetupDropdowns()
        {
            // Color blind mode dropdown
            if (colorBlindModeDropdown != null)
            {
                colorBlindModeDropdown.ClearOptions();
                colorBlindModeDropdown.AddOptions(new System.Collections.Generic.List<string>
                {
                    "None",
                    "Protanopia (Red-blind)",
                    "Deuteranopia (Green-blind)",
                    "Tritanopia (Blue-blind)",
                    "Achromatopsia (Grayscale)"
                });
            }

            // Snap angle dropdown
            if (snapAngleDropdown != null)
            {
                snapAngleDropdown.ClearOptions();
                snapAngleDropdown.AddOptions(new System.Collections.Generic.List<string>
                {
                    "15°", "30°", "45°", "60°", "90°"
                });
            }

            // Dominant hand dropdown
            if (dominantHandDropdown != null)
            {
                dominantHandDropdown.ClearOptions();
                dominantHandDropdown.AddOptions(new System.Collections.Generic.List<string>
                {
                    "Left", "Right"
                });
            }
        }

        private void SetupEventListeners()
        {
            // Visual
            highContrastToggle?.onValueChanged.AddListener(OnHighContrastChanged);
            colorBlindModeDropdown?.onValueChanged.AddListener(OnColorBlindModeChanged);
            uiScaleSlider?.onValueChanged.AddListener(OnUIScaleChanged);
            largeTextToggle?.onValueChanged.AddListener(OnLargeTextChanged);
            reduceFlashingToggle?.onValueChanged.AddListener(OnReduceFlashingChanged);

            // Comfort
            comfortVignetteToggle?.onValueChanged.AddListener(OnComfortVignetteChanged);
            vignetteIntensitySlider?.onValueChanged.AddListener(OnVignetteIntensityChanged);
            snapTurningToggle?.onValueChanged.AddListener(OnSnapTurningChanged);
            snapAngleDropdown?.onValueChanged.AddListener(OnSnapAngleChanged);
            teleportOnlyToggle?.onValueChanged.AddListener(OnTeleportOnlyChanged);
            seatedModeToggle?.onValueChanged.AddListener(OnSeatedModeChanged);

            // Audio
            spatialAudioToggle?.onValueChanged.AddListener(OnSpatialAudioChanged);
            audioDescriptionsToggle?.onValueChanged.AddListener(OnAudioDescriptionsChanged);
            masterVolumeSlider?.onValueChanged.AddListener(OnMasterVolumeChanged);
            subtitlesToggle?.onValueChanged.AddListener(OnSubtitlesChanged);
            subtitleSizeSlider?.onValueChanged.AddListener(OnSubtitleSizeChanged);

            // Haptics
            hapticFeedbackToggle?.onValueChanged.AddListener(OnHapticFeedbackChanged);
            hapticIntensitySlider?.onValueChanged.AddListener(OnHapticIntensityChanged);
            hapticWarningsToggle?.onValueChanged.AddListener(OnHapticWarningsChanged);

            // Interaction
            oneHandedModeToggle?.onValueChanged.AddListener(OnOneHandedModeChanged);
            dominantHandDropdown?.onValueChanged.AddListener(OnDominantHandChanged);
            interactionDistanceSlider?.onValueChanged.AddListener(OnInteractionDistanceChanged);
            gazeInteractionToggle?.onValueChanged.AddListener(OnGazeInteractionChanged);
            gazeTimeSlider?.onValueChanged.AddListener(OnGazeTimeChanged);

            // Buttons
            resetButton?.onClick.AddListener(OnResetClicked);
            saveButton?.onClick.AddListener(OnSaveClicked);
            closeButton?.onClick.AddListener(OnCloseClicked);
        }

        private void LoadSettings()
        {
            if (VRAccessibilityManager.Instance == null) return;

            _isInitializing = true;

            var settings = VRAccessibilityManager.Instance.Settings;

            // Visual
            if (highContrastToggle != null) highContrastToggle.isOn = settings.highContrast;
            if (colorBlindModeDropdown != null) colorBlindModeDropdown.value = (int)settings.colorBlindMode;
            if (uiScaleSlider != null) uiScaleSlider.value = settings.uiScale;
            if (largeTextToggle != null) largeTextToggle.isOn = settings.largeText;
            if (reduceFlashingToggle != null) reduceFlashingToggle.isOn = settings.reduceFlashing;

            // Comfort
            if (comfortVignetteToggle != null) comfortVignetteToggle.isOn = settings.comfortVignette;
            if (vignetteIntensitySlider != null) vignetteIntensitySlider.value = settings.vignetteIntensity;
            if (snapTurningToggle != null) snapTurningToggle.isOn = settings.snapTurning;
            if (snapAngleDropdown != null) snapAngleDropdown.value = GetSnapAngleIndex(settings.snapTurnAngle);
            if (teleportOnlyToggle != null) teleportOnlyToggle.isOn = settings.teleportOnly;
            if (seatedModeToggle != null) seatedModeToggle.isOn = settings.seatedMode;

            // Audio
            if (spatialAudioToggle != null) spatialAudioToggle.isOn = settings.spatialAudio;
            if (audioDescriptionsToggle != null) audioDescriptionsToggle.isOn = settings.audioDescriptions;
            if (masterVolumeSlider != null) masterVolumeSlider.value = settings.masterVolume;
            if (subtitlesToggle != null) subtitlesToggle.isOn = settings.subtitles;
            if (subtitleSizeSlider != null) subtitleSizeSlider.value = settings.subtitleSize;

            // Haptics
            if (hapticFeedbackToggle != null) hapticFeedbackToggle.isOn = settings.hapticFeedback;
            if (hapticIntensitySlider != null) hapticIntensitySlider.value = settings.hapticIntensity;
            if (hapticWarningsToggle != null) hapticWarningsToggle.isOn = settings.hapticWarnings;

            // Interaction
            if (oneHandedModeToggle != null) oneHandedModeToggle.isOn = settings.oneHandedMode;
            if (dominantHandDropdown != null) dominantHandDropdown.value = (int)settings.dominantHand;
            if (interactionDistanceSlider != null) interactionDistanceSlider.value = settings.interactionDistance;
            if (gazeInteractionToggle != null) gazeInteractionToggle.isOn = settings.gazeInteraction;
            if (gazeTimeSlider != null) gazeTimeSlider.value = settings.gazeTime;

            // Update value labels
            UpdateValueLabels(settings);

            _isInitializing = false;
        }

        private void UpdateValueLabels(AccessibilitySettings settings)
        {
            if (uiScaleValue != null) uiScaleValue.text = $"{settings.uiScale:F1}x";
            if (vignetteIntensityValue != null) vignetteIntensityValue.text = $"{(int)(settings.vignetteIntensity * 100)}%";
            if (masterVolumeValue != null) masterVolumeValue.text = $"{(int)(settings.masterVolume * 100)}%";
            if (subtitleSizeValue != null) subtitleSizeValue.text = $"{settings.subtitleSize:F1}x";
            if (hapticIntensityValue != null) hapticIntensityValue.text = $"{(int)(settings.hapticIntensity * 100)}%";
            if (interactionDistanceValue != null) interactionDistanceValue.text = $"{settings.interactionDistance:F1}m";
            if (gazeTimeValue != null) gazeTimeValue.text = $"{settings.gazeTime:F1}s";
        }

        private int GetSnapAngleIndex(int angle)
        {
            return angle switch
            {
                15 => 0,
                30 => 1,
                45 => 2,
                60 => 3,
                90 => 4,
                _ => 2 // Default to 45
            };
        }

        private int GetSnapAngleFromIndex(int index)
        {
            return index switch
            {
                0 => 15,
                1 => 30,
                2 => 45,
                3 => 60,
                4 => 90,
                _ => 45
            };
        }

        #region Event Handlers

        private void OnHighContrastChanged(bool value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.highContrast = v, value);
            VRAccessibilityManager.Instance?.PlayAudioCue(AudioCueType.Select);
        }

        private void OnColorBlindModeChanged(int value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.colorBlindMode = (ColorBlindMode)v, value);

            // Update post-process effect directly
            if (colorBlindEffect != null)
            {
                colorBlindEffect.Mode = (ColorBlindMode)value;
            }

            VRAccessibilityManager.Instance?.PlayAudioCue(AudioCueType.Select);
        }

        private void OnUIScaleChanged(float value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.uiScale = v, value);
            if (uiScaleValue != null) uiScaleValue.text = $"{value:F1}x";
        }

        private void OnLargeTextChanged(bool value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.largeText = v, value);
        }

        private void OnReduceFlashingChanged(bool value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.reduceFlashing = v, value);
        }

        private void OnComfortVignetteChanged(bool value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.comfortVignette = v, value);
        }

        private void OnVignetteIntensityChanged(float value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.vignetteIntensity = v, value);
            if (vignetteIntensityValue != null) vignetteIntensityValue.text = $"{(int)(value * 100)}%";
        }

        private void OnSnapTurningChanged(bool value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.snapTurning = v, value);
        }

        private void OnSnapAngleChanged(int value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.snapTurnAngle = GetSnapAngleFromIndex(v), value);
        }

        private void OnTeleportOnlyChanged(bool value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.teleportOnly = v, value);
        }

        private void OnSeatedModeChanged(bool value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.seatedMode = v, value);
        }

        private void OnSpatialAudioChanged(bool value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.spatialAudio = v, value);
        }

        private void OnAudioDescriptionsChanged(bool value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.audioDescriptions = v, value);
        }

        private void OnMasterVolumeChanged(float value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.masterVolume = v, value);
            if (masterVolumeValue != null) masterVolumeValue.text = $"{(int)(value * 100)}%";
        }

        private void OnSubtitlesChanged(bool value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.subtitles = v, value);
        }

        private void OnSubtitleSizeChanged(float value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.subtitleSize = v, value);
            if (subtitleSizeValue != null) subtitleSizeValue.text = $"{value:F1}x";
        }

        private void OnHapticFeedbackChanged(bool value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.hapticFeedback = v, value);
        }

        private void OnHapticIntensityChanged(float value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.hapticIntensity = v, value);
            if (hapticIntensityValue != null) hapticIntensityValue.text = $"{(int)(value * 100)}%";

            // Test haptic at new intensity
            if (!_isInitializing && value > 0)
            {
                VRAccessibilityManager.Instance?.TriggerHaptic(Hand.Right, 0.5f, 0.1f);
            }
        }

        private void OnHapticWarningsChanged(bool value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.hapticWarnings = v, value);
        }

        private void OnOneHandedModeChanged(bool value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.oneHandedMode = v, value);
        }

        private void OnDominantHandChanged(int value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.dominantHand = (Hand)v, value);
        }

        private void OnInteractionDistanceChanged(float value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.interactionDistance = v, value);
            if (interactionDistanceValue != null) interactionDistanceValue.text = $"{value:F1}m";
        }

        private void OnGazeInteractionChanged(bool value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.gazeInteraction = v, value);
        }

        private void OnGazeTimeChanged(float value)
        {
            if (_isInitializing) return;
            UpdateSetting((s, v) => s.gazeTime = v, value);
            if (gazeTimeValue != null) gazeTimeValue.text = $"{value:F1}s";
        }

        private void OnResetClicked()
        {
            VRAccessibilityManager.Instance?.ResetToDefaults();
            VRAccessibilityManager.Instance?.PlayAudioCue(AudioCueType.Confirm);
            LoadSettings();
        }

        private void OnSaveClicked()
        {
            VRAccessibilityManager.Instance?.SaveSettings();
            VRAccessibilityManager.Instance?.PlayAudioCue(AudioCueType.Success);
        }

        private void OnCloseClicked()
        {
            VRAccessibilityManager.Instance?.PlayAudioCue(AudioCueType.Back);
            gameObject.SetActive(false);
        }

        #endregion

        private void UpdateSetting<T>(Action<AccessibilitySettings, T> setter, T value)
        {
            if (VRAccessibilityManager.Instance != null)
            {
                VRAccessibilityManager.Instance.UpdateSetting(setter, value);
            }
        }
    }
}
