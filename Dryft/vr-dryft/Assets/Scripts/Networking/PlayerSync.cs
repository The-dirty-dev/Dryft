using UnityEngine;
using Normal.Realtime;
using Drift.Core;
using Drift.Environment;
using Drift.Marketplace;
using Drift.API;

namespace Drift.Networking
{
    /// <summary>
    /// Component that syncs player state across the network.
    /// Attach to the player prefab.
    /// </summary>
    [RequireComponent(typeof(RealtimeView))]
    public class PlayerSync : RealtimeComponent<PlayerSyncModel>
    {
        [Header("References")]
        [SerializeField] private TMPro.TextMeshPro _nameTag;
        [SerializeField] private GameObject _statusIndicator;
        [SerializeField] private SpriteRenderer _statusIcon;
        [SerializeField] private Player.AvatarController _avatarController;

        [Header("Status Colors")]
        [SerializeField] private Color _availableColor = Color.green;
        [SerializeField] private Color _busyColor = Color.yellow;
        [SerializeField] private Color _dndColor = Color.red;

        [Header("Voice")]
        [SerializeField] private RealtimeAvatarVoice _voice;
        [SerializeField] private GameObject _speakingIndicator;

        // Cached state
        private bool _isLocalPlayer;

        private void Start()
        {
            _isLocalPlayer = realtimeView.isOwnedLocallyInHierarchy;

            if (_isLocalPlayer)
            {
                // Initialize with local player data
                InitializeLocalPlayer();
            }
            else
            {
                // Apply synced state for remote players
                ApplyRemoteState();
            }

            // Subscribe to zone changes
            if (ZoneManager.Instance != null)
            {
                ZoneManager.Instance.OnZoneChanged += HandleZoneChanged;
            }
        }

        private void OnDestroy()
        {
            if (ZoneManager.Instance != null)
            {
                ZoneManager.Instance.OnZoneChanged -= HandleZoneChanged;
            }
        }

        private void Update()
        {
            // Update speaking indicator
            if (_voice != null && _speakingIndicator != null)
            {
                bool isSpeaking = _voice.voiceVolume > 0.01f;
                _speakingIndicator.SetActive(isSpeaking);

                if (_isLocalPlayer && model != null)
                {
                    model.isSpeaking = isSpeaking;
                }
            }
        }

        protected override void OnRealtimeModelReplaced(PlayerSyncModel previousModel, PlayerSyncModel currentModel)
        {
            if (previousModel != null)
            {
                previousModel.displayNameDidChange -= OnDisplayNameChanged;
                previousModel.avatarIdDidChange -= OnAvatarIdChanged;
                previousModel.statusDidChange -= OnStatusChanged;
                previousModel.isMutedDidChange -= OnMutedChanged;
            }

            if (currentModel != null)
            {
                currentModel.displayNameDidChange += OnDisplayNameChanged;
                currentModel.avatarIdDidChange += OnAvatarIdChanged;
                currentModel.statusDidChange += OnStatusChanged;
                currentModel.isMutedDidChange += OnMutedChanged;

                // Apply current state
                if (!_isLocalPlayer)
                {
                    ApplyRemoteState();
                }
            }
        }

        private void InitializeLocalPlayer()
        {
            if (model == null) return;

            // Set from GameManager
            if (GameManager.Instance != null)
            {
                model.displayName = GameManager.Instance.UserDisplayName ?? "Player";
                model.userId = GameManager.Instance.UserId ?? string.Empty;
            }

            // Set from InventoryManager
            if (InventoryManager.Instance != null)
            {
                var equipped = InventoryManager.Instance.GetEquippedItems();
                foreach (var item in equipped)
                {
                    if (item.item == null)
                    {
                        continue;
                    }

                    switch (item.item.ItemType)
                    {
                        case ItemType.Avatar:
                            model.equippedAvatar = item.item_id;
                            break;
                        case ItemType.Outfit:
                            model.equippedOutfit = item.item_id;
                            break;
                    }
                }
            }

            // Set initial status
            model.status = (int)PlayerStatus.Available;
            model.isMuted = false;

            Debug.Log($"[PlayerSync] Initialized local player: {model.displayName}");
        }

