using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System;
using System.Collections.Generic;
using Drift.Core;
using Drift.Player;
using Drift.Haptics;
using Drift.API;

namespace Drift.UI
{
    /// <summary>
    /// Manages the main menu and settings UI.
    /// VR-friendly menu that follows the player and responds to controller input.
    /// </summary>
    public class MenuManager : MonoBehaviour
    {
        public static MenuManager Instance { get; private set; }

        [Header("Menu Panels")]
        [SerializeField] private GameObject _menuRoot;
        [SerializeField] private GameObject _mainMenuPanel;
        [SerializeField] private GameObject _settingsPanel;
        [SerializeField] private GameObject _profilePanel;
        [SerializeField] private GameObject _matchPanel;
        [SerializeField] private GameObject _devicePanel;
        [SerializeField] private GameObject _companionPanel;

        [Header("Menu Transform")]
        [SerializeField] private float _menuDistance = 1.5f;
        [SerializeField] private float _menuHeight = 0f;
        [SerializeField] private bool _followPlayer = true;
        [SerializeField] private float _followSpeed = 5f;

        [Header("Main Menu Buttons")]
        [SerializeField] private Button _enterBarButton;
        [SerializeField] private Button _settingsButton;
        [SerializeField] private Button _profileButton;
        [SerializeField] private Button _logoutButton;

        [Header("Settings")]
        [SerializeField] private Slider _hapticIntensitySlider;
        [SerializeField] private Slider _musicVolumeSlider;
        [SerializeField] private Toggle _snapTurnToggle;
        [SerializeField] private Slider _moveSpeedSlider;
        [SerializeField] private Button _devicesButton;

        [Header("Device Panel (Intiface)")]
        [SerializeField] private Button _connectIntifaceButton;
        [SerializeField] private Button _scanDevicesButton;
        [SerializeField] private TMP_InputField _intifaceUrlInput;
        [SerializeField] private Transform _deviceListContainer;
        [SerializeField] private GameObject _deviceItemPrefab;
        [SerializeField] private TMP_Text _intifaceStatusText;
        [SerializeField] private TMP_Text _currentDeviceText;

        [Header("Text Elements")]
        [SerializeField] private TMP_Text _welcomeText;
        [SerializeField] private TMP_Text _statusText;

        [Header("Companion Session Panel")]
        [SerializeField] private Button _companionButton;
        [SerializeField] private Button _createSessionButton;
        [SerializeField] private Button _endSessionButton;
        [SerializeField] private TMP_Text _sessionCodeText;
        [SerializeField] private TMP_Text _companionStatusText;
        [SerializeField] private Transform _companionListContainer;
        [SerializeField] private GameObject _companionItemPrefab;
        [SerializeField] private TMP_Text _companionCountText;

        [Header("Matchmaking Panel")]
        [SerializeField] private Button _matchmakingButton;
        [SerializeField] private Button _startMatchButton;
        [SerializeField] private Button _cancelMatchButton;
        [SerializeField] private TMP_Text _matchStatusText;
        [SerializeField] private TMP_Text _matchTimerText;
        [SerializeField] private TMP_Text _queuePositionText;
        [SerializeField] private GameObject _matchFoundPanel;
        [SerializeField] private TMP_Text _partnerNameText;
        [SerializeField] private TMP_Text _acceptTimerText;
        [SerializeField] private Button _acceptMatchButton;
        [SerializeField] private Button _declineMatchButton;
        [SerializeField] private Image _matchmakingProgressFill;

        // State
        public bool IsMenuOpen { get; private set; }
        private GameObject _currentPanel;
        private Transform _playerCamera;
        private List<GameObject> _deviceListItems = new();
        private List<GameObject> _companionListItems = new();

        // Events
        public event Action OnMenuOpened;
        public event Action OnMenuClosed;

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
            SetupButtons();
            SetupSettings();

            // Find player camera
            var player = PlayerController.Instance;
            if (player != null)
            {
                _playerCamera = player.transform.Find("TrackingSpace/CenterEyeAnchor");
            }

