using UnityEngine;
using System;
using System.Threading.Tasks;
using Drift.Player;
using Drift.Environment;
using Drift.Networking;
using Drift.API;

namespace Drift.Core
{
    /// <summary>
    /// Manages VR sessions - coordinates entering/exiting spaces,
    /// partner matching, and session state.
    /// </summary>
    public class SessionManager : MonoBehaviour
    {
        public static SessionManager Instance { get; private set; }

        [Header("Settings")]
        [SerializeField] private float _matchTimeout = 60f;
        [SerializeField] private float _partnerDisconnectGracePeriod = 10f;
        [SerializeField] private float _matchAcceptTimeout = 30f;

        // Current session state
        public SessionState CurrentState { get; private set; } = SessionState.None;
        public string CurrentSessionId { get; private set; }
        public PartnerInfo Partner { get; private set; }

        // Match state
        public MatchResult PendingMatch { get; private set; }
        public int QueuePosition { get; private set; }
        public float MatchAcceptTimeRemaining { get; private set; }

        // Events
        public event Action<SessionState> OnStateChanged;
        public event Action<PartnerInfo> OnPartnerFound;
        public event Action OnPartnerLost;
        public event Action<string> OnSessionError;
        public event Action<MatchResult> OnMatchReceived;
        public event Action OnMatchExpired;
        public event Action<int> OnQueuePositionChanged;

        private float _matchTimer;
        private float _disconnectTimer;
        private float _matchAcceptTimer;
        private MatchmakingService _matchmakingService;

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
            // Subscribe to realtime events
            if (DriftRealtime.Instance != null)
            {
                DriftRealtime.Instance.OnConnected += HandleRealtimeConnected;
                DriftRealtime.Instance.OnDisconnected += HandleRealtimeDisconnected;
            }

            // Subscribe to matchmaking events
            _matchmakingService = MatchmakingService.Instance;
            if (_matchmakingService != null)
            {
                _matchmakingService.OnQueueJoined += HandleQueueJoined;
                _matchmakingService.OnQueueLeft += HandleQueueLeft;
                _matchmakingService.OnMatchFound += HandleMatchFound;
                _matchmakingService.OnMatchmakingError += HandleMatchmakingError;
                _matchmakingService.OnQueuePositionUpdate += HandleQueuePositionUpdate;
            }
        }

        private void Update()
        {
            UpdateMatchTimer();
            UpdateDisconnectTimer();
            UpdateMatchAcceptTimer();
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;

            // Unsubscribe from matchmaking events
            if (_matchmakingService != null)
            {
                _matchmakingService.OnQueueJoined -= HandleQueueJoined;
                _matchmakingService.OnQueueLeft -= HandleQueueLeft;
                _matchmakingService.OnMatchFound -= HandleMatchFound;
                _matchmakingService.OnMatchmakingError -= HandleMatchmakingError;
                _matchmakingService.OnQueuePositionUpdate -= HandleQueuePositionUpdate;
            }
        }

        /// <summary>
        /// Enters the public lounge to browse and potentially match.
        /// </summary>
        public async Task EnterPublicLounge()
        {
            if (CurrentState != SessionState.None)
            {
                Debug.LogWarning("[SessionManager] Already in a session");
                return;
            }

            SetState(SessionState.Connecting);

            // Connect to public room
            DriftRealtime.Instance?.JoinPublicLounge();

            // Wait for connection
            await WaitForConnection(10f);

            if (DriftRealtime.Instance?.IsConnected == true)
            {
                SetState(SessionState.InPublicLounge);

                // Spawn player
                SpawnPlayerInLounge();
            }
            else
            {
                SetState(SessionState.None);
                OnSessionError?.Invoke("Failed to connect to lounge");
            }
        }

        /// <summary>
        /// Starts looking for a match in the public lounge.
        /// </summary>
        public async void StartMatchmaking(MatchmakingPreferences preferences = null)
        {
            if (CurrentState != SessionState.InPublicLounge)
            {
                Debug.LogWarning("[SessionManager] Must be in public lounge to matchmake");
                return;
            }

            SetState(SessionState.Matchmaking);
            _matchTimer = _matchTimeout;
            QueuePosition = 0;

            // Join matchmaking queue via service
            if (_matchmakingService != null)
            {
                bool success = await _matchmakingService.JoinQueue(preferences);
                if (!success)
                {
                    SetState(SessionState.InPublicLounge);
                    OnSessionError?.Invoke("Failed to join matchmaking queue");
                }
            }
            else
            {
                Debug.LogWarning("[SessionManager] MatchmakingService not available");
            }

            Debug.Log("[SessionManager] Looking for match...");
        }

