using UnityEngine;
using System;
using System.Threading.Tasks;
using Drift.Core;

namespace Drift.API
{
    /// <summary>
    /// Service for triggering push notifications to companions and other users.
    /// Notifications are sent via the backend which handles FCM/APNs delivery.
    /// </summary>
    public class NotificationService : MonoBehaviour
    {
        public static NotificationService Instance { get; private set; }

        [Header("Settings")]
        [SerializeField] private bool _notificationsEnabled = true;
        [SerializeField] private float _notificationCooldown = 30f; // Prevent spam

        // Cooldown tracking
        private float _lastSessionStartNotification;
        private float _lastMatchFoundNotification;

        // Events
        public event Action<NotificationResult> OnNotificationSent;
        public event Action<string> OnNotificationError;

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
            SubscribeToEvents();
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
            UnsubscribeFromEvents();
        }

        private void SubscribeToEvents()
        {
            // Auto-notify on session events
            var sessionManager = SessionManager.Instance;
            if (sessionManager != null)
            {
                sessionManager.OnStateChanged += HandleSessionStateChanged;
            }

            // Auto-notify on companion session events
            var companionManager = CompanionSessionManager.Instance;
            if (companionManager != null)
            {
                companionManager.OnSessionCreated += HandleCompanionSessionCreated;
            }
        }

        private void UnsubscribeFromEvents()
        {
            var sessionManager = SessionManager.Instance;
            if (sessionManager != null)
            {
                sessionManager.OnStateChanged -= HandleSessionStateChanged;
            }

            var companionManager = CompanionSessionManager.Instance;
            if (companionManager != null)
            {
                companionManager.OnSessionCreated -= HandleCompanionSessionCreated;
            }
        }

        // ==========================================================================
        // Auto Notification Triggers
        // ==========================================================================

        private void HandleSessionStateChanged(SessionState state)
        {
            switch (state)
            {
                case SessionState.InPublicLounge:
                    // Notify companions that VR session started
                    _ = NotifyCompanionsSessionStarted();
                    break;

                case SessionState.MatchFound:
                    // Could notify friends about match (optional)
                    break;

                case SessionState.InPrivateBooth:
                    // Notify companions about booth entry
                    _ = NotifyCompanionsEnteredBooth();
                    break;
            }
        }

        private void HandleCompanionSessionCreated(SessionInfo session)
        {
            // Session created - companions will be notified via WebSocket
            // But we can also send push to offline friends
            _ = NotifyFriendsSessionAvailable(session.session.session_code);
        }

        // ==========================================================================
        // Public Notification Methods
        // ==========================================================================

        /// <summary>
        /// Notifies all companions that VR session has started.
        /// </summary>
        public async Task<NotificationResult> NotifyCompanionsSessionStarted()
        {
            if (!_notificationsEnabled) return new NotificationResult { success = false };

            // Check cooldown
            if (Time.time - _lastSessionStartNotification < _notificationCooldown)
            {
                return new NotificationResult { success = false, error = "Cooldown active" };
            }

            _lastSessionStartNotification = Time.time;

            var request = new SendNotificationRequest
            {
                notification_type = NotificationType.SessionStarted,
                title = "VR Session Started",
                body = $"{GameManager.Instance?.UserDisplayName ?? "Your friend"} is now in VR!",
                data = new NotificationData
                {
                    session_code = CompanionSessionManager.Instance?.SessionCode,
                    user_id = GameManager.Instance?.UserId
                }
            };

            return await SendNotificationToCompanions(request);
        }

        /// <summary>
        /// Notifies companions that user entered private booth.
        /// </summary>
        public async Task<NotificationResult> NotifyCompanionsEnteredBooth()
        {
            if (!_notificationsEnabled) return new NotificationResult { success = false };

            var partner = SessionManager.Instance?.Partner;
            string partnerName = partner?.DisplayName ?? "someone";

            var request = new SendNotificationRequest
            {
                notification_type = NotificationType.EnteredBooth,
                title = "Private Session",
                body = $"Now in a private booth with {partnerName}",
                data = new NotificationData
                {
                    session_code = CompanionSessionManager.Instance?.SessionCode,
                    partner_name = partnerName
                }
            };

            return await SendNotificationToCompanions(request);
        }

