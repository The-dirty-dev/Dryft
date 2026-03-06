using UnityEngine;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Drift.Core;
using Drift.Player;
using Drift.Environment;
using Drift.API;

namespace Drift.Safety
{
    /// <summary>
    /// Manages user safety features including blocking, reporting, and panic button.
    ///
    /// LEGAL NOTE: Safety features must always be accessible and functional.
    /// Users can exit any situation immediately via the panic button.
    /// All reports are logged and reviewed by moderation team.
    /// </summary>
    public class SafetyManager : MonoBehaviour
    {
        public static SafetyManager Instance { get; private set; }

        [Header("Panic Button")]
        [SerializeField] private KeyCode _panicKeycode = KeyCode.Escape;
        [SerializeField] private OVRInput.Button _panicVRButton = OVRInput.Button.Start;
        [SerializeField] private float _panicHoldTime = 0f; // Instant by default
        [SerializeField] private bool _vibrateOnPanic = true;

        [Header("Block Settings")]
        [SerializeField] private int _maxBlockedUsers = 1000;

        [Header("Audio")]
        [SerializeField] private AudioSource _safetyAudioSource;
        [SerializeField] private AudioClip _panicSound;
        [SerializeField] private AudioClip _blockSound;

        // State
        public bool IsPanicModeActive { get; private set; }
        public HashSet<string> BlockedUserIds { get; private set; } = new();

        // Events
        public event Action OnPanicActivated;
        public event Action OnPanicDeactivated;
        public event Action<string> OnUserBlocked;
        public event Action<string> OnUserUnblocked;
        public event Action<ReportResult> OnReportSubmitted;
        public event Action<string> OnSafetyError;

        private float _panicHoldTimer;
        private bool _isPanicHeld;
        private SafetyApiService _apiService;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            _apiService = new SafetyApiService();
        }

        private async void Start()
        {
            // Load blocked users from server
            await LoadBlockedUsers();
        }

