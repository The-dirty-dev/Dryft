using UnityEngine;
using UnityEngine.UI;
using TMPro;
using Drift.Core;
using Drift.Haptics;
using Drift.Environment;

namespace Drift.UI
{
    /// <summary>
    /// Controls the in-VR heads-up display.
    ///
    /// HUD elements are displayed on a world-space canvas that follows
    /// the player's view, providing non-intrusive information.
    /// </summary>
    public class HUDController : MonoBehaviour
    {
        public static HUDController Instance { get; private set; }

        [Header("HUD Canvas")]
        [SerializeField] private Canvas _hudCanvas;
        [SerializeField] private float _hudDistance = 2f;
        [SerializeField] private float _hudVerticalOffset = -0.5f;

        [Header("Status Indicators")]
        [SerializeField] private Image _connectionIndicator;
        [SerializeField] private Image _hapticIndicator;
        [SerializeField] private TMP_Text _partnerNameText;
        [SerializeField] private TMP_Text _roomNameText;

        [Header("Haptic Feedback Visual")]
        [SerializeField] private Image _hapticPulseRing;
        [SerializeField] private float _pulseExpandSpeed = 5f;
        [SerializeField] private float _pulseMaxScale = 1.5f;

        [Header("Notification")]
        [SerializeField] private GameObject _notificationPanel;
        [SerializeField] private TMP_Text _notificationText;
        [SerializeField] private float _notificationDuration = 3f;

        [Header("Interaction Prompt")]
        [SerializeField] private GameObject _interactionPromptPanel;
        [SerializeField] private TMP_Text _interactionPromptText;

        [Header("Quick Actions")]
        [SerializeField] private Button _exitButton;
        [SerializeField] private Button _muteButton;
        [SerializeField] private Button _hapticPatternButton;

        [Header("Colors")]
        [SerializeField] private Color _connectedColor = Color.green;
        [SerializeField] private Color _disconnectedColor = Color.red;
        [SerializeField] private Color _hapticActiveColor = Color.magenta;
        [SerializeField] private Color _hapticInactiveColor = Color.gray;

        // State
        private Transform _playerCamera;
        private float _currentPulseScale = 1f;
        private bool _isPulsing;
        private float _notificationTimer;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        private void Start()
        {
            // Find player camera
            var player = Player.PlayerController.Instance;
            if (player != null)
            {
                _playerCamera = player.transform.Find("TrackingSpace/CenterEyeAnchor");
            }

            // Subscribe to events
            if (HapticController.Instance != null)
            {
                HapticController.Instance.OnIntensityChanged += OnHapticIntensityChanged;
            }

            if (DriftRealtime.Instance != null)
            {
                DriftRealtime.Instance.OnConnected += OnConnected;
                DriftRealtime.Instance.OnDisconnected += OnDisconnected;
            }

            SetupButtons();
            HideNotification();
            UpdateConnectionStatus(false);
        }

        private void Update()
        {
            UpdateHUDPosition();
            UpdatePulseRing();
            UpdateNotificationTimer();
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;

            if (HapticController.Instance != null)
            {
                HapticController.Instance.OnIntensityChanged -= OnHapticIntensityChanged;
            }
        }

        private void SetupButtons()
        {
            if (_exitButton != null)
            {
                _exitButton.onClick.AddListener(OnExitClicked);
            }

            if (_muteButton != null)
            {
                _muteButton.onClick.AddListener(OnMuteClicked);
            }

            if (_hapticPatternButton != null)
            {
                _hapticPatternButton.onClick.AddListener(OnHapticPatternClicked);
            }
        }

        private void UpdateHUDPosition()
        {
            if (_playerCamera == null || _hudCanvas == null) return;

            // Position HUD in front of and below the player's view
            Vector3 forward = _playerCamera.forward;
            Vector3 targetPos = _playerCamera.position + forward * _hudDistance;
            targetPos.y += _hudVerticalOffset;

            _hudCanvas.transform.position = Vector3.Lerp(
                _hudCanvas.transform.position,
                targetPos,
                Time.deltaTime * 10f
            );

            // Face the player
            _hudCanvas.transform.LookAt(_playerCamera);
            _hudCanvas.transform.Rotate(0, 180, 0);
        }

        private void UpdatePulseRing()
        {
            if (_hapticPulseRing == null) return;

            if (_isPulsing)
            {
                // Expand ring
                _currentPulseScale += Time.deltaTime * _pulseExpandSpeed;

                if (_currentPulseScale >= _pulseMaxScale)
                {
                    _currentPulseScale = 1f;
                }

                _hapticPulseRing.transform.localScale = Vector3.one * _currentPulseScale;

                // Fade out as it expands
                float alpha = 1f - ((_currentPulseScale - 1f) / (_pulseMaxScale - 1f));
                Color c = _hapticPulseRing.color;
                c.a = alpha;
                _hapticPulseRing.color = c;
            }
        }

