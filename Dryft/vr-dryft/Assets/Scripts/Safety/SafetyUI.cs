using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System;
using Drift.Core;

namespace Drift.Safety
{
    /// <summary>
    /// UI component for safety features - panic button and report dialog.
    ///
    /// LEGAL NOTE: The panic button must ALWAYS be visible and accessible
    /// in VR sessions. It cannot be hidden, disabled, or obstructed.
    /// </summary>
    public class SafetyUI : MonoBehaviour
    {
        public static SafetyUI Instance { get; private set; }

        [Header("Panic Button")]
        [SerializeField] private GameObject _panicButtonObject;
        [SerializeField] private Button _panicButton;
        [SerializeField] private Image _panicButtonImage;
        [SerializeField] private TMP_Text _panicButtonText;
        [SerializeField] private Color _panicNormalColor = Color.red;
        [SerializeField] private Color _panicActiveColor = new Color(1f, 0.5f, 0f);

        [Header("Panic Overlay")]
        [SerializeField] private GameObject _panicOverlay;
        [SerializeField] private TMP_Text _panicOverlayText;
        [SerializeField] private float _overlayFadeDuration = 0.5f;
        [SerializeField] private CanvasGroup _panicOverlayCanvasGroup;

        [Header("Report Dialog")]
        [SerializeField] private GameObject _reportDialog;
        [SerializeField] private TMP_Text _reportTitleText;
        [SerializeField] private TMP_Text _reportUserText;
        [SerializeField] private TMP_Dropdown _reportReasonDropdown;
        [SerializeField] private TMP_InputField _reportDetailsInput;
        [SerializeField] private Toggle _reportAutoBlockToggle;
        [SerializeField] private Button _reportSubmitButton;
        [SerializeField] private Button _reportCancelButton;
        [SerializeField] private TMP_Text _reportStatusText;

        [Header("Block Confirmation")]
        [SerializeField] private GameObject _blockConfirmDialog;
        [SerializeField] private TMP_Text _blockConfirmText;
        [SerializeField] private Button _blockConfirmButton;
        [SerializeField] private Button _blockCancelButton;

        [Header("Blocked Users Panel")]
        [SerializeField] private GameObject _blockedUsersPanel;
        [SerializeField] private Transform _blockedUsersContainer;
        [SerializeField] private GameObject _blockedUserItemPrefab;
        [SerializeField] private Button _blockedUsersPanelClose;

        [Header("Safety Menu Button")]
        [SerializeField] private Button _safetyMenuButton;
        [SerializeField] private GameObject _safetyMenuPanel;
        [SerializeField] private Button _viewBlockedButton;
        [SerializeField] private Button _reportPartnerButton;

        // State
        private string _pendingReportUserId;
        private string _pendingBlockUserId;
        private Action<bool> _blockConfirmCallback;

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
            SetupDropdown();
            SubscribeToEvents();

            // Hide dialogs initially
            _reportDialog?.SetActive(false);
            _blockConfirmDialog?.SetActive(false);
            _blockedUsersPanel?.SetActive(false);
            _panicOverlay?.SetActive(false);
            _safetyMenuPanel?.SetActive(false);

            // Panic button always visible
            EnsurePanicButtonVisible();
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
            UnsubscribeFromEvents();
        }

        private void SetupButtons()
        {
            if (_panicButton != null)
                _panicButton.onClick.AddListener(OnPanicButtonClicked);

            if (_reportSubmitButton != null)
                _reportSubmitButton.onClick.AddListener(OnReportSubmitClicked);

            if (_reportCancelButton != null)
                _reportCancelButton.onClick.AddListener(CloseReportDialog);

            if (_blockConfirmButton != null)
                _blockConfirmButton.onClick.AddListener(OnBlockConfirmClicked);

            if (_blockCancelButton != null)
                _blockCancelButton.onClick.AddListener(CloseBlockConfirmDialog);

            if (_safetyMenuButton != null)
                _safetyMenuButton.onClick.AddListener(ToggleSafetyMenu);

            if (_viewBlockedButton != null)
                _viewBlockedButton.onClick.AddListener(ShowBlockedUsersPanel);

            if (_reportPartnerButton != null)
                _reportPartnerButton.onClick.AddListener(OnReportPartnerClicked);

            if (_blockedUsersPanelClose != null)
                _blockedUsersPanelClose.onClick.AddListener(CloseBlockedUsersPanel);
        }

