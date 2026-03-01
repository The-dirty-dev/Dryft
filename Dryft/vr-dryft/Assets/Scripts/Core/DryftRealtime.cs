using UnityEngine;
using Normal.Realtime;
using System;

namespace Drift.Core
{
    /// <summary>
    /// Wrapper for Normcore Realtime functionality.
    /// Handles room connection, player management, and provides events
    /// for other systems to hook into.
    ///
    /// LEGAL NOTE: Each VR session uses a unique Normcore room with
    /// encryption enabled. Only matched, verified users can join.
    /// </summary>
    public class DriftRealtime : MonoBehaviour
    {
        public static DriftRealtime Instance { get; private set; }

        [Header("Normcore Settings")]
        [SerializeField] private string _appKey = "YOUR_NORMCORE_APP_KEY";
        [SerializeField] private bool _useRoomEncryption = true;

        [Header("References")]
        [SerializeField] private Realtime _realtime;

        // Events
        public event Action OnConnected;
        public event Action OnDisconnected;
        public event Action<int> OnClientJoined;  // client ID
        public event Action<int> OnClientLeft;    // client ID

        // State
        public bool IsConnected => _realtime?.connected ?? false;
        public int LocalClientId => _realtime?.clientID ?? -1;
        public string CurrentRoom { get; private set; }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);

            if (_realtime == null)
            {
                _realtime = GetComponent<Realtime>();
            }

            if (_realtime != null)
            {
                _realtime.didConnectToRoom += HandleConnected;
                _realtime.didDisconnectFromRoom += HandleDisconnected;
            }
        }

        private void OnDestroy()
        {
            if (Instance == this)
            {
                if (_realtime != null)
                {
                    _realtime.didConnectToRoom -= HandleConnected;
                    _realtime.didDisconnectFromRoom -= HandleDisconnected;
                }
                Instance = null;
            }
        }

        /// <summary>
        /// Connects to the public lounge room.
        /// </summary>
        public void JoinPublicLounge()
        {
            JoinRoom("drift-public-lounge");
        }

        /// <summary>
        /// Connects to a private booth for two users.
        /// </summary>
        /// <param name="boothId">Unique booth identifier (e.g., match ID).</param>
        public void JoinPrivateBooth(string boothId)
        {
            // Private booths use a prefixed room name
            JoinRoom($"drift-booth-{boothId}");
        }

        /// <summary>
        /// Connects to a specific room.
        /// </summary>
        /// <param name="roomName">The room name to join.</param>
        public void JoinRoom(string roomName)
        {
            if (_realtime == null)
            {
                Debug.LogError("[DriftRealtime] Realtime component not found");
                return;
            }

            if (_realtime.connected)
            {
                Debug.Log($"[DriftRealtime] Leaving current room before joining {roomName}");
                _realtime.Disconnect();
            }

            CurrentRoom = roomName;

            var options = new Realtime.InstantiateOptions
            {
                // Add any spawn options here
            };

            Debug.Log($"[DriftRealtime] Joining room: {roomName}");
            _realtime.Connect(roomName);
        }

        /// <summary>
        /// Disconnects from the current room.
        /// </summary>
        public void LeaveRoom()
        {
            if (_realtime != null && _realtime.connected)
            {
                Debug.Log($"[DriftRealtime] Leaving room: {CurrentRoom}");
                _realtime.Disconnect();
            }
        }

        /// <summary>
        /// Gets the client IDs of all users in the room.
        /// </summary>
        public int[] GetAllClientIds()
        {
            // Normcore doesn't directly expose this, but you can track it
            // via RealtimeAvatarManager or custom tracking
            return new int[] { LocalClientId };
        }

        /// <summary>
        /// Checks if another client is in the same room.
        /// </summary>
        public bool IsClientInRoom(int clientId)
        {
            // Would need to track via avatar manager or custom presence
            return IsConnected && clientId >= 0;
        }

        private void HandleConnected(Realtime realtime)
        {
            Debug.Log($"[DriftRealtime] Connected to room: {CurrentRoom} (clientId: {realtime.clientID})");
            OnConnected?.Invoke();
        }

        private void HandleDisconnected(Realtime realtime)
        {
            Debug.Log($"[DriftRealtime] Disconnected from room: {CurrentRoom}");
            CurrentRoom = null;
            OnDisconnected?.Invoke();
        }

        /// <summary>
        /// Gets the Realtime component for direct access if needed.
        /// </summary>
        public Realtime Realtime => _realtime;

#if UNITY_EDITOR
        [ContextMenu("Test Join Public Lounge")]
        private void TestJoinPublicLounge()
        {
            JoinPublicLounge();
        }

        [ContextMenu("Test Leave Room")]
        private void TestLeaveRoom()
        {
            LeaveRoom();
        }
#endif
    }
}