        /// <summary>
        /// Cancels matchmaking.
        /// </summary>
        public async void CancelMatchmaking()
        {
            if (CurrentState == SessionState.Matchmaking || CurrentState == SessionState.MatchFound)
            {
                // Leave queue via service
                if (_matchmakingService != null)
                {
                    await _matchmakingService.LeaveQueue();
                }

                PendingMatch = null;
                _matchAcceptTimer = 0;
                SetState(SessionState.InPublicLounge);
                _matchTimer = 0;
            }
        }

        /// <summary>
        /// Called when a match is found (from server via MatchmakingService).
        /// </summary>
        private void HandleMatchFound(MatchResult match)
        {
            if (CurrentState != SessionState.Matchmaking)
            {
                Debug.LogWarning("[SessionManager] Unexpected match found");
                return;
            }

            PendingMatch = match;
            Partner = match.Partner;
            CurrentSessionId = match.BoothId;
            SetState(SessionState.MatchFound);

            // Start accept timer
            _matchAcceptTimer = match.ExpiresIn > 0 ? match.ExpiresIn : _matchAcceptTimeout;
            MatchAcceptTimeRemaining = _matchAcceptTimer;

            OnPartnerFound?.Invoke(Partner);
            OnMatchReceived?.Invoke(match);

            Debug.Log($"[SessionManager] Match found! Partner: {Partner.DisplayName}");
        }

        /// <summary>
        /// Legacy method - called directly when match is found.
        /// </summary>
        public async Task OnMatchFound(string sessionId, PartnerInfo partner)
        {
            var match = new MatchResult
            {
                MatchId = sessionId,
                BoothId = sessionId,
                Partner = partner,
                ExpiresIn = (int)_matchAcceptTimeout
            };
            HandleMatchFound(match);
        }

        /// <summary>
        /// Accepts a match and enters private booth.
        /// </summary>
        public async Task AcceptMatch()
        {
            if (CurrentState != SessionState.MatchFound || Partner == null)
            {
                return;
            }

            // Accept via service if we have a pending match
            if (PendingMatch != null && _matchmakingService != null)
            {
                bool accepted = await _matchmakingService.AcceptMatch(PendingMatch.MatchId);
                if (!accepted)
                {
                    OnSessionError?.Invoke("Failed to accept match");
                    return;
                }
            }

            SetState(SessionState.Connecting);
            _matchAcceptTimer = 0;

            // Leave public room
            DriftRealtime.Instance?.LeaveRoom();

            // Join private booth
            string boothId = PendingMatch?.BoothId ?? CurrentSessionId;
            DriftRealtime.Instance?.JoinPrivateBooth(boothId);

            await WaitForConnection(10f);

            if (DriftRealtime.Instance?.IsConnected == true)
            {
                SetState(SessionState.InPrivateBooth);

                // Initialize booth - determine host by user ID comparison
                bool isHost = string.Compare(GameManager.Instance?.UserId, Partner.UserId, StringComparison.Ordinal) < 0;
                BoothManager.Instance?.InitializeBooth(boothId, isHost);

                // Notify companion session if active
                var companionSession = CompanionSessionManager.Instance;
                if (companionSession != null && companionSession.HasActiveSession)
                {
                    _ = companionSession.BroadcastVRState(new VRStateData
                    {
                        state = "in_booth",
                        partner_name = Partner.DisplayName
                    });
                }

                Debug.Log($"[SessionManager] Entered private booth with {Partner.DisplayName}");
            }
            else
            {
                SetState(SessionState.None);
                OnSessionError?.Invoke("Failed to enter private booth");
            }

            PendingMatch = null;
        }

        /// <summary>
        /// Declines a match.
        /// </summary>
        public async void DeclineMatch()
        {
            if (CurrentState == SessionState.MatchFound)
            {
                // Decline via service
                if (PendingMatch != null && _matchmakingService != null)
                {
                    await _matchmakingService.DeclineMatch(PendingMatch.MatchId);
                }

                PendingMatch = null;
                CurrentSessionId = null;
                Partner = null;
                _matchAcceptTimer = 0;

                // Return to matchmaking (service may auto-rejoin queue)
                if (_matchmakingService?.IsInQueue == true)
                {
                    SetState(SessionState.Matchmaking);
                    _matchTimer = _matchTimeout;
                }
                else
                {
                    SetState(SessionState.InPublicLounge);
                }
            }
        }