            // Subscribe to player menu button
            if (player != null)
            {
                player.OnMenuPressed += ToggleMenu;
            }

            // Subscribe to game state changes
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnStateChanged += HandleGameStateChanged;
            }

            // Start with menu closed
            CloseMenu();
        }

        private void Update()
        {
            if (IsMenuOpen && _followPlayer && _playerCamera != null)
            {
                UpdateMenuPosition();
            }
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;

            if (PlayerController.Instance != null)
            {
                PlayerController.Instance.OnMenuPressed -= ToggleMenu;
            }

            // Unsubscribe from haptic events
            var haptics = HapticController.Instance;
            if (haptics != null)
            {
                haptics.OnIntifaceConnected -= OnIntifaceConnected;
                haptics.OnIntifaceDisconnected -= OnIntifaceDisconnected;
                haptics.OnIntifaceDeviceFound -= OnIntifaceDeviceFound;
                haptics.OnIntifaceDeviceLost -= OnIntifaceDeviceLost;
                haptics.OnIntifaceError -= OnIntifaceError;
                haptics.OnDeviceConnected -= OnDeviceConnected;
            }

            // Unsubscribe from companion session events
            var companion = CompanionSessionManager.Instance;
            if (companion != null)
            {
                companion.OnSessionCreated -= OnCompanionSessionCreated;
                companion.OnSessionEnded -= OnCompanionSessionEnded;
                companion.OnCompanionJoined -= OnCompanionUserJoined;
                companion.OnCompanionLeft -= OnCompanionUserLeft;
                companion.OnChatReceived -= OnCompanionChatReceived;
                companion.OnHapticReceived -= OnCompanionHapticReceived;
            }
        }

        private void SetupButtons()
        {
            if (_enterBarButton != null)
                _enterBarButton.onClick.AddListener(OnEnterBarClicked);

            if (_settingsButton != null)
                _settingsButton.onClick.AddListener(() => ShowPanel(_settingsPanel));

            if (_profileButton != null)
                _profileButton.onClick.AddListener(() => ShowPanel(_profilePanel));

            if (_logoutButton != null)
                _logoutButton.onClick.AddListener(OnLogoutClicked);

            if (_devicesButton != null)
                _devicesButton.onClick.AddListener(() => ShowPanel(_devicePanel));

            // Companion session button
            if (_companionButton != null)
                _companionButton.onClick.AddListener(() => ShowPanel(_companionPanel));

            if (_createSessionButton != null)
                _createSessionButton.onClick.AddListener(OnCreateSessionClicked);

            if (_endSessionButton != null)
                _endSessionButton.onClick.AddListener(OnEndSessionClicked);

            // Intiface buttons
            if (_connectIntifaceButton != null)
                _connectIntifaceButton.onClick.AddListener(OnConnectIntifaceClicked);

            if (_scanDevicesButton != null)
                _scanDevicesButton.onClick.AddListener(OnScanDevicesClicked);

            // Matchmaking buttons
            if (_matchmakingButton != null)
                _matchmakingButton.onClick.AddListener(() => ShowPanel(_matchPanel));

            if (_startMatchButton != null)
                _startMatchButton.onClick.AddListener(OnStartMatchClicked);

            if (_cancelMatchButton != null)
                _cancelMatchButton.onClick.AddListener(OnCancelMatchClicked);

            if (_acceptMatchButton != null)
                _acceptMatchButton.onClick.AddListener(OnAcceptMatchClicked);

            if (_declineMatchButton != null)
                _declineMatchButton.onClick.AddListener(OnDeclineMatchClicked);
        }

        private void SetupSettings()
        {
            // Haptic intensity
            if (_hapticIntensitySlider != null)
            {
                _hapticIntensitySlider.value = 1f;
                _hapticIntensitySlider.onValueChanged.AddListener(OnHapticIntensityChanged);
            }

            // Music volume
            if (_musicVolumeSlider != null)
            {
                _musicVolumeSlider.value = 0.3f;
                _musicVolumeSlider.onValueChanged.AddListener(OnMusicVolumeChanged);
            }

            // Snap turn
            if (_snapTurnToggle != null)
            {
                _snapTurnToggle.isOn = true;
                _snapTurnToggle.onValueChanged.AddListener(OnSnapTurnChanged);
            }

            // Move speed
            if (_moveSpeedSlider != null)
            {
                _moveSpeedSlider.value = 2f;
                _moveSpeedSlider.onValueChanged.AddListener(OnMoveSpeedChanged);
            }

            // Intiface URL
            if (_intifaceUrlInput != null)
            {
                _intifaceUrlInput.text = HapticController.Instance?.IntifaceServerUrl ?? "ws://127.0.0.1:12345";
                _intifaceUrlInput.onEndEdit.AddListener(OnIntifaceUrlChanged);
            }

            // Subscribe to haptic controller events
            SetupIntifaceEvents();
            UpdateIntifaceUI();

            // Subscribe to companion session events
            SetupCompanionEvents();
            UpdateCompanionUI();

            // Subscribe to matchmaking events
            SetupMatchmakingEvents();
            UpdateMatchmakingUI();
        }

        private void SetupIntifaceEvents()
        {
            var haptics = HapticController.Instance;
            if (haptics == null) return;

            haptics.OnIntifaceConnected += OnIntifaceConnected;
            haptics.OnIntifaceDisconnected += OnIntifaceDisconnected;
            haptics.OnIntifaceDeviceFound += OnIntifaceDeviceFound;
            haptics.OnIntifaceDeviceLost += OnIntifaceDeviceLost;
            haptics.OnIntifaceError += OnIntifaceError;
            haptics.OnDeviceConnected += OnDeviceConnected;
        }

        private void OnIntifaceConnected()
        {
            UpdateIntifaceUI();
            ShowToast("Connected to Intiface Central");
        }

        private void OnIntifaceDisconnected()
        {
            ClearDeviceList();
            UpdateIntifaceUI();
            ShowToast("Disconnected from Intiface Central");
        }

        private void OnIntifaceDeviceFound(IntifaceDevice device)
        {
            AddDeviceToList(device);
            UpdateIntifaceUI();
        }

        private void OnIntifaceDeviceLost(int deviceIndex)
        {
            RefreshDeviceList();
            UpdateIntifaceUI();
        }

        private void OnIntifaceError(string error)
        {
            ShowToast($"Error: {error}");
            UpdateIntifaceUI();
        }

        private void OnDeviceConnected(IHapticDevice device)
        {
            UpdateIntifaceUI();
            ShowToast($"Connected to: {device.DeviceName}");
        }

        private void UpdateMenuPosition()
        {
            // Position menu in front of player
            Vector3 forward = _playerCamera.forward;
            forward.y = 0;
            forward.Normalize();

            Vector3 targetPos = _playerCamera.position + forward * _menuDistance;
            targetPos.y = _playerCamera.position.y + _menuHeight;

            transform.position = Vector3.Lerp(transform.position, targetPos, Time.deltaTime * _followSpeed);
            transform.LookAt(_playerCamera);
            transform.Rotate(0, 180, 0); // Face the player
        }

        /// <summary>
        /// Toggles the menu open/closed.
        /// </summary>
        public void ToggleMenu()
        {
            if (IsMenuOpen)
                CloseMenu();
            else
                OpenMenu();
        }

        /// <summary>
        /// Opens the main menu.
        /// </summary>
        public void OpenMenu()
        {
            IsMenuOpen = true;
            _menuRoot?.SetActive(true);
            ShowPanel(_mainMenuPanel);

            // Update welcome text
            UpdateWelcomeText();

            // Disable player movement while in menu
            if (PlayerController.Instance != null)
            {
                PlayerController.Instance.IsMovementEnabled = false;
            }

            OnMenuOpened?.Invoke();
        }

        /// <summary>
        /// Closes the menu.
        /// </summary>
        public void CloseMenu()
        {
            IsMenuOpen = false;
            _menuRoot?.SetActive(false);

            // Re-enable player movement
            if (PlayerController.Instance != null)
            {
                PlayerController.Instance.IsMovementEnabled = true;
            }

            OnMenuClosed?.Invoke();
        }

        /// <summary>
        /// Shows a specific panel.
        /// </summary>
        public void ShowPanel(GameObject panel)
        {
            // Hide all panels
            _mainMenuPanel?.SetActive(false);
            _settingsPanel?.SetActive(false);
            _profilePanel?.SetActive(false);
            _matchPanel?.SetActive(false);
            _devicePanel?.SetActive(false);
            _companionPanel?.SetActive(false);
            _matchFoundPanel?.SetActive(false);

            // Show requested panel
            if (panel != null)
            {
                panel.SetActive(true);
                _currentPanel = panel;

                // Update device panel when shown
                if (panel == _devicePanel)
                {
                    RefreshDeviceList();
                    UpdateIntifaceUI();
                }

                // Update companion panel when shown
                if (panel == _companionPanel)
                {
                    RefreshCompanionList();
                    UpdateCompanionUI();
                }

                // Update matchmaking panel when shown
                if (panel == _matchPanel)
                {
                    UpdateMatchmakingUI();
                }
            }
        }

        /// <summary>
        /// Returns to main menu panel.
        /// </summary>
        public void BackToMainMenu()
        {
            ShowPanel(_mainMenuPanel);
        }

        private void UpdateWelcomeText()
        {
            if (_welcomeText == null) return;

            string name = GameManager.Instance?.UserDisplayName ?? "User";
            _welcomeText.text = $"Welcome, {name}";
        }

        private void HandleGameStateChanged(GameState state)
        {
            // Update status text
            if (_statusText != null)
            {
                _statusText.text = state switch
                {
                    GameState.NeedsAuthentication => "Please log in",
                    GameState.NeedsVerification => "Age verification required",
                    GameState.Ready => "Ready to drift",
                    GameState.InPublicLounge => "In the lounge",
                    GameState.InPrivateBooth => "In private booth",
                    _ => ""
                };
            }

            // Update button states
            if (_enterBarButton != null)
            {
                _enterBarButton.interactable = state == GameState.Ready;
            }
        }

        // Button handlers

        private async void OnEnterBarClicked()
        {
            CloseMenu();
            await GameManager.Instance?.EnterMainBar();
        }

        private void OnLogoutClicked()
        {
            GameManager.Instance?.Logout();
            CloseMenu();
        }

        // Settings handlers

        private void OnHapticIntensityChanged(float value)
        {
            Haptics.HapticController.Instance?.SetGlobalIntensity(value);
        }

        private void OnMusicVolumeChanged(float value)
        {
            Environment.EnvironmentManager.Instance?.SetAmbientVolume(value);
        }

        private void OnSnapTurnChanged(bool useSnap)
        {
            PlayerController.Instance?.SetSnapTurn(useSnap);
        }

        private void OnMoveSpeedChanged(float value)
        {
            PlayerController.Instance?.SetMoveSpeed(value);
        }

        // ==========================================================================
        // Intiface UI Methods
        // ==========================================================================

        private void OnIntifaceUrlChanged(string url)
        {
            HapticController.Instance?.SetIntifaceServerUrl(url);
        }

        private async void OnConnectIntifaceClicked()
        {
            var haptics = HapticController.Instance;
            if (haptics == null) return;

            if (haptics.IsIntifaceConnected)
            {
                await haptics.DisconnectFromIntiface();
            }
            else
            {
                string url = _intifaceUrlInput?.text;
                UpdateIntifaceUI(); // Show connecting state
                await haptics.ConnectToIntiface(url);
            }

            UpdateIntifaceUI();
        }

        private async void OnScanDevicesClicked()
        {
            var haptics = HapticController.Instance;
            if (haptics == null || !haptics.IsIntifaceConnected) return;

            if (haptics.IsIntifaceScanning)
            {
                await haptics.StopIntifaceScan();
            }
            else
            {
                await haptics.StartIntifaceScan();

                // Auto-stop after 10 seconds
                await System.Threading.Tasks.Task.Delay(10000);
                await haptics.StopIntifaceScan();
            }

            UpdateIntifaceUI();
        }

        private void UpdateIntifaceUI()
        {
            var haptics = HapticController.Instance;
            if (haptics == null) return;

            // Update status text
            if (_intifaceStatusText != null)
            {
                if (haptics.IsIntifaceConnected)
                {
                    int deviceCount = haptics.AvailableIntifaceDevices.Count;
                    _intifaceStatusText.text = haptics.IsIntifaceScanning
                        ? $"Scanning... ({deviceCount} found)"
                        : $"Connected ({deviceCount} devices)";
                    _intifaceStatusText.color = Color.green;
                }
                else
                {
                    _intifaceStatusText.text = "Not connected";
                    _intifaceStatusText.color = Color.gray;
                }
            }

            // Update current device text
            if (_currentDeviceText != null)
            {
                _currentDeviceText.text = $"Active: {haptics.DeviceName}";
            }

            // Update connect button text
            if (_connectIntifaceButton != null)
            {
                var buttonText = _connectIntifaceButton.GetComponentInChildren<TMP_Text>();
                if (buttonText != null)
                {
                    buttonText.text = haptics.IsIntifaceConnected ? "Disconnect" : "Connect";
                }
            }

            // Update scan button
            if (_scanDevicesButton != null)
            {
                _scanDevicesButton.interactable = haptics.IsIntifaceConnected;
                var buttonText = _scanDevicesButton.GetComponentInChildren<TMP_Text>();
                if (buttonText != null)
                {
                    buttonText.text = haptics.IsIntifaceScanning ? "Stop Scan" : "Scan for Devices";
                }
            }
        }

        private void ClearDeviceList()
        {
            foreach (var item in _deviceListItems)
            {
                if (item != null) Destroy(item);
            }
            _deviceListItems.Clear();
        }

        private void RefreshDeviceList()
        {
            ClearDeviceList();

            var haptics = HapticController.Instance;
            if (haptics == null) return;

            foreach (var device in haptics.AvailableIntifaceDevices)
            {
                AddDeviceToList(device);
            }
        }

        private void AddDeviceToList(IntifaceDevice device)
        {
            if (_deviceListContainer == null || _deviceItemPrefab == null) return;

            var itemGO = Instantiate(_deviceItemPrefab, _deviceListContainer);
            _deviceListItems.Add(itemGO);

            // Set device name
            var nameText = itemGO.GetComponentInChildren<TMP_Text>();
            if (nameText != null)
            {
                string capabilities = "";
                if (device.Capabilities.CanVibrate) capabilities += "V";
                if (device.Capabilities.CanRotate) capabilities += "R";
                if (device.Capabilities.CanLinear) capabilities += "L";
                nameText.text = $"{device.Name} [{capabilities}]";
            }

            // Set up connect button
            var button = itemGO.GetComponentInChildren<Button>();
            if (button != null)
            {
                int deviceIndex = device.Index; // Capture for closure
                button.onClick.AddListener(() => OnDeviceItemClicked(deviceIndex));
            }
        }

        private async void OnDeviceItemClicked(int deviceIndex)
        {
            var haptics = HapticController.Instance;
            if (haptics == null) return;

            bool success = await haptics.ConnectIntifaceDevice(deviceIndex);
            if (success)
            {
                UpdateIntifaceUI();
            }
            else
            {
                ShowToast("Failed to connect to device");
            }
        }

        /// <summary>
        /// Shows a toast notification.
        /// </summary>
        public void ShowToast(string message, float duration = 2f)
        {
            // Would need toast UI implementation
            Debug.Log($"[Toast] {message}");
        }

        /// <summary>
        /// Shows a confirmation dialog.
        /// </summary>
        public void ShowConfirmDialog(string title, string message, Action onConfirm, Action onCancel = null)
        {
            // Would need dialog UI implementation
            Debug.Log($"[Dialog] {title}: {message}");
        }

        // ==========================================================================
        // Companion Session Methods
        // ==========================================================================

        private void SetupCompanionEvents()
        {
            var companion = CompanionSessionManager.Instance;
            if (companion == null) return;

            companion.OnSessionCreated += OnCompanionSessionCreated;
            companion.OnSessionEnded += OnCompanionSessionEnded;
            companion.OnCompanionJoined += OnCompanionUserJoined;
            companion.OnCompanionLeft += OnCompanionUserLeft;
            companion.OnChatReceived += OnCompanionChatReceived;
            companion.OnHapticReceived += OnCompanionHapticReceived;
        }

        private void OnCompanionSessionCreated(Drift.API.SessionInfo session)
        {
            UpdateCompanionUI();
            ShowToast($"Session created: {session.session.session_code}");
        }

        private void OnCompanionSessionEnded()
        {
            ClearCompanionList();
            UpdateCompanionUI();
            ShowToast("Companion session ended");
        }

        private void OnCompanionUserJoined(Drift.API.SessionUser user)
        {
            AddCompanionToList(user);
            UpdateCompanionUI();
            ShowToast($"{user.display_name} joined");
        }

        private void OnCompanionUserLeft(string userId, string reason)
        {
            RefreshCompanionList();
            UpdateCompanionUI();
            ShowToast($"Companion left: {reason}");
        }

        private void OnCompanionChatReceived(string displayName, string content)
        {
            ShowToast($"{displayName}: {content}");
        }

        private void OnCompanionHapticReceived(float intensity)
        {
            // Visual feedback when receiving haptic from companion
            Debug.Log($"[Menu] Haptic received: {intensity * 100}%");
        }

        private async void OnCreateSessionClicked()
        {
            var companion = CompanionSessionManager.Instance;
            if (companion == null) return;

            if (companion.HasActiveSession)
            {
                ShowToast("Session already active");
                return;
            }

            UpdateCompanionUI(); // Show creating state
            string code = await companion.CreateSession();

            if (!string.IsNullOrEmpty(code))
            {
                UpdateCompanionUI();
            }
            else
            {
                ShowToast("Failed to create session");
            }
        }

        private async void OnEndSessionClicked()
        {
            var companion = CompanionSessionManager.Instance;
            if (companion == null || !companion.HasActiveSession) return;

            await companion.EndSession();
            UpdateCompanionUI();
        }

        private void UpdateCompanionUI()
        {
            var companion = CompanionSessionManager.Instance;
            bool hasSession = companion?.HasActiveSession ?? false;

            // Update session code display
            if (_sessionCodeText != null)
            {
                if (hasSession)
                {
                    string code = companion.SessionCode ?? "------";
                    // Format as "XXX-XXX" for readability
                    if (code.Length == 6)
                    {
                        code = $"{code.Substring(0, 3)}-{code.Substring(3, 3)}";
                    }
                    _sessionCodeText.text = code;
                    _sessionCodeText.color = Color.white;
                }
                else
                {
                    _sessionCodeText.text = "------";
                    _sessionCodeText.color = Color.gray;
                }
            }

            // Update status text
            if (_companionStatusText != null)
            {
                if (hasSession)
                {
                    int count = companion.Companions.Count;
                    _companionStatusText.text = count > 0
                        ? $"{count} companion{(count > 1 ? "s" : "")} connected"
                        : "Waiting for companions...";
                    _companionStatusText.color = count > 0 ? Color.green : Color.yellow;
                }
                else
                {
                    _companionStatusText.text = "No active session";
                    _companionStatusText.color = Color.gray;
                }
            }

            // Update companion count
            if (_companionCountText != null)
            {
                int count = companion?.Companions.Count ?? 0;
                _companionCountText.text = count.ToString();
            }

            // Update buttons
            if (_createSessionButton != null)
            {
                _createSessionButton.gameObject.SetActive(!hasSession);
            }

            if (_endSessionButton != null)
            {
                _endSessionButton.gameObject.SetActive(hasSession);
            }
        }

        private void ClearCompanionList()
        {
            foreach (var item in _companionListItems)
            {
                if (item != null) Destroy(item);
            }
            _companionListItems.Clear();
        }

        private void RefreshCompanionList()
        {
            ClearCompanionList();

            var companion = CompanionSessionManager.Instance;
            if (companion == null) return;

            foreach (var user in companion.Companions)
            {
                AddCompanionToList(user);
            }
        }

        private void AddCompanionToList(Drift.API.SessionUser user)
        {
            if (_companionListContainer == null || _companionItemPrefab == null) return;

            var itemGO = Instantiate(_companionItemPrefab, _companionListContainer);
            _companionListItems.Add(itemGO);

            // Set user info
            var nameText = itemGO.GetComponentInChildren<TMP_Text>();
            if (nameText != null)
            {
                string deviceIcon = user.device_type switch
                {
                    "mobile" => "📱",
                    "web" => "💻",
                    _ => "🌐"
                };
                nameText.text = $"{deviceIcon} {user.display_name}";
            }

            // Set up haptic button (send haptic to companion)
            var buttons = itemGO.GetComponentsInChildren<Button>();
            foreach (var button in buttons)
            {
                if (button.name.Contains("Haptic") || button.name.Contains("Vibrate"))
                {
                    string userId = user.user_id; // Capture for closure
                    button.onClick.AddListener(() => OnSendHapticToCompanion(userId));
                }
            }
        }

        private async void OnSendHapticToCompanion(string userId)
        {
            var companion = CompanionSessionManager.Instance;
            if (companion == null) return;

            await companion.SendHapticToCompanion(userId, 0.5f, 1000);
            ShowToast("Haptic sent");
        }

        // ==========================================================================
        // Matchmaking UI Methods
        // ==========================================================================

        private void SetupMatchmakingEvents()
        {
            var session = SessionManager.Instance;
            if (session == null) return;

            session.OnStateChanged += HandleSessionStateChanged;
            session.OnMatchReceived += HandleMatchReceived;
            session.OnMatchExpired += HandleMatchExpired;
            session.OnQueuePositionChanged += HandleQueuePositionChanged;
            session.OnSessionError += HandleSessionError;
        }

        private void HandleSessionStateChanged(SessionState state)
        {
            UpdateMatchmakingUI();

            // Auto-open match found panel
            if (state == SessionState.MatchFound)
            {
                ShowMatchFoundPanel();
            }
            else if (state == SessionState.InPrivateBooth)
            {
                // Close menu when entering booth
                CloseMenu();
            }
        }

        private void HandleMatchReceived(MatchResult match)
        {
            if (_partnerNameText != null)
            {
                _partnerNameText.text = match.Partner.DisplayName;
            }

            ShowMatchFoundPanel();
            ShowToast($"Match found: {match.Partner.DisplayName}");

            // Haptic feedback for match
            HapticController.Instance?.Pulse(0.8f, 0.5f);
        }

        private void HandleMatchExpired()
        {
            _matchFoundPanel?.SetActive(false);
            UpdateMatchmakingUI();
            ShowToast("Match expired");
        }

        private void HandleQueuePositionChanged(int position)
        {
            if (_queuePositionText != null)
            {
                _queuePositionText.text = position > 0
                    ? $"Queue position: #{position}"
                    : "Finding match...";
            }
        }

        private void HandleSessionError(string error)
        {
            ShowToast($"Session error: {error}");
            UpdateMatchmakingUI();
        }

        private void ShowMatchFoundPanel()
        {
            // Show match found panel as overlay
            _matchFoundPanel?.SetActive(true);

            var session = SessionManager.Instance;
            if (session?.Partner != null && _partnerNameText != null)
            {
                _partnerNameText.text = session.Partner.DisplayName;
            }
        }

        private void OnStartMatchClicked()
        {
            var session = SessionManager.Instance;
            if (session == null) return;

            if (session.CurrentState == SessionState.InPublicLounge)
            {
                session.StartMatchmaking();
                UpdateMatchmakingUI();
            }
            else if (session.CurrentState == SessionState.Ready)
            {
                // Need to enter lounge first
                ShowToast("Enter the lounge first");
            }
        }

        private void OnCancelMatchClicked()
        {
            var session = SessionManager.Instance;
            if (session == null) return;

            session.CancelMatchmaking();
            UpdateMatchmakingUI();
        }

        private async void OnAcceptMatchClicked()
        {
            var session = SessionManager.Instance;
            if (session == null) return;

            _matchFoundPanel?.SetActive(false);
            await session.AcceptMatch();
        }

        private void OnDeclineMatchClicked()
        {
            var session = SessionManager.Instance;
            if (session == null) return;

            _matchFoundPanel?.SetActive(false);
            session.DeclineMatch();
            UpdateMatchmakingUI();
        }

        private void UpdateMatchmakingUI()
        {
            var session = SessionManager.Instance;
            if (session == null) return;

            var state = session.CurrentState;
            bool isMatchmaking = state == SessionState.Matchmaking;
            bool isMatchFound = state == SessionState.MatchFound;
            bool canStartMatch = state == SessionState.InPublicLounge;

            // Update buttons
            if (_startMatchButton != null)
            {
                _startMatchButton.gameObject.SetActive(!isMatchmaking && !isMatchFound);
                _startMatchButton.interactable = canStartMatch;
            }

            if (_cancelMatchButton != null)
            {
                _cancelMatchButton.gameObject.SetActive(isMatchmaking);
            }

            // Update status text
            if (_matchStatusText != null)
            {
                _matchStatusText.text = state switch
                {
                    SessionState.None => "Not in lounge",
                    SessionState.InPublicLounge => "Ready to match",
                    SessionState.Matchmaking => "Looking for match...",
                    SessionState.MatchFound => "Match found!",
                    SessionState.InPrivateBooth => "In private booth",
                    _ => ""
                };

                _matchStatusText.color = state switch
                {
                    SessionState.Matchmaking => Color.yellow,
                    SessionState.MatchFound => Color.green,
                    SessionState.InPrivateBooth => Color.cyan,
                    _ => Color.white
                };
            }

            // Update timer
            if (_matchTimerText != null)
            {
                if (isMatchmaking)
                {
                    float timeRemaining = session.GetMatchTimeRemaining();
                    int seconds = Mathf.CeilToInt(timeRemaining);
                    _matchTimerText.text = $"Time remaining: {seconds}s";
                    _matchTimerText.gameObject.SetActive(true);
                }
                else
                {
                    _matchTimerText.gameObject.SetActive(false);
                }
            }

            // Update progress fill
            if (_matchmakingProgressFill != null)
            {
                if (isMatchmaking)
                {
                    // Pulse animation for progress
                    float pulse = (Mathf.Sin(Time.time * 2f) + 1f) / 2f;
                    _matchmakingProgressFill.fillAmount = pulse;
                    _matchmakingProgressFill.gameObject.SetActive(true);
                }
                else
                {
                    _matchmakingProgressFill.gameObject.SetActive(false);
                }
            }

            // Update accept timer in match found panel
            if (_acceptTimerText != null && isMatchFound)
            {
                int seconds = Mathf.CeilToInt(session.MatchAcceptTimeRemaining);
                _acceptTimerText.text = $"Accept in {seconds}s";
            }

            // Update matchmaking button in main menu based on state
            if (_matchmakingButton != null)
            {
                _matchmakingButton.interactable = state == SessionState.InPublicLounge ||
                                                   state == SessionState.Matchmaking ||
                                                   state == SessionState.MatchFound;
            }
        }

        private void LateUpdate()
        {
            // Continuously update matchmaking UI when in matchmaking state
            var session = SessionManager.Instance;
            if (session != null &&
                (session.CurrentState == SessionState.Matchmaking ||
                 session.CurrentState == SessionState.MatchFound))
            {
                UpdateMatchmakingUI();
            }
        }
    }
}
