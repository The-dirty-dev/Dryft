using System;
using System.Collections;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;
using Drift.API;
using Drift.Haptics;
using Drift.Player;
using Newtonsoft.Json;

namespace Drift.Core
{
    /// <summary>
    /// Manages companion sessions, allowing mobile/web users to interact with VR users.
    /// Handles session creation, state broadcasting, and receiving haptic commands.
    /// </summary>
    public class CompanionSessionManager : MonoBehaviour
    {
        public static CompanionSessionManager Instance { get; private set; }

        [Header("Settings")]
        [SerializeField] private float _stateBroadcastInterval = 0.5f; // How often to send VR state
        [SerializeField] private int _sessionDurationMins = 60;
        [SerializeField] private int _maxParticipants = 5;

        [Header("Debug")]
        [SerializeField] private bool _logEvents = true;

        // Session state
        private SessionInfo _currentSession;
        private Coroutine _stateBroadcastCoroutine;
        private float _currentHapticIntensity;

        // Events
        public event Action<SessionInfo> OnSessionCreated;
        public event Action OnSessionEnded;
        public event Action<SessionUser> OnCompanionJoined;
        public event Action<string, string> OnCompanionLeft; // userId, reason
        public event Action<string, string> OnChatReceived; // displayName, content
        public event Action<float> OnHapticReceived; // intensity

        // Properties
        public bool HasActiveSession => _currentSession != null;
        public string SessionCode => _currentSession?.session?.session_code;
        public IReadOnlyList<SessionUser> Companions => _currentSession?.participants ?? new List<SessionUser>();

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void OnDestroy()
        {
            if (Instance == this)
            {
                _ = EndSession();
                Instance = null;
            }
        }

        // ==========================================================================
        // Session Management
        // ==========================================================================

        /// <summary>
        /// Creates a new companion session and returns the session code.
        /// </summary>
        public async Task<string> CreateSession()
        {
            if (_currentSession != null)
            {
                Log("Session already active");
                return _currentSession.session.session_code;
            }

            Log("Creating companion session...");

            var request = new CreateSessionRequest
            {
                max_participants = _maxParticipants,
                vr_device_type = GetVRDeviceType(),
                expires_in_mins = _sessionDurationMins
            };

            try
            {
                var response = await ApiClient.Instance.PostAsync<CreateSessionResponse>(
                    "/v1/sessions",
                    JsonUtility.ToJson(request)
                );

                if (response != null)
                {
                    // Get full session info
                    var sessionInfo = await ApiClient.Instance.GetAsync<SessionInfo>(
                        $"/v1/sessions/{response.session_id}"
                    );

                    _currentSession = sessionInfo;

                    // Start broadcasting state
                    StartStateBroadcast();

                    // Subscribe to WebSocket events
                    SubscribeToWebSocketEvents();

                    Log($"Session created with code: {response.session_code}");
                    OnSessionCreated?.Invoke(sessionInfo);

                    return response.session_code;
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"[CompanionSession] Failed to create session: {ex.Message}");
            }

            return null;
        }

        /// <summary>
        /// Ends the current session.
        /// </summary>
        public async Task EndSession()
        {
            if (_currentSession == null) return;

            StopStateBroadcast();
            UnsubscribeFromWebSocketEvents();

            try
            {
                await ApiClient.Instance.DeleteAsync($"/v1/sessions/{_currentSession.session.id}");
            }
            catch { }

            _currentSession = null;
            OnSessionEnded?.Invoke();
            Log("Session ended");
        }

        /// <summary>
        /// Grants haptic permission to a companion.
        /// </summary>
        public async Task GrantHapticPermission(string companionUserId, string permissionType = "always", float maxIntensity = 1.0f)
        {
            if (_currentSession == null) return;

            var request = new SetHapticPermissionRequest
            {
                controller_id = companionUserId,
                permission_type = permissionType,
                max_intensity = maxIntensity
            };

            try
            {
                await ApiClient.Instance.PostAsync<object>(
                    $"/v1/sessions/{_currentSession.session.id}/haptic-permission",
                    JsonUtility.ToJson(request)
                );
                Log($"Granted {permissionType} haptic permission to {companionUserId}");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[CompanionSession] Failed to grant permission: {ex.Message}");
            }
        }