        private void SetupDropdown()
        {
            if (_reportReasonDropdown == null) return;

            _reportReasonDropdown.ClearOptions();
            _reportReasonDropdown.AddOptions(new System.Collections.Generic.List<string>
            {
                "Select reason...",
                "Harassment",
                "Inappropriate behavior",
                "Non-consensual actions",
                "Spam/Advertising",
                "Underage user",
                "Other"
            });
        }

        private void SubscribeToEvents()
        {
            var safety = SafetyManager.Instance;
            if (safety != null)
            {
                safety.OnPanicActivated += HandlePanicActivated;
                safety.OnPanicDeactivated += HandlePanicDeactivated;
                safety.OnUserBlocked += HandleUserBlocked;
                safety.OnReportSubmitted += HandleReportSubmitted;
                safety.OnSafetyError += HandleSafetyError;
            }
        }

        private void UnsubscribeFromEvents()
        {
            var safety = SafetyManager.Instance;
            if (safety != null)
            {
                safety.OnPanicActivated -= HandlePanicActivated;
                safety.OnPanicDeactivated -= HandlePanicDeactivated;
                safety.OnUserBlocked -= HandleUserBlocked;
                safety.OnReportSubmitted -= HandleReportSubmitted;
                safety.OnSafetyError -= HandleSafetyError;
            }
        }

        // ==========================================================================
        // Panic Button
        // ==========================================================================

        /// <summary>
        /// Ensures panic button is always visible when in a VR session.
        /// LEGAL NOTE: This cannot be overridden or disabled.
        /// </summary>
        public void EnsurePanicButtonVisible()
        {
            if (_panicButtonObject == null) return;

            var gameState = GameManager.Instance?.CurrentState;
            bool inSession = gameState == GameState.InPublicLounge ||
                            gameState == GameState.InPrivateBooth;

            _panicButtonObject.SetActive(inSession);
        }

        private void OnPanicButtonClicked()
        {
            SafetyManager.Instance?.ActivatePanic();
        }

        private void HandlePanicActivated()
        {
            // Show panic overlay
            if (_panicOverlay != null)
            {
                _panicOverlay.SetActive(true);
                if (_panicOverlayCanvasGroup != null)
                {
                    _panicOverlayCanvasGroup.alpha = 1f;
                }
            }

            if (_panicOverlayText != null)
            {
                _panicOverlayText.text = "EXITING TO SAFETY...";
            }

            // Update button visual
            if (_panicButtonImage != null)
            {
                _panicButtonImage.color = _panicActiveColor;
            }
        }

        private void HandlePanicDeactivated()
        {
            // Fade out overlay
            if (_panicOverlay != null)
            {
                StartCoroutine(FadeOutOverlay());
            }

            // Reset button visual
            if (_panicButtonImage != null)
            {
                _panicButtonImage.color = _panicNormalColor;
            }

            EnsurePanicButtonVisible();
        }

        private System.Collections.IEnumerator FadeOutOverlay()
        {
            if (_panicOverlayCanvasGroup != null)
            {
                float elapsed = 0f;
                while (elapsed < _overlayFadeDuration)
                {
                    elapsed += Time.deltaTime;
                    _panicOverlayCanvasGroup.alpha = 1f - (elapsed / _overlayFadeDuration);
                    yield return null;
                }
            }

            _panicOverlay?.SetActive(false);
        }

