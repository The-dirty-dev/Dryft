using Normal.Realtime;
using Normal.Realtime.Serialization;

namespace Drift.Networking
{
    /// <summary>
    /// Normcore RealtimeModel for synchronizing haptic events between users.
    ///
    /// When User A triggers a haptic event (e.g., touches User B's avatar),
    /// this model syncs the haptic data to User B, who then plays it locally
    /// on their connected haptic device.
    ///
    /// LEGAL NOTE: Haptic events are synced with consent between matched,
    /// verified adult users only. The Normcore room key provides E2E encryption.
    /// </summary>
    [RealtimeModel]
    public partial class HapticSyncModel
    {
        /// <summary>
        /// Normcore client ID of the sender.
        /// </summary>
        [RealtimeProperty(1, true, true)]
        private int _senderId;

        /// <summary>
        /// Normcore client ID of the recipient (who should feel the haptic).
        /// </summary>
        [RealtimeProperty(2, true, true)]
        private int _recipientId;

        /// <summary>
        /// Haptic intensity (0.0 to 1.0). Used for pulse events.
        /// </summary>
        [RealtimeProperty(3, true, true)]
        private float _intensity;

        /// <summary>
        /// Duration in milliseconds. Used for pulse events.
        /// </summary>
        [RealtimeProperty(4, true, true)]
        private int _durationMs;

        /// <summary>
        /// Pattern name (e.g., "Foreplay", "Touch"). Empty for pulse events.
        /// </summary>
        [RealtimeProperty(5, true, true)]
        private string _patternName;

        /// <summary>
        /// Active flag - when set to true, triggers the haptic on recipient.
        /// Reset to false after processing.
        /// </summary>
        [RealtimeProperty(6, true, true)]
        private bool _active;

        /// <summary>
        /// Timestamp for ordering and deduplication.
        /// </summary>
        [RealtimeProperty(7, true, true)]
        private double _timestamp;

        /// <summary>
        /// Event type for more specific haptic commands.
        /// </summary>
        [RealtimeProperty(8, true, true)]
        private int _eventType; // HapticEventType enum
    }

    /// <summary>
    /// Types of haptic events that can be synced.
    /// </summary>
    public enum HapticEventType
    {
        Pulse = 0,      // Single pulse with intensity/duration
        Pattern = 1,    // Named pattern
        Continuous = 2, // Continuous vibration (intensity only)
        Stop = 3        // Stop all haptics
    }
}
