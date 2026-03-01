using UnityEngine;
using Normal.Realtime;
using System;
using System.Collections.Generic;
using Drift.Core;

namespace Drift.Networking
{
    /// <summary>
    /// Tracks presence of players in the current room.
    ///
    /// Features:
    /// - Maintains list of all players in room
    /// - Fires events on join/leave
    /// - Provides player lookup by client ID
    /// </summary>
    public class RoomPresence : MonoBehaviour
    {
        public static RoomPresence Instance { get; private set; }

        [Header("Settings")]
        [SerializeField] private float _cleanupInterval = 5f;

        // Events
        public event Action<PlayerInfo> OnPlayerJoined;
        public event Action<PlayerInfo> OnPlayerLeft;
        public event Action<int> OnPlayerCountChanged;

        // State
        private Dictionary<int, PlayerInfo> _players = new Dictionary<int, PlayerInfo>();
        private List<PlayerSync> _playerSyncs = new List<PlayerSync>();
        private float _lastCleanup;

        public int PlayerCount => _players.Count;
        public IReadOnlyDictionary<int, PlayerInfo> Players => _players;

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
            // Subscribe to Normcore events
            if (DriftRealtime.Instance != null)
            {
                DriftRealtime.Instance.OnConnected += HandleConnected;
                DriftRealtime.Instance.OnDisconnected += HandleDisconnected;
            }
        }

        private void Update()
        {
            // Periodic cleanup of stale entries
            if (Time.time - _lastCleanup > _cleanupInterval)
            {
                _lastCleanup = Time.time;
                CleanupStaleEntries();
            }
        }

        private void OnDestroy()
        {
            if (DriftRealtime.Instance != null)
            {
                DriftRealtime.Instance.OnConnected -= HandleConnected;
                DriftRealtime.Instance.OnDisconnected -= HandleDisconnected;
            }

            if (Instance == this) Instance = null;
        }

        private void HandleConnected()
        {
            // Clear previous state
            _players.Clear();
            _playerSyncs.Clear();

            // Add local player
            int localClientId = DriftRealtime.Instance?.LocalClientId ?? -1;
            if (localClientId >= 0)
            {
                AddPlayer(localClientId, GameManager.Instance?.UserDisplayName ?? "Me", true);
            }

            Debug.Log("[RoomPresence] Connected, tracking presence");
        }

        private void HandleDisconnected()
        {
            _players.Clear();
            _playerSyncs.Clear();
            OnPlayerCountChanged?.Invoke(0);

            Debug.Log("[RoomPresence] Disconnected, cleared presence");
        }

        /// <summary>
        /// Registers a PlayerSync component (called when avatar spawns).
        /// </summary>
        public void RegisterPlayerSync(PlayerSync playerSync)
        {
            if (playerSync == null) return;

            if (!_playerSyncs.Contains(playerSync))
            {
                _playerSyncs.Add(playerSync);
            }

            int clientId = playerSync.OwnerClientId;
            bool isLocal = playerSync.IsLocalPlayer;
            string displayName = playerSync.GetDisplayName();

            if (!_players.ContainsKey(clientId))
            {
                AddPlayer(clientId, displayName, isLocal);
            }
            else
            {
                // Update existing entry
                _players[clientId].displayName = displayName;
                _players[clientId].playerSync = playerSync;
            }
        }

        /// <summary>
        /// Unregisters a PlayerSync component (called when avatar despawns).
        /// </summary>
        public void UnregisterPlayerSync(PlayerSync playerSync)
        {
            if (playerSync == null) return;

            _playerSyncs.Remove(playerSync);

            int clientId = playerSync.OwnerClientId;
            if (_players.ContainsKey(clientId))
            {
                RemovePlayer(clientId);
            }
        }

        private void AddPlayer(int clientId, string displayName, bool isLocal)
        {
            var info = new PlayerInfo
            {
                clientId = clientId,
                displayName = displayName,
                isLocalPlayer = isLocal,
                joinTime = Time.time
            };

            _players[clientId] = info;

            OnPlayerJoined?.Invoke(info);
            OnPlayerCountChanged?.Invoke(_players.Count);

            Debug.Log($"[RoomPresence] Player joined: {displayName} (clientId: {clientId})");
        }

        private void RemovePlayer(int clientId)
        {
            if (!_players.TryGetValue(clientId, out PlayerInfo info))
                return;

            _players.Remove(clientId);

            OnPlayerLeft?.Invoke(info);
            OnPlayerCountChanged?.Invoke(_players.Count);

            Debug.Log($"[RoomPresence] Player left: {info.displayName} (clientId: {clientId})");
        }

        private void CleanupStaleEntries()
        {
            // Remove entries where PlayerSync no longer exists
            List<int> toRemove = new List<int>();

            foreach (var kvp in _players)
            {
                if (kvp.Value.playerSync == null && !kvp.Value.isLocalPlayer)
                {
                    // Check if there's still a valid PlayerSync for this client
                    bool found = false;
                    foreach (var sync in _playerSyncs)
                    {
                        if (sync != null && sync.OwnerClientId == kvp.Key)
                        {
                            kvp.Value.playerSync = sync;
                            found = true;
                            break;
                        }
                    }

                    if (!found)
                    {
                        toRemove.Add(kvp.Key);
                    }
                }
            }

            foreach (int clientId in toRemove)
            {
                RemovePlayer(clientId);
            }
        }

        // ==================== Public API ====================

        /// <summary>
        /// Gets player info by client ID.
        /// </summary>
        public PlayerInfo GetPlayer(int clientId)
        {
            _players.TryGetValue(clientId, out PlayerInfo info);
            return info;
        }

        /// <summary>
        /// Gets all player infos.
        /// </summary>
        public List<PlayerInfo> GetAllPlayers()
        {
            return new List<PlayerInfo>(_players.Values);
        }

        /// <summary>
        /// Gets all other players (excludes local).
        /// </summary>
        public List<PlayerInfo> GetOtherPlayers()
        {
            var others = new List<PlayerInfo>();
            foreach (var kvp in _players)
            {
                if (!kvp.Value.isLocalPlayer)
                {
                    others.Add(kvp.Value);
                }
            }
            return others;
        }

        /// <summary>
        /// Checks if a specific client is in the room.
        /// </summary>
        public bool IsPlayerInRoom(int clientId)
        {
            return _players.ContainsKey(clientId);
        }

        /// <summary>
        /// Gets the PlayerSync for a client ID.
        /// </summary>
        public PlayerSync GetPlayerSync(int clientId)
        {
            if (_players.TryGetValue(clientId, out PlayerInfo info))
            {
                return info.playerSync;
            }
            return null;
        }
    }

    /// <summary>
    /// Information about a player in the room.
    /// </summary>
    public class PlayerInfo
    {
        public int clientId;
        public string displayName;
        public bool isLocalPlayer;
        public float joinTime;
        public PlayerSync playerSync;

        /// <summary>
        /// Gets the player's current status.
        /// </summary>
        public PlayerStatus Status =>
            playerSync != null ? playerSync.GetStatus() : PlayerStatus.Available;

        /// <summary>
        /// Gets the duration the player has been in the room.
        /// </summary>
        public float TimeInRoom => Time.time - joinTime;
    }
}
