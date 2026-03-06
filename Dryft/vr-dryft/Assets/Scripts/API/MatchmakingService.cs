using UnityEngine;
using System;
using System.Threading.Tasks;
using Drift.Core;

namespace Drift.API
{
    /// <summary>
    /// Handles matchmaking API communication with the backend.
    /// Manages entering/leaving the matchmaking queue and receiving match notifications.
    /// </summary>
    public class MatchmakingService : MonoBehaviour
    {
        public static MatchmakingService Instance { get; private set; }

        [Header("Settings")]
        [SerializeField] private float _pollInterval = 2f;
        [SerializeField] private int _maxRetries = 3;

        // State
        public bool IsInQueue { get; private set; }
        public bool IsPolling { get; private set; }
        public MatchmakingPreferences CurrentPreferences { get; private set; }

        // Events
        public event Action OnQueueJoined;
        public event Action OnQueueLeft;
        public event Action<MatchResult> OnMatchFound;
        public event Action<string> OnMatchmakingError;
        public event Action<int> OnQueuePositionUpdate;

        private float _pollTimer;
        private int _retryCount;
        private string _currentQueueId;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        private void Update()
        {
            if (IsInQueue && IsPolling)
            {
                _pollTimer -= Time.deltaTime;
                if (_pollTimer <= 0)
                {
                    _pollTimer = _pollInterval;
                    _ = PollMatchStatus();
                }
            }
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        /// <summary>
        /// Joins the matchmaking queue with specified preferences.
        /// </summary>
        public async Task<bool> JoinQueue(MatchmakingPreferences preferences = null)
        {
            if (IsInQueue)
            {
                Debug.LogWarning("[MatchmakingService] Already in queue");
                return false;
            }

            CurrentPreferences = preferences ?? new MatchmakingPreferences();

            try
            {
                var request = new JoinQueueRequest
                {
                    preferences = CurrentPreferences
                };

                var response = await ApiClient.Instance.PostAsync<JoinQueueResponse>(
                    "/v1/matchmaking/join",
                    request
                );

                var data = response?.Data;
                if (response != null && response.Success && data != null && data.success)
                {
                    _currentQueueId = data.queue_id;
                    IsInQueue = true;
                    IsPolling = true;
                    _pollTimer = _pollInterval;
                    _retryCount = 0;

                    OnQueueJoined?.Invoke();
                    Debug.Log($"[MatchmakingService] Joined queue: {_currentQueueId}");
                    return true;
                }
                else
                {
                    string error = data?.error ?? response?.Error ?? "Unknown error";
                    OnMatchmakingError?.Invoke(error);
                    Debug.LogError($"[MatchmakingService] Failed to join queue: {error}");
                    return false;
                }
            }
            catch (Exception ex)
            {
                OnMatchmakingError?.Invoke(ex.Message);
                Debug.LogError($"[MatchmakingService] Exception joining queue: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Leaves the matchmaking queue.
        /// </summary>
        public async Task<bool> LeaveQueue()
        {
            if (!IsInQueue)
            {
                return true;
            }

            try
            {
                var response = await ApiClient.Instance.PostAsync<LeaveQueueResponse>(
                    "/v1/matchmaking/leave",
                    new { queue_id = _currentQueueId }
                );

                // Always clear local state
                IsInQueue = false;
                IsPolling = false;
                _currentQueueId = null;

                OnQueueLeft?.Invoke();
                Debug.Log("[MatchmakingService] Left queue");

                return response?.Data?.success ?? response?.Success ?? true;
            }
            catch (Exception ex)
            {
                // Still clear local state on error
                IsInQueue = false;
                IsPolling = false;
                _currentQueueId = null;

                Debug.LogError($"[MatchmakingService] Error leaving queue: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Accepts a match invitation.
        /// </summary>
        public async Task<bool> AcceptMatch(string matchId)
        {
            try
            {
                var response = await ApiClient.Instance.PostAsync<AcceptMatchResponse>(
                    "/v1/matchmaking/accept",
                    new { match_id = matchId }
                );

                var data = response?.Data;
                if (response != null && response.Success && data != null && data.success)
                {
                    IsInQueue = false;
                    IsPolling = false;
                    Debug.Log($"[MatchmakingService] Match accepted: {matchId}");
                    return true;
                }

                OnMatchmakingError?.Invoke(data?.error ?? response?.Error ?? "Failed to accept match");
                return false;
            }
            catch (Exception ex)
            {
                OnMatchmakingError?.Invoke(ex.Message);
                Debug.LogError($"[MatchmakingService] Error accepting match: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Declines a match invitation.
        /// </summary>
        public async Task<bool> DeclineMatch(string matchId)
        {
            try
            {
                var response = await ApiClient.Instance.PostAsync<DeclineMatchResponse>(
                    "/v1/matchmaking/decline",
                    new { match_id = matchId }
                );
                var data = response?.Data;

                // Return to queue after declining
                if (data?.return_to_queue == true)
                {
                    // Already in queue
                    IsPolling = true;
                }

                Debug.Log($"[MatchmakingService] Match declined: {matchId}");
                return data?.success ?? response?.Success ?? true;
            }
            catch (Exception ex)
            {
                Debug.LogError($"[MatchmakingService] Error declining match: {ex.Message}");
                return false;
            }
        }

        private async Task PollMatchStatus()
        {
            if (!IsInQueue || string.IsNullOrEmpty(_currentQueueId))
            {
                return;
            }

            try
            {
                var response = await ApiClient.Instance.GetAsync<MatchStatusResponse>(
                    $"/v1/matchmaking/status?queue_id={_currentQueueId}"
                );
                var data = response?.Data;

                if (response == null || !response.Success || data == null)
                {
                    HandlePollError("No response from server");
                    return;
                }

                _retryCount = 0; // Reset on success

                switch (data.status)
                {
                    case "waiting":
                        // Still in queue
                        if (data.queue_position > 0)
                        {
                            OnQueuePositionUpdate?.Invoke(data.queue_position);
                        }
                        break;

                    case "match_found":
                        // Match found - stop polling and notify
                        IsPolling = false;

                        var match = new MatchResult
                        {
                            MatchId = data.match_id,
                            BoothId = data.booth_id,
                            Partner = new PartnerInfo
                            {
                                UserId = data.partner?.user_id,
                                DisplayName = data.partner?.display_name,
                                AvatarId = data.partner?.avatar_id
                            },
                            ExpiresIn = data.expires_in
                        };

                        OnMatchFound?.Invoke(match);
                        Debug.Log($"[MatchmakingService] Match found! Partner: {match.Partner.DisplayName}");
                        break;

                    case "expired":
                    case "cancelled":
                        IsInQueue = false;
                        IsPolling = false;
                        _currentQueueId = null;
                        OnQueueLeft?.Invoke();
                        break;
                }
            }
            catch (Exception ex)
            {
                HandlePollError(ex.Message);
            }
        }

        private void HandlePollError(string error)
        {
            _retryCount++;

            if (_retryCount >= _maxRetries)
            {
                Debug.LogError($"[MatchmakingService] Max retries reached, leaving queue");
                IsInQueue = false;
                IsPolling = false;
                OnMatchmakingError?.Invoke("Connection lost");
                OnQueueLeft?.Invoke();
            }
            else
            {
                Debug.LogWarning($"[MatchmakingService] Poll error (retry {_retryCount}/{_maxRetries}): {error}");
            }
        }

        /// <summary>
        /// Gets estimated wait time from server.
        /// </summary>
        public async Task<int> GetEstimatedWaitTime()
        {
            try
            {
                var response = await ApiClient.Instance.GetAsync<WaitTimeResponse>(
                    "/v1/matchmaking/wait-time"
                );
                return response?.Data?.estimated_seconds ?? -1;
            }
            catch
            {
                return -1;
            }
        }
    }

    // Request/Response Models

    [Serializable]
    public class MatchmakingPreferences
    {
        public string[] interests = new string[0];
        public string preferred_gender = "any";
        public int min_age = 18;
        public int max_age = 99;
        public bool verified_only = false;
    }

    [Serializable]
    public class JoinQueueRequest
    {
        public MatchmakingPreferences preferences;
    }

    [Serializable]
    public class JoinQueueResponse
    {
        public bool success;
        public string queue_id;
        public string error;
        public int estimated_wait;
    }

    [Serializable]
    public class LeaveQueueResponse
    {
        public bool success;
        public string error;
    }

    [Serializable]
    public class MatchStatusResponse
    {
        public string status; // "waiting", "match_found", "expired", "cancelled"
        public int queue_position;
        public string match_id;
        public string booth_id;
        public MatchPartnerInfo partner;
        public int expires_in;
    }

    [Serializable]
    public class MatchPartnerInfo
    {
        public string user_id;
        public string display_name;
        public string avatar_id;
    }

    [Serializable]
    public class AcceptMatchResponse
    {
        public bool success;
        public string booth_id;
        public string room_name;
        public string error;
    }

    [Serializable]
    public class DeclineMatchResponse
    {
        public bool success;
        public bool return_to_queue;
        public string error;
    }

    [Serializable]
    public class WaitTimeResponse
    {
        public int estimated_seconds;
        public int users_in_queue;
    }

    /// <summary>
    /// Result of a successful matchmaking.
    /// </summary>
    public class MatchResult
    {
        public string MatchId;
        public string BoothId;
        public PartnerInfo Partner;
        public int ExpiresIn; // Seconds to accept
    }
}