        // ==========================================================================
        // Report Dialog
        // ==========================================================================

        /// <summary>
        /// Opens the report dialog for a specific user.
        /// </summary>
        public void ShowReportDialog(string userId, string displayName)
        {
            _pendingReportUserId = userId;

            if (_reportTitleText != null)
                _reportTitleText.text = "Report User";

            if (_reportUserText != null)
                _reportUserText.text = $"Reporting: {displayName}";

            if (_reportReasonDropdown != null)
                _reportReasonDropdown.value = 0;

            if (_reportDetailsInput != null)
                _reportDetailsInput.text = "";

            if (_reportAutoBlockToggle != null)
                _reportAutoBlockToggle.isOn = true;

            if (_reportStatusText != null)
                _reportStatusText.text = "";

            _reportDialog?.SetActive(true);
        }

        /// <summary>
        /// Opens report dialog for current partner.
        /// </summary>
        public void ShowReportDialogForPartner()
        {
            var partner = SessionManager.Instance?.Partner;
            if (partner != null)
            {
                ShowReportDialog(partner.UserId, partner.DisplayName);
            }
        }

        private void OnReportPartnerClicked()
        {
            CloseSafetyMenu();
            ShowReportDialogForPartner();
        }

        private async void OnReportSubmitClicked()
        {
            if (string.IsNullOrEmpty(_pendingReportUserId))
            {
                ShowReportStatus("Error: No user selected", true);
                return;
            }

            int reasonIndex = _reportReasonDropdown?.value ?? 0;
            if (reasonIndex == 0)
            {
                ShowReportStatus("Please select a reason", true);
                return;
            }

            string[] reasons = { "", "harassment", "inappropriate", "non_consensual", "spam", "underage", "other" };
            string reason = reasons[reasonIndex];

            var report = new ReportRequest
            {
                reported_user_id = _pendingReportUserId,
                reason = reason,
                details = _reportDetailsInput?.text ?? "",
                session_id = SessionManager.Instance?.CurrentSessionId,
                auto_block = _reportAutoBlockToggle?.isOn ?? true
            };

            // Disable button while submitting
            if (_reportSubmitButton != null)
                _reportSubmitButton.interactable = false;

            ShowReportStatus("Submitting report...", false);

            var result = await SafetyManager.Instance.ReportUser(report);

            if (_reportSubmitButton != null)
                _reportSubmitButton.interactable = true;

            if (result.success)
            {
                ShowReportStatus("Report submitted. Thank you.", false);
                Invoke(nameof(CloseReportDialog), 2f);
            }
            else
            {
                ShowReportStatus($"Error: {result.error}", true);
            }
        }

        private void ShowReportStatus(string message, bool isError)
        {
            if (_reportStatusText != null)
            {
                _reportStatusText.text = message;
                _reportStatusText.color = isError ? Color.red : Color.green;
            }
        }

        public void CloseReportDialog()
        {
            _reportDialog?.SetActive(false);
            _pendingReportUserId = null;
        }

        private void HandleReportSubmitted(ReportResult result)
        {
            Debug.Log($"[SafetyUI] Report submitted: {result.report_id}");
        }

        // ==========================================================================
        // Block Confirmation
        // ==========================================================================

        /// <summary>
        /// Shows block confirmation dialog.
        /// </summary>
        public void ShowBlockConfirmDialog(string userId, string displayName, Action<bool> callback = null)
        {
            _pendingBlockUserId = userId;
            _blockConfirmCallback = callback;

            if (_blockConfirmText != null)
            {
                _blockConfirmText.text = $"Block {displayName}?\n\nYou won't see or interact with this user anymore.";
            }

            _blockConfirmDialog?.SetActive(true);
        }