        /// <summary>
        /// Notifies friends that a companion session is available to join.
        /// </summary>
        public async Task<NotificationResult> NotifyFriendsSessionAvailable(string sessionCode)
        {
            if (!_notificationsEnabled) return new NotificationResult { success = false };

            var request = new SendNotificationRequest
            {
                notification_type = NotificationType.SessionAvailable,
                title = "Join VR Session",
                body = $"{GameManager.Instance?.UserDisplayName ?? "A friend"} invites you to join their VR session",
                data = new NotificationData
                {
                    session_code = sessionCode,
                    user_id = GameManager.Instance?.UserId
                },
                target = NotificationTarget.Friends
            };

            return await SendNotification(request);
        }

        /// <summary>
        /// Sends a custom notification to specific users.
        /// </summary>
        public async Task<NotificationResult> NotifyUsers(string[] userIds, string title, string body, NotificationData data = null)
        {
            if (!_notificationsEnabled) return new NotificationResult { success = false };

            var request = new SendNotificationRequest
            {
                notification_type = NotificationType.Custom,
                title = title,
                body = body,
                data = data,
                target = NotificationTarget.Specific,
                target_user_ids = userIds
            };

            return await SendNotification(request);
        }

        /// <summary>
        /// Sends haptic notification to a companion (prompts them to open app).
        /// </summary>
        public async Task<NotificationResult> SendHapticNotification(string userId, float intensity)
        {
            if (!_notificationsEnabled) return new NotificationResult { success = false };

            var request = new SendNotificationRequest
            {
                notification_type = NotificationType.HapticPing,
                title = "Feel this!",
                body = $"{GameManager.Instance?.UserDisplayName ?? "Someone"} sent you a haptic",
                data = new NotificationData
                {
                    haptic_intensity = intensity,
                    session_code = CompanionSessionManager.Instance?.SessionCode
                },
                target = NotificationTarget.Specific,
                target_user_ids = new[] { userId }
            };

            return await SendNotification(request);
        }

        // ==========================================================================
        // Internal Methods
        // ==========================================================================

        private async Task<NotificationResult> SendNotificationToCompanions(SendNotificationRequest request)
        {
            request.target = NotificationTarget.Companions;
            request.session_id = CompanionSessionManager.Instance?.SessionId;
            return await SendNotification(request);
        }

        private async Task<NotificationResult> SendNotification(SendNotificationRequest request)
        {
            try
            {
                var response = await ApiClient.Instance.PostAsync<NotificationResult>(
                    "/v1/notifications/send",
                    request
                );

                if (response != null)
                {
                    if (response.success)
                    {
                        OnNotificationSent?.Invoke(response);
                        Debug.Log($"[NotificationService] Notification sent: {request.notification_type}");
                    }
                    else
                    {
                        OnNotificationError?.Invoke(response.error ?? "Unknown error");
                    }
                    return response;
                }

                return new NotificationResult { success = false, error = "No response" };
            }
            catch (Exception ex)
            {
                Debug.LogError($"[NotificationService] Send failed: {ex.Message}");
                OnNotificationError?.Invoke(ex.Message);
                return new NotificationResult { success = false, error = ex.Message };
            }
        }

        /// <summary>
        /// Enables or disables notifications.
        /// </summary>
        public void SetNotificationsEnabled(bool enabled)
        {
            _notificationsEnabled = enabled;
            PlayerPrefs.SetInt("notifications_enabled", enabled ? 1 : 0);
            PlayerPrefs.Save();
        }

        public bool AreNotificationsEnabled => _notificationsEnabled;
    }

    // ==========================================================================
    // Data Models
    // ==========================================================================

    public enum NotificationType
    {
        SessionStarted,
        SessionEnded,
        EnteredBooth,
        LeftBooth,
        MatchFound,
        SessionAvailable,
        HapticPing,
        CompanionJoined,
        CompanionLeft,
        Custom
    }

    public enum NotificationTarget
    {
        Companions,     // All companions in current session
        Friends,        // All friends
        Specific        // Specific user IDs
    }

    [Serializable]
    public class SendNotificationRequest
    {
        public NotificationType notification_type;
        public string title;
        public string body;
        public NotificationData data;
        public NotificationTarget target;
        public string session_id;
        public string[] target_user_ids;
    }

    [Serializable]
    public class NotificationData
    {
        public string session_code;
        public string user_id;
        public string partner_name;
        public float haptic_intensity;
        public string action; // deeplink action
    }

    [Serializable]
    public class NotificationResult
    {
        public bool success;
        public int sent_count;
        public string error;
        public string notification_id;
    }
}