        private void Update()
        {
            CheckPanicButton();
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        // ==========================================================================
        // Panic Button
        // ==========================================================================

        private void CheckPanicButton()
        {
            // Check keyboard
            bool keyPressed = Input.GetKey(_panicKeycode);

            // Check VR controller
            bool vrPressed = OVRInput.Get(_panicVRButton, OVRInput.Controller.LTouch) ||
                            OVRInput.Get(_panicVRButton, OVRInput.Controller.RTouch);

            bool isPanicPressed = keyPressed || vrPressed;

            if (isPanicPressed)
            {
                if (!_isPanicHeld)
                {
                    _isPanicHeld = true;
                    _panicHoldTimer = 0f;
                }

                _panicHoldTimer += Time.deltaTime;

                if (_panicHoldTimer >= _panicHoldTime)
                {
                    ActivatePanic();
                    _isPanicHeld = false;
                }
            }
            else
            {
                _isPanicHeld = false;
                _panicHoldTimer = 0f;
            }
        }

        /// <summary>
        /// Activates panic mode - immediately exits current session and returns to safe state.
        /// LEGAL NOTE: This must ALWAYS work. No conditions or restrictions.
        /// </summary>
        public void ActivatePanic()
        {
            if (IsPanicModeActive) return;

            Debug.Log("[SafetyManager] PANIC ACTIVATED");
            IsPanicModeActive = true;

            // Play sound
            if (_safetyAudioSource != null && _panicSound != null)
            {
                _safetyAudioSource.PlayOneShot(_panicSound);
            }

            // Vibrate controller
            if (_vibrateOnPanic)
            {
                OVRInput.SetControllerVibration(1f, 1f, OVRInput.Controller.LTouch);
                OVRInput.SetControllerVibration(1f, 1f, OVRInput.Controller.RTouch);
                Invoke(nameof(StopVibration), 0.5f);
            }

            // Immediate actions
            PerformPanicExit();

            OnPanicActivated?.Invoke();

            // Reset panic mode after a delay
            Invoke(nameof(ResetPanicMode), 2f);
        }

        private void PerformPanicExit()
        {
            // 1. Revoke all consents
            InteractionManager.Instance?.RevokeAllConsent();

            // 2. Clear partner
            InteractionManager.Instance?.ClearPartner();

            // 3. Emergency exit from booth
            BoothManager.Instance?.EmergencyExit();

            // 4. End companion session
            CompanionSessionManager.Instance?.EndSession();

            // 5. Leave any room
            DriftRealtime.Instance?.LeaveRoom();

            // 6. Return to safe state
            GameManager.Instance?.LeaveVRSpace();

            // 7. Log panic event (async, don't await)
            _ = _apiService.LogPanicEvent();
        }

        private void StopVibration()
        {
            OVRInput.SetControllerVibration(0, 0, OVRInput.Controller.LTouch);
            OVRInput.SetControllerVibration(0, 0, OVRInput.Controller.RTouch);
        }

        private void ResetPanicMode()
        {
            IsPanicModeActive = false;
            OnPanicDeactivated?.Invoke();
        }

        // ==========================================================================
        // Block/Unblock Users
        // ==========================================================================

        /// <summary>
        /// Blocks a user. They will be hidden and unable to interact.
        /// </summary>
        public async Task<bool> BlockUser(string userId, string reason = "")
        {
            if (string.IsNullOrEmpty(userId))
            {
                Debug.LogWarning("[SafetyManager] Cannot block empty user ID");
                return false;
            }

            if (BlockedUserIds.Contains(userId))
            {
                Debug.Log($"[SafetyManager] User already blocked: {userId}");
                return true;
            }

            // Block on server
            bool success = await _apiService.BlockUser(userId, reason);

            if (success)
            {
                // Add to local cache
                BlockedUserIds.Add(userId);
                SaveBlockedUsersLocal();

                // Play sound
                if (_safetyAudioSource != null && _blockSound != null)
                {
                    _safetyAudioSource.PlayOneShot(_blockSound);
                }

                // If currently in session with this user, exit
                if (SessionManager.Instance?.Partner?.UserId == userId)
                {
                    Debug.Log("[SafetyManager] Blocked current partner, exiting session");
                    SessionManager.Instance.LeaveSession();
                }

                OnUserBlocked?.Invoke(userId);
                Debug.Log($"[SafetyManager] User blocked: {userId}");
            }
            else
            {
                OnSafetyError?.Invoke("Failed to block user");
            }

            return success;
        }

        /// <summary>
        /// Unblocks a user.
        /// </summary>
        public async Task<bool> UnblockUser(string userId)
        {
            if (!BlockedUserIds.Contains(userId))
            {
                return true;
            }

            bool success = await _apiService.UnblockUser(userId);

            if (success)
            {
                BlockedUserIds.Remove(userId);
                SaveBlockedUsersLocal();

                OnUserUnblocked?.Invoke(userId);
                Debug.Log($"[SafetyManager] User unblocked: {userId}");
            }
            else
            {
                OnSafetyError?.Invoke("Failed to unblock user");
            }

            return success;
        }

        /// <summary>
        /// Checks if a user is blocked.
        /// </summary>
        public bool IsUserBlocked(string userId)
        {
            return BlockedUserIds.Contains(userId);
        }

        /// <summary>
        /// Gets list of blocked users from server.
        /// </summary>
        public async Task<List<BlockedUserInfo>> GetBlockedUsers()
        {
            return await _apiService.GetBlockedUsers();
        }

        private async Task LoadBlockedUsers()
        {
            // Load from local cache first
            LoadBlockedUsersLocal();

            // Then sync with server
            try
            {
                var serverBlocked = await _apiService.GetBlockedUsers();
                if (serverBlocked != null)
                {
                    BlockedUserIds.Clear();
                    foreach (var user in serverBlocked)
                    {
                        BlockedUserIds.Add(user.user_id);
                    }
                    SaveBlockedUsersLocal();
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[SafetyManager] Failed to sync blocked users: {ex.Message}");
            }
        }

        private void LoadBlockedUsersLocal()
        {
            string json = PlayerPrefs.GetString("blocked_users", "[]");
            try
            {
                var ids = JsonUtility.FromJson<BlockedUsersList>(json);
                if (ids?.user_ids != null)
                {
                    BlockedUserIds = new HashSet<string>(ids.user_ids);
                }
            }
            catch
            {
                BlockedUserIds = new HashSet<string>();
            }
        }

        private void SaveBlockedUsersLocal()
        {
            var list = new BlockedUsersList
            {
                user_ids = new List<string>(BlockedUserIds).ToArray()
            };
            string json = JsonUtility.ToJson(list);
            PlayerPrefs.SetString("blocked_users", json);
            PlayerPrefs.Save();
        }

        // ==========================================================================
        // Reporting
        // ==========================================================================

        /// <summary>
        /// Reports a user for inappropriate behavior.
        /// </summary>
        public async Task<ReportResult> ReportUser(ReportRequest report)
        {
            if (string.IsNullOrEmpty(report.reported_user_id))
            {
                return new ReportResult { success = false, error = "Invalid user ID" };
            }

            Debug.Log($"[SafetyManager] Reporting user: {report.reported_user_id} for {report.reason}");

            var result = await _apiService.SubmitReport(report);

            if (result.success)
            {
                // Optionally auto-block reported user
                if (report.auto_block)
                {
                    await BlockUser(report.reported_user_id, report.reason);
                }

                OnReportSubmitted?.Invoke(result);
            }
            else
            {
                OnSafetyError?.Invoke(result.error ?? "Failed to submit report");
            }

            return result;
        }

        /// <summary>
        /// Quick report for current partner.
        /// </summary>
        public async Task<ReportResult> ReportCurrentPartner(string reason, string details = "")
        {
            var partner = SessionManager.Instance?.Partner;
            if (partner == null)
            {
                return new ReportResult { success = false, error = "No current partner" };
            }

            var report = new ReportRequest
            {
                reported_user_id = partner.UserId,
                reason = reason,
                details = details,
                session_id = SessionManager.Instance.CurrentSessionId,
                auto_block = true
            };

            return await ReportUser(report);
        }

        // ==========================================================================
        // Content Moderation Helpers
        // ==========================================================================

        /// <summary>
        /// Checks if interaction with a user is allowed.
        /// </summary>
        public bool CanInteractWith(string userId)
        {
            if (string.IsNullOrEmpty(userId)) return false;
            return !IsUserBlocked(userId);
        }

        /// <summary>
        /// Filters a list of users, removing blocked ones.
        /// </summary>
        public List<T> FilterBlockedUsers<T>(List<T> users, Func<T, string> getUserId)
        {
            return users.FindAll(u => !IsUserBlocked(getUserId(u)));
        }
    }

    // ==========================================================================
    // Data Models
    // ==========================================================================

    [Serializable]
    public class BlockedUsersList
    {
        public string[] user_ids;
    }

    [Serializable]
    public class BlockedUserInfo
    {
        public string user_id;
        public string display_name;
        public string blocked_at;
        public string reason;
    }

    [Serializable]
    public class ReportRequest
    {
        public string reported_user_id;
        public string reason; // harassment, inappropriate, spam, other
        public string details;
        public string session_id;
        public bool auto_block;
        public string[] evidence_urls; // Screenshots, etc
    }

    [Serializable]
    public class ReportResult
    {
        public bool success;
        public string report_id;
        public string error;
        public string message;
    }

    // ==========================================================================
    // API Service
    // ==========================================================================

    public class SafetyApiService
    {
        public async Task<bool> BlockUser(string userId, string reason)
        {
            try
            {
                var response = await ApiClient.Instance.PostAsync<BlockResponse>(
                    "/v1/safety/block",
                    new { user_id = userId, reason = reason }
                );
                return response?.Data?.success ?? false;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[SafetyApiService] Block failed: {ex.Message}");
                return false;
            }
        }

        public async Task<bool> UnblockUser(string userId)
        {
            try
            {
                var response = await ApiClient.Instance.DeleteAsync<BlockResponse>(
                    $"/v1/safety/block/{userId}"
                );
                return response?.Data?.success ?? false;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[SafetyApiService] Unblock failed: {ex.Message}");
                return false;
            }
        }

        public async Task<List<BlockedUserInfo>> GetBlockedUsers()
        {
            try
            {
                var response = await ApiClient.Instance.GetAsync<BlockedUsersResponse>(
                    "/v1/safety/blocked"
                );
                return response?.Data?.users ?? new List<BlockedUserInfo>();
            }
            catch (Exception ex)
            {
                Debug.LogError($"[SafetyApiService] Get blocked failed: {ex.Message}");
                return new List<BlockedUserInfo>();
            }
        }

        public async Task<ReportResult> SubmitReport(ReportRequest report)
        {
            try
            {
                var response = await ApiClient.Instance.PostAsync<ReportResult>(
                    "/v1/safety/report",
                    report
                );
                return response?.Data ?? new ReportResult
                {
                    success = false,
                    error = response?.Error ?? "No response"
                };
            }
            catch (Exception ex)
            {
                Debug.LogError($"[SafetyApiService] Report failed: {ex.Message}");
                return new ReportResult { success = false, error = ex.Message };
            }
        }

        public async Task LogPanicEvent()
        {
            try
            {
                await ApiClient.Instance.PostAsync<object>(
                    "/v1/safety/panic-log",
                    new
                    {
                        timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                        session_id = SessionManager.Instance?.CurrentSessionId,
                        partner_id = SessionManager.Instance?.Partner?.UserId
                    }
                );
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[SafetyApiService] Panic log failed: {ex.Message}");
            }
        }
    }

    [Serializable]
    public class BlockResponse
    {
        public bool success;
        public string error;
    }

    [Serializable]
    public class BlockedUsersResponse
    {
        public List<BlockedUserInfo> users;
    }
}