        private void UpdateNotificationTimer()
        {
            if (_notificationTimer > 0)
            {
                _notificationTimer -= Time.deltaTime;
                if (_notificationTimer <= 0)
                {
                    HideNotification();
                }
            }
        }

        // Event handlers

        private void OnHapticIntensityChanged(float intensity)
        {
            // Update haptic indicator
            if (_hapticIndicator != null)
            {
                _hapticIndicator.color = intensity > 0 ? _hapticActiveColor : _hapticInactiveColor;
            }

            // Trigger pulse effect
            if (intensity > 0.1f)
            {
                _isPulsing = true;
                _currentPulseScale = 1f;
            }
            else
            {
                _isPulsing = false;
            }
        }

        private void OnConnected()
        {
            UpdateConnectionStatus(true);

            string roomName = DriftRealtime.Instance?.CurrentRoom ?? "";
            SetRoomName(roomName);
        }

        private void OnDisconnected()
        {
            UpdateConnectionStatus(false);
            SetRoomName("");
            SetPartnerName("");
        }

        // Public methods

        /// <summary>
        /// Updates the connection status indicator.
        /// </summary>
        public void UpdateConnectionStatus(bool connected)
        {
            if (_connectionIndicator != null)
            {
                _connectionIndicator.color = connected ? _connectedColor : _disconnectedColor;
            }
        }

        /// <summary>
        /// Sets the displayed room name.
        /// </summary>
        public void SetRoomName(string roomName)
        {
            if (_roomNameText != null)
            {
                _roomNameText.text = string.IsNullOrEmpty(roomName) ? "" : roomName;
            }
        }

        /// <summary>
        /// Sets the displayed partner name (for private booths).
        /// </summary>
        public void SetPartnerName(string partnerName)
        {
            if (_partnerNameText != null)
            {
                _partnerNameText.text = string.IsNullOrEmpty(partnerName) ? "" : $"With: {partnerName}";
                _partnerNameText.gameObject.SetActive(!string.IsNullOrEmpty(partnerName));
            }
        }

        /// <summary>
        /// Shows a notification message.
        /// </summary>
        public void ShowNotification(string message, float duration = -1)
        {
            if (_notificationPanel != null)
            {
                _notificationPanel.SetActive(true);
            }

            if (_notificationText != null)
            {
                _notificationText.text = message;
            }

            _notificationTimer = duration > 0 ? duration : _notificationDuration;
        }

        /// <summary>
        /// Hides the notification.
        /// </summary>
        public void HideNotification()
        {
            if (_notificationPanel != null)
            {
                _notificationPanel.SetActive(false);
            }
            _notificationTimer = 0;
        }

        /// <summary>
        /// Shows/hides the HUD.
        /// </summary>
        public void SetHUDVisible(bool visible)
        {
            if (_hudCanvas != null)
            {
                _hudCanvas.enabled = visible;
            }
        }

        /// <summary>
        /// Triggers a visual pulse effect (for receiving haptics).
        /// </summary>
        public void TriggerPulseEffect(Color color)
        {
            if (_hapticPulseRing != null)
            {
                _hapticPulseRing.color = color;
                _isPulsing = true;
                _currentPulseScale = 1f;
            }
        }

        /// <summary>
        /// Shows an interaction prompt (e.g., "Press A to Sit").
        /// </summary>
        public void ShowInteractionPrompt(string prompt)
        {
            if (_interactionPromptPanel != null)
            {
                _interactionPromptPanel.SetActive(true);
            }

            if (_interactionPromptText != null)
            {
                _interactionPromptText.text = $"Press A: {prompt}";
            }
        }

        /// <summary>
        /// Hides the interaction prompt.
        /// </summary>
        public void HideInteractionPrompt()
        {
            if (_interactionPromptPanel != null)
            {
                _interactionPromptPanel.SetActive(false);
            }
        }

        /// <summary>
        /// Shows a brief message (alias for ShowNotification).
        /// </summary>
        public void ShowMessage(string message, float duration = 2f)
        {
            ShowNotification(message, duration);
        }

        // Button handlers

        private void OnExitClicked()
        {
            // Check if in booth
            if (BoothManager.Instance != null && BoothManager.Instance.IsOccupied)
            {
                BoothManager.Instance.RequestExit();
            }
            else
            {
                _ = GameManager.Instance?.LeaveVRSpace();
            }
        }

        private void OnMuteClicked()
        {
            // Toggle mute (would need voice chat integration)
            ShowNotification("Mute toggled");
        }

        private void OnHapticPatternClicked()
        {
            // Quick access to send a haptic pattern
            if (GameManager.Instance?.PartnerClientId.HasValue == true)
            {
                GameManager.Instance.SendPatternToPartner("Foreplay");
                ShowNotification("Sent Foreplay pattern");
            }
            else
            {
                ShowNotification("No partner connected");
            }
        }
    }
}