        // Matchmaking service event handlers

        private void HandleQueueJoined()
        {
            Debug.Log("[SessionManager] Joined matchmaking queue");
        }

        private void HandleQueueLeft()
        {
            if (CurrentState == SessionState.Matchmaking)
            {
                SetState(SessionState.InPublicLounge);
            }
        }

        private void HandleMatchmakingError(string error)
        {
            OnSessionError?.Invoke(error);
            if (CurrentState == SessionState.Matchmaking)
            {
                SetState(SessionState.InPublicLounge);
            }
        }

        private void HandleQueuePositionUpdate(int position)
        {
            QueuePosition = position;
            OnQueuePositionChanged?.Invoke(position);
        }

        /// <summary>
        /// Leaves the current session.
        /// </summary>
        public void LeaveSession()
        {
            // Clean up
            if (CurrentState == SessionState.InPrivateBooth)
            {
                BoothManager.Instance?.RequestExit();
            }

            InteractionManager.Instance?.ClearPartner();
            DriftRealtime.Instance?.LeaveRoom();

            CurrentSessionId = null;
            Partner = null;
            SetState(SessionState.None);
        }

        private void SetState(SessionState newState)
        {
            if (CurrentState != newState)
            {
                var oldState = CurrentState;
                CurrentState = newState;
                Debug.Log($"[SessionManager] State: {oldState} -> {newState}");
                OnStateChanged?.Invoke(newState);
            }
        }

        private async Task WaitForConnection(float timeout)
        {
            float elapsed = 0f;
            while (elapsed < timeout && DriftRealtime.Instance?.IsConnected != true)
            {
                await Task.Delay(100);
                elapsed += 0.1f;
            }
        }

        private void SpawnPlayerInLounge()
        {
            var spawnPoint = EnvironmentManager.Instance?.GetRandomSpawnPoint();
            if (spawnPoint != null && PlayerController.Instance != null)
            {
                PlayerController.Instance.TeleportTo(spawnPoint.position, spawnPoint.rotation);
            }
        }

        private void UpdateMatchTimer()
        {
            if (CurrentState == SessionState.Matchmaking && _matchTimer > 0)
            {
                _matchTimer -= Time.deltaTime;

                if (_matchTimer <= 0)
                {
                    Debug.Log("[SessionManager] Match timeout");
                    SetState(SessionState.InPublicLounge);
                    OnSessionError?.Invoke("No match found. Try again?");
                }
            }
        }

        private void UpdateDisconnectTimer()
        {
            if (CurrentState == SessionState.InPrivateBooth && _disconnectTimer > 0)
            {
                _disconnectTimer -= Time.deltaTime;

                if (_disconnectTimer <= 0)
                {
                    Debug.Log("[SessionManager] Partner disconnect timeout");
                    LeaveSession();
                    OnPartnerLost?.Invoke();
                }
            }
        }

        private void UpdateMatchAcceptTimer()
        {
            if (CurrentState == SessionState.MatchFound && _matchAcceptTimer > 0)
            {
                _matchAcceptTimer -= Time.deltaTime;
                MatchAcceptTimeRemaining = Mathf.Max(0, _matchAcceptTimer);

                if (_matchAcceptTimer <= 0)
                {
                    Debug.Log("[SessionManager] Match accept timeout");
                    OnMatchExpired?.Invoke();

                    // Auto-decline expired match
                    PendingMatch = null;
                    Partner = null;
                    CurrentSessionId = null;
                    SetState(SessionState.InPublicLounge);
                }
            }
        }

        private void HandleRealtimeConnected()
        {
            _disconnectTimer = 0;
        }

        private void HandleRealtimeDisconnected()
        {
            if (CurrentState == SessionState.InPrivateBooth)
            {
                // Start grace period
                _disconnectTimer = _partnerDisconnectGracePeriod;
            }
        }

        /// <summary>
        /// Gets remaining match time.
        /// </summary>
        public float GetMatchTimeRemaining()
        {
            return CurrentState == SessionState.Matchmaking ? _matchTimer : 0;
        }
    }

    /// <summary>
    /// Session states.
    /// </summary>
    public enum SessionState
    {
        None,
        Connecting,
        InPublicLounge,
        Matchmaking,
        MatchFound,
        InPrivateBooth
    }

    /// <summary>
    /// Information about a matched partner.
    /// </summary>
    public class PartnerInfo
    {
        public int ClientId;
        public string UserId;
        public string DisplayName;
        public string AvatarId;
    }
}
