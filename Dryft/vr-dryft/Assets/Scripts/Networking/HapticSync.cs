using UnityEngine;
using Normal.Realtime;
using Drift.Haptics;

namespace Drift.Networking
{
    /// <summary>
    /// Component that syncs haptic events between users via Normcore.
    ///
    /// Attach to the Realtime object or a persistent game object.
    /// Listens for changes to HapticSyncModel and triggers local haptics
    /// when this client is the recipient.
    ///
    /// Usage:
    /// - Call SendHapticToPartner() to send a haptic pulse to another user
    /// - Call SendPatternToPartner() to send a pattern to another user
    /// - Incoming haptics are automatically played via HapticController
    /// </summary>
    [RequireComponent(typeof(RealtimeView))]
    public class HapticSync : RealtimeComponent<HapticSyncModel>
    {
        [Header("References")]
        [SerializeField] private HapticController _hapticController;

        [Header("Settings")]
        [SerializeField] private bool _logSyncEvents = true;

        private int _myClientId = -1;
        private double _lastProcessedTimestamp;

        private void Start()
        {
            if (_hapticController == null)
            {
                _hapticController = HapticController.Instance;
            }
        }

        private void OnEnable()
        {
            // Get our client ID when connected
            if (realtime != null && realtime.connected)
            {
                _myClientId = realtime.clientID;
            }
        }

        protected override void OnRealtimeModelReplaced(HapticSyncModel previousModel, HapticSyncModel currentModel)
        {
            // Unsubscribe from previous model
            if (previousModel != null)
            {
                previousModel.activeDidChange -= OnActiveChanged;
            }

            // Subscribe to new model
            if (currentModel != null)
            {
                currentModel.activeDidChange += OnActiveChanged;

                // Update client ID
                if (realtime != null && realtime.connected)
                {
                    _myClientId = realtime.clientID;
                }
            }
        }

        private void OnActiveChanged(HapticSyncModel model, bool active)
        {
            // Only process when active is set to true
            if (!active) return;

            // Only process if we're the recipient
            if (model.recipientId != _myClientId) return;

            // Deduplication - skip if we've already processed this timestamp
            if (model.timestamp <= _lastProcessedTimestamp) return;
            _lastProcessedTimestamp = model.timestamp;

            // Process the haptic event
            ProcessHapticEvent(model);

            // Reset active flag (we own this, so we can modify it)
            // Actually, let the sender reset it or let it time out
        }

        private async void ProcessHapticEvent(HapticSyncModel model)
        {
            if (_hapticController == null)
            {
                _hapticController = HapticController.Instance;
                if (_hapticController == null)
                {
                    Log("No HapticController available");
                    return;
                }
            }

            HapticEventType eventType = (HapticEventType)model.eventType;

            switch (eventType)
            {
                case HapticEventType.Pulse:
                    Log($"Received pulse from {model.senderId}: intensity={model.intensity:F2}, duration={model.durationMs}ms");
                    await _hapticController.Pulse(model.intensity, model.durationMs / 1000f);
                    break;

                case HapticEventType.Pattern:
                    Log($"Received pattern from {model.senderId}: {model.patternName}");
                    await _hapticController.PlayPattern(model.patternName);
                    break;

                case HapticEventType.Continuous:
                    Log($"Received continuous from {model.senderId}: intensity={model.intensity:F2}");
                    await _hapticController.SetContinuous(model.intensity);
                    break;

                case HapticEventType.Stop:
                    Log($"Received stop from {model.senderId}");
                    await _hapticController.Stop();
                    break;
            }
        }

        /// <summary>
        /// Sends a haptic pulse to another user.
        /// </summary>
        /// <param name="partnerId">Normcore client ID of the recipient.</param>
        /// <param name="intensity">Haptic intensity (0.0 to 1.0).</param>
        /// <param name="durationMs">Duration in milliseconds.</param>
        public void SendHapticToPartner(int partnerId, float intensity, int durationMs)
        {
            if (model == null)
            {
                Debug.LogWarning("[HapticSync] Model not ready");
                return;
            }

            model.senderId = _myClientId;
            model.recipientId = partnerId;
            model.intensity = Mathf.Clamp01(intensity);
            model.durationMs = Mathf.Max(0, durationMs);
            model.patternName = "";
            model.eventType = (int)HapticEventType.Pulse;
            model.timestamp = Time.realtimeSinceStartupAsDouble;
            model.active = true;

            Log($"Sent pulse to {partnerId}: intensity={intensity:F2}, duration={durationMs}ms");
        }

        /// <summary>
        /// Sends a haptic pattern to another user.
        /// </summary>
        /// <param name="partnerId">Normcore client ID of the recipient.</param>
        /// <param name="patternName">Name of the pattern to play.</param>
        public void SendPatternToPartner(int partnerId, string patternName)
        {
            if (model == null)
            {
                Debug.LogWarning("[HapticSync] Model not ready");
                return;
            }

            model.senderId = _myClientId;
            model.recipientId = partnerId;
            model.intensity = 0f;
            model.durationMs = 0;
            model.patternName = patternName ?? "";
            model.eventType = (int)HapticEventType.Pattern;
            model.timestamp = Time.realtimeSinceStartupAsDouble;
            model.active = true;

            Log($"Sent pattern to {partnerId}: {patternName}");
        }

        /// <summary>
        /// Sends continuous haptic to another user.
        /// </summary>
        /// <param name="partnerId">Normcore client ID of the recipient.</param>
        /// <param name="intensity">Haptic intensity (0.0 to 1.0). Use 0 to stop.</param>
        public void SendContinuousToPartner(int partnerId, float intensity)
        {
            if (model == null)
            {
                Debug.LogWarning("[HapticSync] Model not ready");
                return;
            }

            model.senderId = _myClientId;
            model.recipientId = partnerId;
            model.intensity = Mathf.Clamp01(intensity);
            model.durationMs = 0;
            model.patternName = "";
            model.eventType = (int)HapticEventType.Continuous;
            model.timestamp = Time.realtimeSinceStartupAsDouble;
            model.active = true;

            Log($"Sent continuous to {partnerId}: intensity={intensity:F2}");
        }

        /// <summary>
        /// Tells another user to stop their haptics.
        /// </summary>
        /// <param name="partnerId">Normcore client ID of the recipient.</param>
        public void SendStopToPartner(int partnerId)
        {
            if (model == null)
            {
                Debug.LogWarning("[HapticSync] Model not ready");
                return;
            }

            model.senderId = _myClientId;
            model.recipientId = partnerId;
            model.intensity = 0f;
            model.durationMs = 0;
            model.patternName = "";
            model.eventType = (int)HapticEventType.Stop;
            model.timestamp = Time.realtimeSinceStartupAsDouble;
            model.active = true;

            Log($"Sent stop to {partnerId}");
        }

        /// <summary>
        /// Sends the Foreplay pattern to partner.
        /// </summary>
        public void SendForeplayToPartner(int partnerId)
        {
            SendPatternToPartner(partnerId, "Foreplay");
        }

        /// <summary>
        /// Gets our Normcore client ID.
        /// </summary>
        public int MyClientId => _myClientId;

        private void Log(string message)
        {
            if (_logSyncEvents)
            {
                Debug.Log($"[HapticSync] {message}");
            }
        }
    }
}
