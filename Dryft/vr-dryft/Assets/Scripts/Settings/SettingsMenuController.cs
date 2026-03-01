using System;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace Drift.Settings
{
    public class SettingsMenuController : MonoBehaviour
    {
        [Header("Tabs")]
        [SerializeField] private Button vrTabButton;
        [SerializeField] private Button audioTabButton;
        [SerializeField] private Button safetyTabButton;
        [SerializeField] private Button privacyTabButton;

        [SerializeField] private GameObject vrPanel;
        [SerializeField] private GameObject audioPanel;
        [SerializeField] private GameObject safetyPanel;
        [SerializeField] private GameObject privacyPanel;

        [Header("VR Settings")]
        [SerializeField] private TMP_Dropdown comfortModeDropdown;
        [SerializeField] private TMP_Dropdown movementTypeDropdown;
        [SerializeField] private TMP_Dropdown turnTypeDropdown;
        [SerializeField] private Slider snapTurnAngleSlider;
        [SerializeField] private TextMeshProUGUI snapTurnAngleText;
        [SerializeField] private Slider smoothTurnSpeedSlider;
        [SerializeField] private TextMeshProUGUI smoothTurnSpeedText;
        [SerializeField] private TMP_Dropdown handednessDropdown;
        [SerializeField] private Toggle vignetteToggle;
        [SerializeField] private Button calibrateHeightButton;

        [Header("Audio Settings")]
        [SerializeField] private Slider voiceChatVolumeSlider;
        [SerializeField] private TextMeshProUGUI voiceChatVolumeText;
        [SerializeField] private Slider musicVolumeSlider;
        [SerializeField] private TextMeshProUGUI musicVolumeText;
        [SerializeField] private Slider sfxVolumeSlider;
        [SerializeField] private TextMeshProUGUI sfxVolumeText;
        [SerializeField] private Toggle spatialAudioToggle;

        [Header("Safety Settings")]
        [SerializeField] private Toggle panicButtonToggle;
        [SerializeField] private Toggle panicVibrationToggle;
        [SerializeField] private Toggle autoBlockToggle;
        [SerializeField] private TMP_Dropdown contentFilterDropdown;
        [SerializeField] private Toggle safeWordToggle;
        [SerializeField] private TMP_InputField safeWordInput;

        [Header("Privacy Settings")]
        [SerializeField] private Toggle showOnlineStatusToggle;
        [SerializeField] private Toggle showLastActiveToggle;
        [SerializeField] private Toggle allowScreenshotsToggle;

        [Header("Actions")]
        [SerializeField] private Button resetButton;
        [SerializeField] private Button closeButton;

        private bool _isInitialized;

        private void Start()
        {
            SetupTabs();
            SetupVRControls();
            SetupAudioControls();
            SetupSafetyControls();
            SetupPrivacyControls();
            SetupActionButtons();

            LoadCurrentSettings();
            _isInitialized = true;

            ShowTab(vrPanel);
        }

        private void SetupTabs()
        {
            vrTabButton?.onClick.AddListener(() => ShowTab(vrPanel));
            audioTabButton?.onClick.AddListener(() => ShowTab(audioPanel));
            safetyTabButton?.onClick.AddListener(() => ShowTab(safetyPanel));
            privacyTabButton?.onClick.AddListener(() => ShowTab(privacyPanel));
        }

        private void ShowTab(GameObject panel)
        {
            vrPanel?.SetActive(panel == vrPanel);
            audioPanel?.SetActive(panel == audioPanel);
            safetyPanel?.SetActive(panel == safetyPanel);
            privacyPanel?.SetActive(panel == privacyPanel);

            // Update tab button states
            UpdateTabButtonState(vrTabButton, panel == vrPanel);
            UpdateTabButtonState(audioTabButton, panel == audioPanel);
            UpdateTabButtonState(safetyTabButton, panel == safetyPanel);
            UpdateTabButtonState(privacyTabButton, panel == privacyPanel);
        }

        private void UpdateTabButtonState(Button button, bool isActive)
        {
            if (button == null) return;

            var colors = button.colors;
            colors.normalColor = isActive ? new Color(0.91f, 0.27f, 0.38f, 1f) : new Color(1f, 1f, 1f, 0.1f);
            button.colors = colors;
        }

        #region VR Setup

        private void SetupVRControls()
        {
            // Comfort Mode
            if (comfortModeDropdown != null)
            {
                comfortModeDropdown.ClearOptions();
                comfortModeDropdown.AddOptions(new System.Collections.Generic.List<string> { "Comfortable", "Moderate", "Intense" });
                comfortModeDropdown.onValueChanged.AddListener(OnComfortModeChanged);
            }

            // Movement Type
            if (movementTypeDropdown != null)
            {
                movementTypeDropdown.ClearOptions();
                movementTypeDropdown.AddOptions(new System.Collections.Generic.List<string> { "Teleport", "Smooth", "Hybrid" });
                movementTypeDropdown.onValueChanged.AddListener(OnMovementTypeChanged);
            }

            // Turn Type
            if (turnTypeDropdown != null)
            {
                turnTypeDropdown.ClearOptions();
                turnTypeDropdown.AddOptions(new System.Collections.Generic.List<string> { "Snap Turn", "Smooth Turn" });
                turnTypeDropdown.onValueChanged.AddListener(OnTurnTypeChanged);
            }

            // Snap Turn Angle
            if (snapTurnAngleSlider != null)
            {
                snapTurnAngleSlider.minValue = 15;
                snapTurnAngleSlider.maxValue = 90;
                snapTurnAngleSlider.wholeNumbers = true;
                snapTurnAngleSlider.onValueChanged.AddListener(OnSnapTurnAngleChanged);
            }

            // Smooth Turn Speed
            if (smoothTurnSpeedSlider != null)
            {
                smoothTurnSpeedSlider.minValue = 30;
                smoothTurnSpeedSlider.maxValue = 180;
                smoothTurnSpeedSlider.onValueChanged.AddListener(OnSmoothTurnSpeedChanged);
            }

            // Handedness
            if (handednessDropdown != null)
            {
                handednessDropdown.ClearOptions();
                handednessDropdown.AddOptions(new System.Collections.Generic.List<string> { "Right-handed", "Left-handed" });
                handednessDropdown.onValueChanged.AddListener(OnHandednessChanged);
            }

            // Vignette
            vignetteToggle?.onValueChanged.AddListener(OnVignetteChanged);

            // Calibrate Height
            calibrateHeightButton?.onClick.AddListener(OnCalibrateHeight);
        }

        private void OnComfortModeChanged(int value)
        {
            if (!_isInitialized) return;
            SettingsManager.Instance?.SetComfortMode((ComfortMode)value);
        }

        private void OnMovementTypeChanged(int value)
        {
            if (!_isInitialized) return;
            SettingsManager.Instance?.SetMovementType((MovementType)value);
        }

        private void OnTurnTypeChanged(int value)
        {
            if (!_isInitialized) return;
            SettingsManager.Instance?.SetTurnType((TurnType)value);
            UpdateTurnSettingsVisibility();
        }

        private void OnSnapTurnAngleChanged(float value)
        {
            if (!_isInitialized) return;
            int angle = Mathf.RoundToInt(value);
            SettingsManager.Instance?.SetSnapTurnAngle(angle);
            if (snapTurnAngleText != null)
            {
                snapTurnAngleText.text = $"{angle}°";
            }
        }

        private void OnSmoothTurnSpeedChanged(float value)
        {
            if (!_isInitialized) return;
            SettingsManager.Instance?.SetSmoothTurnSpeed(value);
            if (smoothTurnSpeedText != null)
            {
                smoothTurnSpeedText.text = $"{Mathf.RoundToInt(value)}°/s";
            }
        }

        private void OnHandednessChanged(int value)
        {
            if (!_isInitialized) return;
            SettingsManager.Instance?.SetHandedness((Handedness)value);
        }

        private void OnVignetteChanged(bool value)
        {
            if (!_isInitialized) return;
            SettingsManager.Instance?.SetShowVignette(value);
        }

        private void OnCalibrateHeight()
        {
            // Get current head height and save it
            var camera = Camera.main;
            if (camera != null)
            {
                float height = camera.transform.localPosition.y;
                SettingsManager.Instance?.SetHeightCalibration(height);
            }
        }

        private void UpdateTurnSettingsVisibility()
        {
            bool isSnapTurn = turnTypeDropdown != null && turnTypeDropdown.value == 0;
            snapTurnAngleSlider?.gameObject.SetActive(isSnapTurn);
            smoothTurnSpeedSlider?.gameObject.SetActive(!isSnapTurn);
        }

        #endregion

        #region Audio Setup

        private void SetupAudioControls()
        {
            // Voice Chat Volume
            if (voiceChatVolumeSlider != null)
            {
                voiceChatVolumeSlider.minValue = 0;
                voiceChatVolumeSlider.maxValue = 100;
                voiceChatVolumeSlider.wholeNumbers = true;
                voiceChatVolumeSlider.onValueChanged.AddListener(OnVoiceChatVolumeChanged);
            }

            // Music Volume
            if (musicVolumeSlider != null)
            {
                musicVolumeSlider.minValue = 0;
                musicVolumeSlider.maxValue = 100;
                musicVolumeSlider.wholeNumbers = true;
                musicVolumeSlider.onValueChanged.AddListener(OnMusicVolumeChanged);
            }

            // SFX Volume
            if (sfxVolumeSlider != null)
            {
                sfxVolumeSlider.minValue = 0;
                sfxVolumeSlider.maxValue = 100;
                sfxVolumeSlider.wholeNumbers = true;
                sfxVolumeSlider.onValueChanged.AddListener(OnSFXVolumeChanged);
            }

            // Spatial Audio
            spatialAudioToggle?.onValueChanged.AddListener(OnSpatialAudioChanged);
        }

        private void OnVoiceChatVolumeChanged(float value)
        {
            if (!_isInitialized) return;
            int volume = Mathf.RoundToInt(value);
            SettingsManager.Instance?.SetVoiceChatVolume(volume);
            if (voiceChatVolumeText != null)
            {
                voiceChatVolumeText.text = $"{volume}%";
            }
        }

        private void OnMusicVolumeChanged(float value)
        {
            if (!_isInitialized) return;
            int volume = Mathf.RoundToInt(value);
            SettingsManager.Instance?.SetMusicVolume(volume);
            if (musicVolumeText != null)
            {
                musicVolumeText.text = $"{volume}%";
            }
        }

        private void OnSFXVolumeChanged(float value)
        {
            if (!_isInitialized) return;
            int volume = Mathf.RoundToInt(value);
            SettingsManager.Instance?.SetSFXVolume(volume);
            if (sfxVolumeText != null)
            {
                sfxVolumeText.text = $"{volume}%";
            }
        }

        private void OnSpatialAudioChanged(bool value)
        {
            if (!_isInitialized) return;
            SettingsManager.Instance?.SetSpatialAudio(value);
        }

        #endregion

        #region Safety Setup

        private void SetupSafetyControls()
        {
            panicButtonToggle?.onValueChanged.AddListener(OnPanicButtonChanged);
            panicVibrationToggle?.onValueChanged.AddListener(OnPanicVibrationChanged);
            autoBlockToggle?.onValueChanged.AddListener(OnAutoBlockChanged);

            if (contentFilterDropdown != null)
            {
                contentFilterDropdown.ClearOptions();
                contentFilterDropdown.AddOptions(new System.Collections.Generic.List<string> { "Strict", "Moderate", "Relaxed" });
                contentFilterDropdown.onValueChanged.AddListener(OnContentFilterChanged);
            }

            safeWordToggle?.onValueChanged.AddListener(OnSafeWordToggleChanged);
            safeWordInput?.onEndEdit.AddListener(OnSafeWordChanged);
        }

        private void OnPanicButtonChanged(bool value)
        {
            if (!_isInitialized) return;
            SettingsManager.Instance?.SetPanicButtonEnabled(value);
        }

        private void OnPanicVibrationChanged(bool value)
        {
            if (!_isInitialized) return;
            SettingsManager.Instance?.SetPanicButtonVibration(value);
        }

        private void OnAutoBlockChanged(bool value)
        {
            if (!_isInitialized) return;
            SettingsManager.Instance?.SetAutoBlockOnReport(value);
        }

        private void OnContentFilterChanged(int value)
        {
            if (!_isInitialized) return;
            SettingsManager.Instance?.SetContentFilterLevel((ContentFilterLevel)value);
        }

        private void OnSafeWordToggleChanged(bool value)
        {
            if (!_isInitialized) return;
            safeWordInput?.gameObject.SetActive(value);
            SettingsManager.Instance?.SetSafeWord(safeWordInput?.text ?? "", value);
        }

        private void OnSafeWordChanged(string value)
        {
            if (!_isInitialized) return;
            SettingsManager.Instance?.SetSafeWord(value, safeWordToggle?.isOn ?? false);
        }

        #endregion

        #region Privacy Setup

        private void SetupPrivacyControls()
        {
            showOnlineStatusToggle?.onValueChanged.AddListener(OnShowOnlineStatusChanged);
            showLastActiveToggle?.onValueChanged.AddListener(OnShowLastActiveChanged);
            allowScreenshotsToggle?.onValueChanged.AddListener(OnAllowScreenshotsChanged);
        }

        private void OnShowOnlineStatusChanged(bool value)
        {
            if (!_isInitialized) return;
            SettingsManager.Instance?.SetShowOnlineStatus(value);
        }

        private void OnShowLastActiveChanged(bool value)
        {
            if (!_isInitialized) return;
            // Would need to add this to SettingsManager if needed
        }

        private void OnAllowScreenshotsChanged(bool value)
        {
            if (!_isInitialized) return;
            SettingsManager.Instance?.SetAllowScreenshots(value);
        }

        #endregion

        #region Action Buttons

        private void SetupActionButtons()
        {
            resetButton?.onClick.AddListener(OnResetClicked);
            closeButton?.onClick.AddListener(OnCloseClicked);
        }

        private void OnResetClicked()
        {
            SettingsManager.Instance?.ResetToDefaults();
            LoadCurrentSettings();
        }

        private void OnCloseClicked()
        {
            SettingsManager.Instance?.SaveSettings();
            gameObject.SetActive(false);
        }

        #endregion

        #region Load Settings

        private void LoadCurrentSettings()
        {
            if (SettingsManager.Instance == null) return;

            var vr = SettingsManager.Instance.VR;
            var safety = SettingsManager.Instance.Safety;
            var privacy = SettingsManager.Instance.Privacy;

            // VR Settings
            if (comfortModeDropdown != null) comfortModeDropdown.value = (int)vr.comfortMode;
            if (movementTypeDropdown != null) movementTypeDropdown.value = (int)vr.movementType;
            if (turnTypeDropdown != null) turnTypeDropdown.value = (int)vr.turnType;
            if (snapTurnAngleSlider != null) snapTurnAngleSlider.value = vr.snapTurnAngle;
            if (snapTurnAngleText != null) snapTurnAngleText.text = $"{vr.snapTurnAngle}°";
            if (smoothTurnSpeedSlider != null) smoothTurnSpeedSlider.value = vr.smoothTurnSpeed;
            if (smoothTurnSpeedText != null) smoothTurnSpeedText.text = $"{Mathf.RoundToInt(vr.smoothTurnSpeed)}°/s";
            if (handednessDropdown != null) handednessDropdown.value = (int)vr.handedness;
            if (vignetteToggle != null) vignetteToggle.isOn = vr.showVignette;

            // Audio Settings
            if (voiceChatVolumeSlider != null) voiceChatVolumeSlider.value = vr.voiceChatVolume;
            if (voiceChatVolumeText != null) voiceChatVolumeText.text = $"{vr.voiceChatVolume}%";
            if (musicVolumeSlider != null) musicVolumeSlider.value = vr.musicVolume;
            if (musicVolumeText != null) musicVolumeText.text = $"{vr.musicVolume}%";
            if (sfxVolumeSlider != null) sfxVolumeSlider.value = vr.sfxVolume;
            if (sfxVolumeText != null) sfxVolumeText.text = $"{vr.sfxVolume}%";
            if (spatialAudioToggle != null) spatialAudioToggle.isOn = vr.spatialAudio;

            // Safety Settings
            if (panicButtonToggle != null) panicButtonToggle.isOn = safety.panicButtonEnabled;
            if (panicVibrationToggle != null) panicVibrationToggle.isOn = safety.panicButtonVibration;
            if (autoBlockToggle != null) autoBlockToggle.isOn = safety.autoBlockOnReport;
            if (contentFilterDropdown != null) contentFilterDropdown.value = (int)safety.contentFilterLevel;
            if (safeWordToggle != null) safeWordToggle.isOn = safety.safeWordEnabled;
            if (safeWordInput != null)
            {
                safeWordInput.text = safety.safeWord;
                safeWordInput.gameObject.SetActive(safety.safeWordEnabled);
            }

            // Privacy Settings
            if (showOnlineStatusToggle != null) showOnlineStatusToggle.isOn = privacy.showOnlineStatus;
            if (showLastActiveToggle != null) showLastActiveToggle.isOn = privacy.showLastActive;
            if (allowScreenshotsToggle != null) allowScreenshotsToggle.isOn = privacy.allowScreenshots;

            UpdateTurnSettingsVisibility();
        }

        #endregion
    }
}
