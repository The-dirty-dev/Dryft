using UnityEngine;
using Normal.Realtime;
using Normal.Realtime.Serialization;

namespace Drift.Networking
{
    /// <summary>
    /// Normcore RealtimeModel for syncing player state.
    ///
    /// Syncs:
    /// - Display name
    /// - Avatar ID
    /// - Equipped items
    /// - Status (available, busy, in conversation)
    /// </summary>
    [RealtimeModel]
    public partial class PlayerSyncModel
    {
        // Basic identity
        [RealtimeProperty(1, true, true)]
        private string _displayName;

        [RealtimeProperty(2, true, true)]
        private string _avatarId;

        // User status
        [RealtimeProperty(3, true)]
        private int _status; // PlayerStatus enum

        // Currently equipped items (serialized as JSON or IDs)
        [RealtimeProperty(4, true, true)]
        private string _equippedAvatar;

        [RealtimeProperty(5, true, true)]
        private string _equippedOutfit;

        [RealtimeProperty(6, true, true)]
        private string _equippedEffects; // Comma-separated effect IDs

        // Voice state
        [RealtimeProperty(7, true)]
        private bool _isMuted;

        [RealtimeProperty(8, true)]
        private bool _isSpeaking;

        // Position in bar (for minimap/presence)
        [RealtimeProperty(9, true)]
        private int _currentZone; // ZoneType enum

        // Custom status message
        [RealtimeProperty(10, true, true)]
        private string _statusMessage;

        // Profile photo URL (for UI display)
        [RealtimeProperty(11, true, true)]
        private string _profilePhotoUrl;
    }

    /// <summary>
    /// Player status states.
    /// </summary>
    public enum PlayerStatus
    {
        Available = 0,
        Busy = 1,
        InConversation = 2,
        DoNotDisturb = 3,
        Away = 4
    }
}