        private async void OnBlockConfirmClicked()
        {
            if (string.IsNullOrEmpty(_pendingBlockUserId))
            {
                CloseBlockConfirmDialog();
                return;
            }

            bool success = await SafetyManager.Instance.BlockUser(_pendingBlockUserId);
            _blockConfirmCallback?.Invoke(success);
            CloseBlockConfirmDialog();
        }

        public void CloseBlockConfirmDialog()
        {
            _blockConfirmDialog?.SetActive(false);
            _pendingBlockUserId = null;
            _blockConfirmCallback = null;
        }

        private void HandleUserBlocked(string userId)
        {
            Debug.Log($"[SafetyUI] User blocked: {userId}");
            RefreshBlockedUsersList();
        }

        // ==========================================================================
        // Blocked Users Panel
        // ==========================================================================

        public async void ShowBlockedUsersPanel()
        {
            CloseSafetyMenu();
            _blockedUsersPanel?.SetActive(true);
            await RefreshBlockedUsersList();
        }

        public void CloseBlockedUsersPanel()
        {
            _blockedUsersPanel?.SetActive(false);
        }

        private async System.Threading.Tasks.Task RefreshBlockedUsersList()
        {
            if (_blockedUsersContainer == null) return;

            // Clear existing items
            foreach (Transform child in _blockedUsersContainer)
            {
                Destroy(child.gameObject);
            }

            var blockedUsers = await SafetyManager.Instance.GetBlockedUsers();

            if (blockedUsers == null || blockedUsers.Count == 0)
            {
                // Show empty state
                if (_blockedUserItemPrefab != null)
                {
                    var emptyItem = Instantiate(_blockedUserItemPrefab, _blockedUsersContainer);
                    var text = emptyItem.GetComponentInChildren<TMP_Text>();
                    if (text != null)
                        text.text = "No blocked users";

                    var button = emptyItem.GetComponentInChildren<Button>();
                    if (button != null)
                        button.gameObject.SetActive(false);
                }
                return;
            }

            foreach (var user in blockedUsers)
            {
                CreateBlockedUserItem(user);
            }
        }

        private void CreateBlockedUserItem(BlockedUserInfo user)
        {
            if (_blockedUserItemPrefab == null || _blockedUsersContainer == null) return;

            var item = Instantiate(_blockedUserItemPrefab, _blockedUsersContainer);

            var text = item.GetComponentInChildren<TMP_Text>();
            if (text != null)
            {
                text.text = user.display_name ?? user.user_id;
            }

            var button = item.GetComponentInChildren<Button>();
            if (button != null)
            {
                string userId = user.user_id;
                button.onClick.AddListener(() => OnUnblockClicked(userId));

                var buttonText = button.GetComponentInChildren<TMP_Text>();
                if (buttonText != null)
                    buttonText.text = "Unblock";
            }
        }

        private async void OnUnblockClicked(string userId)
        {
            bool success = await SafetyManager.Instance.UnblockUser(userId);
            if (success)
            {
                await RefreshBlockedUsersList();
            }
        }

        // ==========================================================================
        // Safety Menu
        // ==========================================================================

        public void ToggleSafetyMenu()
        {
            if (_safetyMenuPanel == null) return;

            bool isActive = _safetyMenuPanel.activeSelf;
            _safetyMenuPanel.SetActive(!isActive);

            // Update report partner button visibility
            if (_reportPartnerButton != null)
            {
                bool hasPartner = SessionManager.Instance?.Partner != null;
                _reportPartnerButton.interactable = hasPartner;
            }
        }

        public void CloseSafetyMenu()
        {
            _safetyMenuPanel?.SetActive(false);
        }

        // ==========================================================================
        // Error Handling
        // ==========================================================================

        private void HandleSafetyError(string error)
        {
            Debug.LogError($"[SafetyUI] Safety error: {error}");
            // Could show toast notification
        }

        // ==========================================================================
        // Update Loop
        // ==========================================================================

        private void Update()
        {
            // Keep panic button visibility updated
            EnsurePanicButtonVisible();
        }
    }
}