        /// <summary>
        /// Sends a haptic command to a companion (two-way control).
        /// </summary>
        public async Task SendHapticToCompanion(string companionUserId, float intensity, int durationMs)
        {
            if (_currentSession == null) return;

            var request = new SendHapticRequest
            {
                to_user_id = companionUserId,
                command_type = "vibrate",
                intensity = intensity,
                duration_ms = durationMs
            };

            try
            {
                await ApiClient.Instance.PostAsync<object>(
                    $"/v1/sessions/{_currentSession.session.id}/haptic",
                    request
                );
            }
            catch { }
        }

        /// <summary>
        /// Sends a chat message to companions.
        /// </summary>
        public async Task SendChat(string message)
        {
            if (_currentSession == null) return;

            try
            {
                await ApiClient.Instance.PostAsync<object>(
                    $"/v1/sessions/{_currentSession.session.id}/chat",
                    JsonUtility.ToJson(new { content = message })
                );
            }
            catch { }
        }

        // ==========================================================================
        // State Broadcasting
        // ==========================================================================

        private void StartStateBroadcast()
        {
            if (_stateBroadcastCoroutine != null)
                StopCoroutine(_stateBroadcastCoroutine);

            _stateBroadcastCoroutine = StartCoroutine(StateBroadcastLoop());
        }

        private void StopStateBroadcast()
        {
            if (_stateBroadcastCoroutine != null)
            {
                StopCoroutine(_stateBroadcastCoroutine);
                _stateBroadcastCoroutine = null;
            }
        }

        private IEnumerator StateBroadcastLoop()
        {
            while (_currentSession != null)
            {
                BroadcastVRState();
                yield return new WaitForSeconds(_stateBroadcastInterval);
            }
        }

        private void BroadcastVRState()
        {
            if (_currentSession == null) return;

            var player = PlayerController.Instance;
            var haptic = HapticController.Instance;

            var state = new VRStatePayload
            {
                session_id = _currentSession.session.id,
                user_id = GameManager.Instance?.UserId.ToString() ?? "",
                current_activity = GetCurrentActivity(),
                current_room = GetCurrentRoom(),
                haptic_device_connected = haptic?.IsConnected ?? false,
                haptic_device_name = haptic?.DeviceName,
                haptic_intensity = _currentHapticIntensity
            };

            if (player != null)
            {
                state.avatar_position = new Vector3Data(player.transform.position);
                state.avatar_rotation = new Vector3Data(player.transform.eulerAngles);
                state.head_position = new Vector3Data(player.HeadPosition);
                state.left_hand_pos = new Vector3Data(player.LeftHandPosition);
                state.right_hand_pos = new Vector3Data(player.RightHandPosition);
            }

            // Send via WebSocket
            var ws = CompanionWebSocket.Instance;
            if (ws != null && ws.IsConnected)
            {
                _ = ws.Send("session_state", state);
            }
        }

        private string GetCurrentActivity()
        {
            var session = SessionManager.Instance;
            if (session == null) return "idle";

            return session.CurrentState switch
            {
                SessionState.InPublicLounge => "exploring",
                SessionState.InPrivateBooth => "private",
                SessionState.Matchmaking => "matchmaking",
                _ => "idle"
            };
        }

        private string GetCurrentRoom()
        {
            var session = SessionManager.Instance;
            if (session == null) return "lobby";

            return session.CurrentState switch
            {
                SessionState.InPublicLounge => "lounge",
                SessionState.InPrivateBooth => "booth",
                _ => "lobby"
            };
        }

        private string GetVRDeviceType()
        {
            // Detect VR device type
#if UNITY_ANDROID
            return "quest";
#else
            return "pcvr";
#endif
        }

        // ==========================================================================
        // WebSocket Events
        // ==========================================================================

        private void SubscribeToWebSocketEvents()
        {
            var ws = CompanionWebSocket.Instance;
            if (ws == null) return;

            ws.OnMessageReceived += HandleWebSocketMessage;
            ws.OnDisconnected += HandleWebSocketDisconnected;

            // Connect if not already connected
            if (!ws.IsConnected && !string.IsNullOrEmpty(GameManager.Instance?.AuthToken))
            {
                _ = ws.Connect(GameManager.Instance.AuthToken);
            }
        }

