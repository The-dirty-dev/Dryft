using UnityEngine;
using UnityEngine.SceneManagement;
using System;
using System.Threading.Tasks;
using Drift.Haptics;
using Drift.Auth;
using Drift.API;

namespace Drift.Core
{
    /// <summary>
    /// Main game manager. Handles initialization, state transitions,
    /// and coordinates between major systems.
    /// </summary>
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        [Header("Scene Names")]
        [SerializeField] private string _bootstrapScene = "Bootstrap";
        [SerializeField] private string _mainBarScene = "Bar_Main";
        [SerializeField] private string _privateBoothScene = "Booth_Private";

        [Header("References")]
        [SerializeField] private DriftRealtime _realtime;
        [SerializeField] private HapticController _hapticController;

        [Header("Debug")]
        [SerializeField] private bool _skipAuth = false; // Dev only

        // Game state
        public GameState CurrentState { get; private set; } = GameState.Initializing;

        // User state
        public bool IsAuthenticated { get; private set; }
        public bool IsVerified { get; private set; }
        public string UserId { get; private set; }
        public string UserDisplayName { get; private set; }

        // Partner info (when in private booth)
        public int? PartnerClientId { get; private set; }
        public string PartnerDisplayName { get; private set; }

        // Events
        public event Action<GameState> OnStateChanged;
        public event Action OnAuthenticationRequired;
        public event Action OnVerificationRequired;
        public event Action<string> OnError;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);

            // Find references if not set
            if (_realtime == null) _realtime = FindObjectOfType<DriftRealtime>();
            if (_hapticController == null) _hapticController = FindObjectOfType<HapticController>();
        }

        private async void Start()
        {
            await Initialize();
        }

        private void OnDestroy()
        {
            if (Instance == this)
            {
                Instance = null;
            }
        }

        /// <summary>
        /// Initializes the game systems.
        /// </summary>
        public async Task Initialize()
        {
            SetState(GameState.Initializing);
            Debug.Log("[GameManager] Initializing...");

            // Initialize haptics
            if (_hapticController != null)
            {
                await _hapticController.Initialize();
            }

            // Check authentication via AuthManager
            if (_skipAuth)
            {
                Debug.LogWarning("[GameManager] Skipping auth (dev mode)");
                IsAuthenticated = true;
                IsVerified = true;
                UserId = "dev-user-001";
                UserDisplayName = "Dev User";
                SetState(GameState.Ready);
                return;
            }

            // Subscribe to AuthManager events
            if (AuthManager.Instance != null)
            {
                AuthManager.Instance.OnLoggedIn += HandleAuthLoggedIn;
                AuthManager.Instance.OnLoggedOut += HandleAuthLoggedOut;
                AuthManager.Instance.OnVerificationStatusUpdated += HandleVerificationUpdated;
            }

            // Wait for AuthManager to restore session
            await Task.Delay(500); // Give AuthManager time to restore session

            // Check current auth state
            if (AuthManager.Instance != null)
            {
                IsAuthenticated = AuthManager.Instance.IsLoggedIn;
                IsVerified = AuthManager.Instance.IsVerified;

                if (AuthManager.Instance.CurrentUser != null)
                {
                    UserId = AuthManager.Instance.CurrentUser.id;
                    UserDisplayName = AuthManager.Instance.CurrentUser.display_name;
                }
            }

            if (!IsAuthenticated)
            {
                SetState(GameState.NeedsAuthentication);
                OnAuthenticationRequired?.Invoke();
                return;
            }

            if (!IsVerified)
            {
                SetState(GameState.NeedsVerification);
                OnVerificationRequired?.Invoke();
                return;
            }

            SetState(GameState.Ready);
            Debug.Log("[GameManager] Initialization complete");
        }

        private void HandleAuthLoggedIn()
        {
            if (AuthManager.Instance == null) return;

            IsAuthenticated = true;
            IsVerified = AuthManager.Instance.IsVerified;

            if (AuthManager.Instance.CurrentUser != null)
            {
                UserId = AuthManager.Instance.CurrentUser.id;
                UserDisplayName = AuthManager.Instance.CurrentUser.display_name;
            }

            if (IsVerified)
            {
                SetState(GameState.Ready);
            }
            else
            {
                SetState(GameState.NeedsVerification);
                OnVerificationRequired?.Invoke();
            }
        }

        private void HandleAuthLoggedOut()
        {
            IsAuthenticated = false;
            IsVerified = false;
            UserId = null;
            UserDisplayName = null;
            SetState(GameState.NeedsAuthentication);
            OnAuthenticationRequired?.Invoke();
        }

        private void HandleVerificationUpdated(VerificationStatusResponse status)
        {
            if (status == null) return;

            IsVerified = VerificationStatus.IsVerified(status.status);

            if (IsVerified && CurrentState == GameState.NeedsVerification)
            {
                SetState(GameState.Ready);
            }
        }

        /// <summary>
        /// Called after successful authentication.
        /// </summary>
        public async Task OnAuthenticationComplete(string userId, string displayName, string authToken)
        {
            UserId = userId;
            UserDisplayName = displayName;
            IsAuthenticated = true;

            // Store auth token securely
            PlayerPrefs.SetString("auth_token", authToken);
            PlayerPrefs.Save();

            // Now check verification
            bool isVerified = await CheckVerificationStatus();

            if (!isVerified)
            {
                SetState(GameState.NeedsVerification);
                OnVerificationRequired?.Invoke();
                return;
            }

            IsVerified = true;
            SetState(GameState.Ready);
        }

        /// <summary>
        /// Called after successful age verification.
        /// </summary>
        public void OnVerificationComplete()
        {
            IsVerified = true;
            SetState(GameState.Ready);
        }

        /// <summary>
        /// Enters the main bar (public lounge).
        /// </summary>
        public async Task EnterMainBar()
        {
            if (!CanEnterVR())
            {
                OnError?.Invoke("Cannot enter VR - verification required");
                return;
            }

            SetState(GameState.Connecting);

            try
            {
                // Load the bar scene
                await LoadSceneAsync(_mainBarScene);

                // Connect to public room
                _realtime?.JoinPublicLounge();

                SetState(GameState.InPublicLounge);
                Debug.Log("[GameManager] Entered main bar");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[GameManager] Failed to enter bar: {ex.Message}");
                OnError?.Invoke("Failed to enter VR space");
                SetState(GameState.Ready);
            }
        }

        /// <summary>
        /// Enters a private booth with a matched partner.
        /// </summary>
        public async Task EnterPrivateBooth(string boothId, int partnerClientId, string partnerName)
        {
            if (!CanEnterVR())
            {
                OnError?.Invoke("Cannot enter VR - verification required");
                return;
            }

            SetState(GameState.Connecting);
            PartnerClientId = partnerClientId;
            PartnerDisplayName = partnerName;

            try
            {
                // Load booth scene
                await LoadSceneAsync(_privateBoothScene);

                // Connect to private room
                _realtime?.JoinPrivateBooth(boothId);

                SetState(GameState.InPrivateBooth);
                Debug.Log($"[GameManager] Entered private booth with {partnerName}");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[GameManager] Failed to enter booth: {ex.Message}");
                OnError?.Invoke("Failed to enter private space");
                SetState(GameState.Ready);
                PartnerClientId = null;
                PartnerDisplayName = null;
            }
        }

        /// <summary>
        /// Leaves current VR space and returns to ready state.
        /// </summary>
        public async Task LeaveVRSpace()
        {
            _realtime?.LeaveRoom();
            PartnerClientId = null;
            PartnerDisplayName = null;

            // Could load a lobby scene or just set state
            SetState(GameState.Ready);
            Debug.Log("[GameManager] Left VR space");
        }

        /// <summary>
        /// Checks if user can enter VR spaces.
        /// </summary>
        public bool CanEnterVR()
        {
            return IsAuthenticated && IsVerified;
        }

        /// <summary>
        /// Sends a haptic event to the current partner.
        /// </summary>
        public void SendHapticToPartner(float intensity, int durationMs)
        {
            if (!PartnerClientId.HasValue)
            {
                Debug.LogWarning("[GameManager] No partner to send haptic to");
                return;
            }

            var hapticSync = FindObjectOfType<Networking.HapticSync>();
            hapticSync?.SendHapticToPartner(PartnerClientId.Value, intensity, durationMs);
        }

        /// <summary>
        /// Sends a haptic pattern to the current partner.
        /// </summary>
        public void SendPatternToPartner(string patternName)
        {
            if (!PartnerClientId.HasValue)
            {
                Debug.LogWarning("[GameManager] No partner to send pattern to");
                return;
            }

            var hapticSync = FindObjectOfType<Networking.HapticSync>();
            hapticSync?.SendPatternToPartner(PartnerClientId.Value, patternName);
        }

        private void SetState(GameState newState)
        {
            if (CurrentState != newState)
            {
                var oldState = CurrentState;
                CurrentState = newState;
                Debug.Log($"[GameManager] State: {oldState} -> {newState}");
                OnStateChanged?.Invoke(newState);
            }
        }

        private async Task<bool> CheckStoredAuthentication()
        {
            if (AuthManager.Instance == null)
            {
                Debug.LogWarning("[GameManager] AuthManager not available");
                return false;
            }

            // AuthManager.TryRestoreSession() is called on its Start(),
            // which refreshes the token with the backend automatically.
            // Wait briefly for it to complete, then check state.
            int maxWaitMs = 3000;
            int waited = 0;
            while (!AuthManager.Instance.IsLoggedIn && waited < maxWaitMs)
            {
                await Task.Delay(100);
                waited += 100;
            }

            if (AuthManager.Instance.IsLoggedIn && AuthManager.Instance.CurrentUser != null)
            {
                IsAuthenticated = true;
                UserId = AuthManager.Instance.CurrentUser.id;
                UserDisplayName = AuthManager.Instance.CurrentUser.display_name;
                return true;
            }

            return false;
        }

        private async Task<bool> CheckVerificationStatus()
        {
            if (AuthManager.Instance == null)
            {
                return false;
            }

            // Call the real verification endpoint via AuthManager
            var status = await AuthManager.Instance.GetVerificationStatusAsync();
            return status != null && AuthManager.Instance.IsVerified;
        }

        private async Task LoadSceneAsync(string sceneName)
        {
            var op = SceneManager.LoadSceneAsync(sceneName);
            while (!op.isDone)
            {
                await Task.Yield();
            }
        }

        /// <summary>
        /// Logs out and clears stored data.
        /// </summary>
        public void Logout()
        {
            // Use AuthManager for logout
            AuthManager.Instance?.Logout();

            IsAuthenticated = false;
            IsVerified = false;
            UserId = null;
            UserDisplayName = null;
            PartnerClientId = null;
            PartnerDisplayName = null;

            SetState(GameState.NeedsAuthentication);
        }

        /// <summary>
        /// Gets the access token for authenticated requests.
        /// </summary>
        public string GetAccessToken()
        {
            return AuthManager.Instance?.GetAccessToken();
        }

        // Legacy compatibility accessor used by older systems.
        public string AuthToken => GetAccessToken();
    }

    /// <summary>
    /// Game state enumeration.
    /// </summary>
    public enum GameState
    {
        Initializing,
        NeedsAuthentication,
        NeedsVerification,
        Ready,              // Authenticated and verified, can enter VR
        Connecting,         // Connecting to a room
        InPublicLounge,     // In the main bar
        InPrivateBooth,     // In a private space with a partner
        Error
    }
}
