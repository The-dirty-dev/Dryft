using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System;
using Drift.API;

namespace Drift.Auth
{
    /// <summary>
    /// Controls the authentication UI flow.
    /// Manages login, registration, and verification screens.
    ///
    /// VR-friendly design with large touch targets and clear feedback.
    /// </summary>
    public class AuthUIController : MonoBehaviour
    {
        public static AuthUIController Instance { get; private set; }

        [Header("Panels")]
        [SerializeField] private GameObject _authRoot;
        [SerializeField] private GameObject _loginPanel;
        [SerializeField] private GameObject _registerPanel;
        [SerializeField] private GameObject _verificationPanel;
        [SerializeField] private GameObject _loadingPanel;

        [Header("Login")]
        [SerializeField] private TMP_InputField _loginEmailInput;
        [SerializeField] private TMP_InputField _loginPasswordInput;
        [SerializeField] private Button _loginButton;
        [SerializeField] private Button _switchToRegisterButton;
        [SerializeField] private TMP_Text _loginErrorText;

        [Header("Registration")]
        [SerializeField] private TMP_InputField _registerEmailInput;
        [SerializeField] private TMP_InputField _registerPasswordInput;
        [SerializeField] private TMP_InputField _registerConfirmPasswordInput;
        [SerializeField] private TMP_InputField _registerDisplayNameInput;
        [SerializeField] private Button _registerButton;
        [SerializeField] private Button _switchToLoginButton;
        [SerializeField] private TMP_Text _registerErrorText;

        [Header("Verification")]
        [SerializeField] private TMP_Text _verificationStatusText;
        [SerializeField] private GameObject _cardVerificationSection;
        [SerializeField] private Button _startCardVerificationButton;
        [SerializeField] private GameObject _idVerificationSection;
        [SerializeField] private Button _startIDVerificationButton;
        [SerializeField] private TMP_Text _verificationErrorText;
        [SerializeField] private Button _retryVerificationButton;
        [SerializeField] private Button _logoutButton;

        [Header("Loading")]
        [SerializeField] private TMP_Text _loadingText;

        // Events
        public event Action OnAuthComplete;
        public event Action OnVerificationComplete;

        private bool _isProcessing;

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
            ClearErrors();

            // Subscribe to auth events
            if (AuthManager.Instance != null)
            {
                AuthManager.Instance.OnLoggedIn += HandleLoggedIn;
                AuthManager.Instance.OnLoggedOut += HandleLoggedOut;
                AuthManager.Instance.OnVerificationStatusUpdated += HandleVerificationStatusUpdated;
                AuthManager.Instance.OnAuthError += HandleAuthError;
            }
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;

            if (AuthManager.Instance != null)
            {
                AuthManager.Instance.OnLoggedIn -= HandleLoggedIn;
                AuthManager.Instance.OnLoggedOut -= HandleLoggedOut;
                AuthManager.Instance.OnVerificationStatusUpdated -= HandleVerificationStatusUpdated;
                AuthManager.Instance.OnAuthError -= HandleAuthError;
            }
        }

        private void SetupButtons()
        {
            // Login
            _loginButton?.onClick.AddListener(OnLoginClicked);
            _switchToRegisterButton?.onClick.AddListener(() => ShowPanel(_registerPanel));

            // Register
            _registerButton?.onClick.AddListener(OnRegisterClicked);
            _switchToLoginButton?.onClick.AddListener(() => ShowPanel(_loginPanel));

            // Verification
            _startCardVerificationButton?.onClick.AddListener(OnStartCardVerificationClicked);
            _startIDVerificationButton?.onClick.AddListener(OnStartIDVerificationClicked);
            _retryVerificationButton?.onClick.AddListener(OnRetryVerificationClicked);
            _logoutButton?.onClick.AddListener(OnLogoutClicked);
        }

        /// <summary>
        /// Shows the auth UI starting with login.
        /// </summary>
        public void Show()
        {
            _authRoot?.SetActive(true);

            if (AuthManager.Instance?.IsLoggedIn == true)
            {
                if (AuthManager.Instance.IsVerified)
                {
                    Hide();
                    OnAuthComplete?.Invoke();
                }
                else
                {
                    ShowPanel(_verificationPanel);
                }
            }
            else
            {
                ShowPanel(_loginPanel);
            }
        }

