using UnityEngine;
using System;
using System.Threading.Tasks;
using Drift.API;

namespace Drift.Auth
{
    /// <summary>
    /// Manages authentication state and operations.
    /// Handles login, registration, token refresh, and verification status.
    /// </summary>
    public class AuthManager : MonoBehaviour
    {
        public static AuthManager Instance { get; private set; }

        [Header("Configuration")]
        [SerializeField] private string _apiBaseUrl = "http://localhost:8080";
        [SerializeField] private bool _autoRefreshToken = true;
        [SerializeField] private float _tokenRefreshBuffer = 300f; // 5 minutes before expiry

        // Current auth state
        public bool IsLoggedIn { get; private set; }
        public bool IsVerified { get; private set; }
        public UserResponse CurrentUser { get; private set; }
        public VerificationStatusResponse VerificationStatus { get; private set; }

        // Token state
        private string _accessToken;
        private string _refreshToken;
        private DateTime _tokenExpiry;

        // Events
        public event Action OnLoggedIn;
        public event Action OnLoggedOut;
        public event Action<UserResponse> OnUserUpdated;
        public event Action<VerificationStatusResponse> OnVerificationStatusUpdated;
        public event Action<string> OnAuthError;

        private TokenStorage _tokenStorage;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);

            _tokenStorage = new TokenStorage();
        }

        private async void Start()
        {
            // Configure API client
            ApiClient.Instance.Configure(_apiBaseUrl);

            // Try to restore session
            await TryRestoreSession();
        }

        private void Update()
        {
            // Auto-refresh token if needed
            if (_autoRefreshToken && IsLoggedIn && ShouldRefreshToken())
            {
                _ = RefreshTokenAsync();
            }
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        /// <summary>
        /// Attempts to login with email and password.
        /// </summary>
        public async Task<bool> LoginAsync(string email, string password)
        {
            var request = new LoginRequest
            {
                email = email,
                password = password
            };

            var response = await ApiClient.Instance.PostAsync<AuthResponse>("/v1/auth/login", request);

            if (response.Success && response.Data != null)
            {
                await HandleAuthSuccess(response.Data);
                return true;
            }

            OnAuthError?.Invoke(response.Error ?? "Login failed");
            return false;
        }

        /// <summary>
        /// Registers a new user.
        /// </summary>
        public async Task<bool> RegisterAsync(string email, string password, string displayName)
        {
            var request = new RegisterRequest
            {
                email = email,
                password = password,
                display_name = displayName
            };

            var response = await ApiClient.Instance.PostAsync<AuthResponse>("/v1/auth/register", request);

            if (response.Success && response.Data != null)
            {
                await HandleAuthSuccess(response.Data);
                return true;
            }

            OnAuthError?.Invoke(response.Error ?? "Registration failed");
            return false;
        }

        /// <summary>
        /// Logs out and clears all auth state.
        /// </summary>
        public void Logout()
        {
            IsLoggedIn = false;
            IsVerified = false;
            CurrentUser = null;
            VerificationStatus = null;
            _accessToken = null;
            _refreshToken = null;

            ApiClient.Instance.ClearAuthToken();
            _tokenStorage.ClearTokens();

            OnLoggedOut?.Invoke();
            Debug.Log("[AuthManager] Logged out");
        }

        /// <summary>
        /// Refreshes the access token using the refresh token.
        /// </summary>
        public async Task<bool> RefreshTokenAsync()
        {
            if (string.IsNullOrEmpty(_refreshToken))
            {
                return false;
            }

            var request = new RefreshTokenRequest
            {
                refresh_token = _refreshToken
            };

            var response = await ApiClient.Instance.PostAsync<AuthResponse>("/v1/auth/refresh", request);

            if (response.Success && response.Data != null)
            {
                SetTokens(response.Data.token, response.Data.refresh_token, response.Data.expires_at);
                Debug.Log("[AuthManager] Token refreshed");
                return true;
            }

            // Refresh failed - logout
            Debug.LogWarning("[AuthManager] Token refresh failed, logging out");
            Logout();
            return false;
        }

        /// <summary>
        /// Fetches the current user profile.
        /// </summary>
        public async Task<UserResponse> GetCurrentUserAsync()
        {
            var response = await ApiClient.Instance.GetAsync<UserResponse>("/v1/users/me");

            if (response.Success && response.Data != null)
            {
                CurrentUser = response.Data;
                IsVerified = response.Data.verified;
                OnUserUpdated?.Invoke(response.Data);
                return response.Data;
            }

            return null;
        }

        /// <summary>
        /// Fetches the current verification status.
        /// </summary>
        public async Task<VerificationStatusResponse> GetVerificationStatusAsync()
        {
            var response = await ApiClient.Instance.GetAsync<VerificationStatusResponse>("/v1/age-gate/status");

            if (response.Success && response.Data != null)
            {
                VerificationStatus = response.Data;
                IsVerified = VerificationStatus.status == "VERIFIED";
                OnVerificationStatusUpdated?.Invoke(response.Data);
                return response.Data;
            }

            return null;
        }

        /// <summary>
        /// Initiates card verification (returns Stripe client secret).
        /// </summary>
        public async Task<string> InitiateCardVerificationAsync()
        {
            var response = await ApiClient.Instance.PostAsync<CardVerificationInitResponse>(
                "/v1/age-gate/card/initiate", null);

            if (response.Success && response.Data != null)
            {
                return response.Data.client_secret;
            }

            OnAuthError?.Invoke(response.Error ?? "Failed to initiate card verification");
            return null;
        }

        /// <summary>
        /// Confirms card verification after Stripe success.
        /// </summary>
        public async Task<bool> ConfirmCardVerificationAsync(string setupIntentId)
        {
            var request = new CardVerificationConfirmRequest
            {
                setup_intent_id = setupIntentId
            };

            var response = await ApiClient.Instance.PostAsync<SuccessResponse>(
                "/v1/age-gate/card/confirm", request);

            if (response.Success)
            {
                await GetVerificationStatusAsync();
                return true;
            }

            OnAuthError?.Invoke(response.Error ?? "Failed to confirm card verification");
            return false;
        }

        /// <summary>
        /// Initiates ID verification (returns Jumio redirect URL).
        /// </summary>
        public async Task<string> InitiateIDVerificationAsync()
        {
            var response = await ApiClient.Instance.PostAsync<IDVerificationInitResponse>(
                "/v1/age-gate/id/initiate", null);

            if (response.Success && response.Data != null)
            {
                return response.Data.redirect_url;
            }

            OnAuthError?.Invoke(response.Error ?? "Failed to initiate ID verification");
            return null;
        }

        /// <summary>
        /// Retries verification after rejection.
        /// </summary>
        public async Task<bool> RetryVerificationAsync()
        {
            var response = await ApiClient.Instance.PostAsync<SuccessResponse>(
                "/v1/age-gate/retry", null);

            if (response.Success)
            {
                await GetVerificationStatusAsync();
                return true;
            }

            OnAuthError?.Invoke(response.Error ?? "Failed to retry verification");
            return false;
        }

        /// <summary>
        /// Updates user profile.
        /// </summary>
        public async Task<bool> UpdateProfileAsync(string displayName, string bio)
        {
            var request = new ProfileUpdateRequest
            {
                display_name = displayName,
                bio = bio
            };

            var response = await ApiClient.Instance.PutAsync<UserResponse>("/v1/users/me", request);

            if (response.Success && response.Data != null)
            {
                CurrentUser = response.Data;
                OnUserUpdated?.Invoke(response.Data);
                return true;
            }

            OnAuthError?.Invoke(response.Error ?? "Failed to update profile");
            return false;
        }

        private async Task HandleAuthSuccess(AuthResponse authData)
        {
            SetTokens(authData.token, authData.refresh_token, authData.expires_at);

            CurrentUser = authData.user;
            IsLoggedIn = true;
            IsVerified = authData.user?.verified ?? false;

            // Save tokens
            _tokenStorage.SaveTokens(_accessToken, _refreshToken);

            // Fetch verification status
            await GetVerificationStatusAsync();

            OnLoggedIn?.Invoke();
            OnUserUpdated?.Invoke(CurrentUser);

            Debug.Log($"[AuthManager] Logged in as {CurrentUser?.email}");
        }

        private void SetTokens(string accessToken, string refreshToken, long expiresAt)
        {
            _accessToken = accessToken;
            _refreshToken = refreshToken;
            _tokenExpiry = DateTimeOffset.FromUnixTimeSeconds(expiresAt).DateTime;

            ApiClient.Instance.SetAuthToken(_accessToken);
        }

        private async Task TryRestoreSession()
        {
            var (accessToken, refreshToken) = _tokenStorage.LoadTokens();

            if (string.IsNullOrEmpty(refreshToken))
            {
                Debug.Log("[AuthManager] No stored session");
                return;
            }

            Debug.Log("[AuthManager] Restoring session...");

            _refreshToken = refreshToken;
            _accessToken = accessToken;

            // Try to refresh token
            if (await RefreshTokenAsync())
            {
                // Fetch user data
                var user = await GetCurrentUserAsync();
                if (user != null)
                {
                    IsLoggedIn = true;
                    OnLoggedIn?.Invoke();
                    Debug.Log("[AuthManager] Session restored");
                }
            }
        }

        private bool ShouldRefreshToken()
        {
            if (string.IsNullOrEmpty(_refreshToken)) return false;

            var timeUntilExpiry = _tokenExpiry - DateTime.UtcNow;
            return timeUntilExpiry.TotalSeconds <= _tokenRefreshBuffer;
        }

        /// <summary>
        /// Checks if we need verification before entering VR.
        /// </summary>
        public bool CanEnterVR()
        {
            return IsLoggedIn && IsVerified;
        }

        /// <summary>
        /// Gets the current access token (for WebSocket auth etc).
        /// </summary>
        public string GetAccessToken()
        {
            return _accessToken;
        }
    }
}