        private void ApplyRemoteState()
        {
            if (model == null) return;

            // Update name tag
            UpdateNameTag();

            // Update status indicator
            UpdateStatusIndicator();

            // Load avatar
            if (!string.IsNullOrEmpty(model.equippedAvatar) && _avatarController != null)
            {
                // Would load the avatar asset
                Debug.Log($"[PlayerSync] Remote player avatar: {model.equippedAvatar}");
            }
        }

        private void OnDisplayNameChanged(PlayerSyncModel m, string value)
        {
            UpdateNameTag();
        }

        private void OnAvatarIdChanged(PlayerSyncModel m, string value)
        {
            if (!_isLocalPlayer && _avatarController != null && !string.IsNullOrEmpty(value))
            {
                // Load avatar for remote player
                Debug.Log($"[PlayerSync] Loading avatar: {value}");
            }
        }

        private void OnStatusChanged(PlayerSyncModel m, int value)
        {
            UpdateStatusIndicator();
        }

        private void OnMutedChanged(PlayerSyncModel m, bool value)
        {
            if (_voice != null)
            {
                _voice.mute = value;
            }
        }

        private void UpdateNameTag()
        {
            if (_nameTag == null || model == null) return;

            _nameTag.text = model.displayName ?? "Player";
        }

        private void UpdateStatusIndicator()
        {
            if (_statusIndicator == null || _statusIcon == null || model == null) return;

            var status = (PlayerStatus)model.status;
            Color color = status switch
            {
                PlayerStatus.Available => _availableColor,
                PlayerStatus.Busy => _busyColor,
                PlayerStatus.InConversation => _busyColor,
                PlayerStatus.DoNotDisturb => _dndColor,
                PlayerStatus.Away => Color.gray,
                _ => _availableColor
            };

            _statusIcon.color = color;
        }

        private void HandleZoneChanged(Zone oldZone, Zone newZone)
        {
            if (!_isLocalPlayer || model == null) return;

            model.currentZone = newZone != null ? (int)newZone.zoneType : 0;
        }

        // ==================== Public API ====================

        /// <summary>
        /// Sets the player's status.
        /// </summary>
        public void SetStatus(PlayerStatus status)
        {
            if (!_isLocalPlayer || model == null) return;
            model.status = (int)status;
        }

        /// <summary>
        /// Sets mute state.
        /// </summary>
        public void SetMuted(bool muted)
        {
            if (!_isLocalPlayer || model == null) return;
            model.isMuted = muted;

            if (_voice != null)
            {
                _voice.mute = muted;
            }
        }

        /// <summary>
        /// Sets the custom status message.
        /// </summary>
        public void SetStatusMessage(string message)
        {
            if (!_isLocalPlayer || model == null) return;
            model.statusMessage = message;
        }

        /// <summary>
        /// Updates equipped avatar.
        /// </summary>
        public void SetEquippedAvatar(string avatarId)
        {
            if (!_isLocalPlayer || model == null) return;
            model.equippedAvatar = avatarId;
        }

        /// <summary>
        /// Gets the display name.
        /// </summary>
        public string GetDisplayName()
        {
            return model?.displayName ?? "Player";
        }

        /// <summary>
        /// Gets the stable user ID for this player.
        /// </summary>
        public string GetUserId()
        {
            return model?.userId ?? string.Empty;
        }

        /// <summary>
        /// Gets the current status.
        /// </summary>
        public PlayerStatus GetStatus()
        {
            return model != null ? (PlayerStatus)model.status : PlayerStatus.Available;
        }

        /// <summary>
        /// Gets whether this player is the local player.
        /// </summary>
        public bool IsLocalPlayer => _isLocalPlayer;

        /// <summary>
        /// Gets the owner client ID.
        /// </summary>
        public int OwnerClientId => realtimeView.ownerIDInHierarchy;
    }
}