        private void UnsubscribeFromWebSocketEvents()
        {
            var ws = CompanionWebSocket.Instance;
            if (ws == null) return;

            ws.OnMessageReceived -= HandleWebSocketMessage;
            ws.OnDisconnected -= HandleWebSocketDisconnected;
        }

        private void HandleWebSocketMessage(WebSocketMessage message)
        {
            if (_currentSession == null) return;

            switch (message.type)
            {
                case "session_user_joined":
                    var joinPayload = JsonConvert.DeserializeObject<SessionUserJoinedPayload>(message.payload);
                    if (joinPayload?.user != null)
                    {
                        HandleCompanionJoined(joinPayload.user);
                    }
                    break;

                case "session_user_left":
                    var leftPayload = JsonConvert.DeserializeObject<SessionUserLeftPayload>(message.payload);
                    if (leftPayload != null)
                    {
                        HandleCompanionLeft(leftPayload.user_id, leftPayload.reason);
                    }
                    break;

                case "session_chat":
                    var chatPayload = JsonConvert.DeserializeObject<SessionChatPayload>(message.payload);
                    if (chatPayload != null)
                    {
                        HandleChatReceived(chatPayload);
                    }
                    break;

                case "session_haptic":
                    var hapticPayload = JsonConvert.DeserializeObject<SessionHapticPayload>(message.payload);
                    if (hapticPayload != null)
                    {
                        HandleHapticReceived(hapticPayload);
                    }
                    break;

                case "session_ended":
                    var endedPayload = JsonConvert.DeserializeObject<SessionEndedPayload>(message.payload);
                    Log($"Session ended: {endedPayload?.reason}");
                    _currentSession = null;
                    StopStateBroadcast();
                    OnSessionEnded?.Invoke();
                    break;
            }
        }

        private void HandleWebSocketDisconnected()
        {
            Log("WebSocket disconnected");
        }

        /// <summary>
        /// Called when a companion joins (from WebSocket event).
        /// </summary>
        public void HandleCompanionJoined(SessionUser user)
        {
            if (_currentSession == null) return;

            _currentSession.participants.Add(user);
            Log($"Companion joined: {user.display_name}");
            OnCompanionJoined?.Invoke(user);
        }

        /// <summary>
        /// Called when a companion leaves (from WebSocket event).
        /// </summary>
        public void HandleCompanionLeft(string userId, string reason)
        {
            if (_currentSession == null) return;

            _currentSession.participants.RemoveAll(p => p.user_id == userId);
            Log($"Companion left: {userId} ({reason})");
            OnCompanionLeft?.Invoke(userId, reason);
        }

        /// <summary>
        /// Called when receiving a chat message (from WebSocket event).
        /// </summary>
        public void HandleChatReceived(SessionChatPayload chat)
        {
            Log($"Chat from {chat.display_name}: {chat.content}");
            OnChatReceived?.Invoke(chat.display_name, chat.content);
        }

        /// <summary>
        /// Called when receiving a haptic command (from WebSocket event).
        /// </summary>
        public async void HandleHapticReceived(SessionHapticPayload haptic)
        {
            Log($"Haptic from companion: {haptic.command_type} at {haptic.intensity}");

            _currentHapticIntensity = haptic.intensity;
            OnHapticReceived?.Invoke(haptic.intensity);

            var controller = HapticController.Instance;
            if (controller == null || !controller.IsConnected) return;

            switch (haptic.command_type)
            {
                case "vibrate":
                    await controller.Pulse(haptic.intensity, haptic.duration_ms / 1000f);
                    break;

                case "pattern":
                    if (!string.IsNullOrEmpty(haptic.pattern_name))
                    {
                        await controller.PlayPattern(haptic.pattern_name);
                    }
                    break;

                case "stop":
                    await controller.Stop();
                    break;
            }

            // Reset intensity after delay
            StartCoroutine(ResetIntensityAfterDelay(haptic.duration_ms / 1000f));
        }

        private IEnumerator ResetIntensityAfterDelay(float seconds)
        {
            yield return new WaitForSeconds(seconds);
            _currentHapticIntensity = 0;
        }

        private void Log(string message)
        {
            if (_logEvents)
            {
                Debug.Log($"[CompanionSession] {message}");
            }
        }
    }
}