        /// <summary>
        /// Hides the auth UI.
        /// </summary>
        public void Hide()
        {
            _authRoot?.SetActive(false);
        }

        /// <summary>
        /// Shows a specific panel.
        /// </summary>
        public void ShowPanel(GameObject panel)
        {
            _loginPanel?.SetActive(panel == _loginPanel);
            _registerPanel?.SetActive(panel == _registerPanel);
            _verificationPanel?.SetActive(panel == _verificationPanel);
            _loadingPanel?.SetActive(panel == _loadingPanel);

            ClearErrors();
        }

        private void ShowLoading(string message = "Loading...")
        {
            ShowPanel(_loadingPanel);
            if (_loadingText != null)
            {
                _loadingText.text = message;
            }
        }

        private void ClearErrors()
        {
            if (_loginErrorText != null) _loginErrorText.text = "";
            if (_registerErrorText != null) _registerErrorText.text = "";
            if (_verificationErrorText != null) _verificationErrorText.text = "";
        }

        // ==================== Login ====================

        private async void OnLoginClicked()
        {
            if (_isProcessing) return;

            string email = _loginEmailInput?.text?.Trim();
            string password = _loginPasswordInput?.text;

            // Validate
            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password))
            {
                ShowLoginError("Please enter email and password");
                return;
            }

            if (!IsValidEmail(email))
            {
                ShowLoginError("Please enter a valid email address");
                return;
            }

            _isProcessing = true;
            ShowLoading("Logging in...");

            bool success = await AuthManager.Instance.LoginAsync(email, password);

            _isProcessing = false;

            if (!success)
            {
                ShowPanel(_loginPanel);
            }
        }

        private void ShowLoginError(string message)
        {
            if (_loginErrorText != null)
            {
                _loginErrorText.text = message;
            }
        }

        // ==================== Registration ====================

        private async void OnRegisterClicked()
        {
            if (_isProcessing) return;

            string email = _registerEmailInput?.text?.Trim();
            string password = _registerPasswordInput?.text;
            string confirmPassword = _registerConfirmPasswordInput?.text;
            string displayName = _registerDisplayNameInput?.text?.Trim();

            // Validate
            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password) ||
                string.IsNullOrEmpty(displayName))
            {
                ShowRegisterError("Please fill in all fields");
                return;
            }

            if (!IsValidEmail(email))
            {
                ShowRegisterError("Please enter a valid email address");
                return;
            }

            if (password.Length < 8)
            {
                ShowRegisterError("Password must be at least 8 characters");
                return;
            }

            if (password != confirmPassword)
            {
                ShowRegisterError("Passwords do not match");
                return;
            }

            if (displayName.Length < 2)
            {
                ShowRegisterError("Display name must be at least 2 characters");
                return;
            }

            _isProcessing = true;
            ShowLoading("Creating account...");

            bool success = await AuthManager.Instance.RegisterAsync(email, password, displayName);

            _isProcessing = false;

            if (!success)
            {
                ShowPanel(_registerPanel);
            }
        }

        private void ShowRegisterError(string message)
        {
            if (_registerErrorText != null)
            {
                _registerErrorText.text = message;
            }
        }

        // ==================== Verification ====================

        private async void OnStartCardVerificationClicked()
        {
            if (_isProcessing) return;

            _isProcessing = true;
            ShowLoading("Starting card verification...");

            string clientSecret = await AuthManager.Instance.InitiateCardVerificationAsync();

            _isProcessing = false;

            if (!string.IsNullOrEmpty(clientSecret))
            {
                // In a real implementation, this would:
                // 1. Open Stripe Elements UI or WebView
                // 2. User enters card details
                // 3. Stripe confirms the SetupIntent
                // 4. We call ConfirmCardVerificationAsync with the SetupIntent ID

                // For now, show instructions
                ShowVerificationError("Card verification requires Stripe integration. SetupIntent created.");
                ShowPanel(_verificationPanel);

                // Simulate success for testing
                // await AuthManager.Instance.ConfirmCardVerificationAsync("seti_xxx");
            }
            else
            {
                ShowPanel(_verificationPanel);
            }
        }

        private async void OnStartIDVerificationClicked()
        {
            if (_isProcessing) return;

            _isProcessing = true;
            ShowLoading("Starting ID verification...");

            string redirectUrl = await AuthManager.Instance.InitiateIDVerificationAsync();

            _isProcessing = false;

            if (!string.IsNullOrEmpty(redirectUrl))
            {
                // Open Jumio verification
                // In VR, this would typically:
                // 1. Open a WebView overlay
                // 2. Or instruct user to complete on their phone

                Application.OpenURL(redirectUrl);

                ShowVerificationError("Please complete ID verification in your browser. Refresh status when done.");
                ShowPanel(_verificationPanel);
            }
            else
            {
                ShowPanel(_verificationPanel);
            }
        }

        private async void OnRetryVerificationClicked()
        {
            if (_isProcessing) return;

            _isProcessing = true;
            ShowLoading("Retrying verification...");

            await AuthManager.Instance.RetryVerificationAsync();

            _isProcessing = false;
            ShowPanel(_verificationPanel);
        }

        private void OnLogoutClicked()
        {
            AuthManager.Instance?.Logout();
        }

        private void ShowVerificationError(string message)
        {
            if (_verificationErrorText != null)
            {
                _verificationErrorText.text = message;
            }
        }

        private void UpdateVerificationUI(VerificationStatusResponse status)
        {
            if (status == null) return;

            // Status text
            if (_verificationStatusText != null)
            {
                _verificationStatusText.text = status.status switch
                {
                    "PENDING" => "Verification in progress",
                    "VERIFIED" => "Verified! You're ready to drift.",
                    "REJECTED" => $"Verification rejected: {status.rejection_reason}",
                    "MANUAL_REVIEW" => "Your verification is under review",
                    _ => "Unknown status"
                };
            }

            // Card section
            if (_cardVerificationSection != null)
            {
                _cardVerificationSection.SetActive(!status.card_verified);
            }

            // ID section (only show after card is verified)
            if (_idVerificationSection != null)
            {
                _idVerificationSection.SetActive(status.card_verified && !status.id_verified);
            }

            // Retry button
            if (_retryVerificationButton != null)
            {
                _retryVerificationButton.gameObject.SetActive(status.can_retry);
            }
        }

        // ==================== Event Handlers ====================

        private void HandleLoggedIn()
        {
            if (AuthManager.Instance.IsVerified)
            {
                Hide();
                OnAuthComplete?.Invoke();
            }
            else
            {
                ShowPanel(_verificationPanel);
            }
        }

        private void HandleLoggedOut()
        {
            ClearInputs();
            ShowPanel(_loginPanel);
        }

        private void HandleVerificationStatusUpdated(VerificationStatusResponse status)
        {
            UpdateVerificationUI(status);

            if (status.status == "VERIFIED")
            {
                Hide();
                OnVerificationComplete?.Invoke();
                OnAuthComplete?.Invoke();
            }
        }

        private void HandleAuthError(string error)
        {
            if (_loginPanel != null && _loginPanel.activeSelf)
            {
                ShowLoginError(error);
            }
            else if (_registerPanel != null && _registerPanel.activeSelf)
            {
                ShowRegisterError(error);
            }
            else if (_verificationPanel != null && _verificationPanel.activeSelf)
            {
                ShowVerificationError(error);
            }
        }

        private void ClearInputs()
        {
            if (_loginEmailInput != null) _loginEmailInput.text = "";
            if (_loginPasswordInput != null) _loginPasswordInput.text = "";
            if (_registerEmailInput != null) _registerEmailInput.text = "";
            if (_registerPasswordInput != null) _registerPasswordInput.text = "";
            if (_registerConfirmPasswordInput != null) _registerConfirmPasswordInput.text = "";
            if (_registerDisplayNameInput != null) _registerDisplayNameInput.text = "";
        }

        private bool IsValidEmail(string email)
        {
            if (string.IsNullOrEmpty(email)) return false;

            try
            {
                var addr = new System.Net.Mail.MailAddress(email);
                return addr.Address == email;
            }
            catch
            {
                return email.Contains("@") && email.Contains(".");
            }
        }

        /// <summary>
        /// Refreshes the verification status from the server.
        /// </summary>
        public async void RefreshVerificationStatus()
        {
            if (_isProcessing) return;

            _isProcessing = true;
            ShowLoading("Checking status...");

            await AuthManager.Instance.GetVerificationStatusAsync();

            _isProcessing = false;
            ShowPanel(_verificationPanel);
        }
    }
}
