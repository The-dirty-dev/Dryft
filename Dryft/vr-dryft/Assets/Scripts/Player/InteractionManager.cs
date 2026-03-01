using UnityEngine;
using System;
using System.Collections;
using System.Collections.Generic;
using Drift.Core;
using Drift.Haptics;
using Drift.Networking;
using Drift.API;
using Drift.Safety;

namespace Drift.Player
{
    /// <summary>
    /// Manages interactions between players in VR.
    ///
    /// Handles:
    /// - Touch detection (hand-to-avatar contact)
    /// - Gesture recognition
    /// - Haptic triggering based on interactions
    /// - Consent-based interaction system
    ///
    /// LEGAL NOTE: All intimate interactions require mutual consent.
    /// Users can enable/disable interaction zones at any time.
    /// </summary>
    public class InteractionManager : MonoBehaviour
    {
        public static InteractionManager Instance { get; private set; }

        [Header("Settings")]
        [SerializeField] private float _touchRadius = 0.1f;
        [SerializeField] private float _touchHapticIntensity = 0.3f;
        [SerializeField] private LayerMask _interactableLayer;

        [Header("Proximity Settings")]
        [SerializeField] private float _proximityNearDistance = 0.5f;   // Start feeling presence
        [SerializeField] private float _proximityCloseDistance = 0.3f;  // Stronger feedback
        [SerializeField] private float _proximityIntimateDistance = 0.15f; // Very close
        [SerializeField] private float _proximityCheckInterval = 0.1f;
        [SerializeField] private float _proximityHapticIntensity = 0.2f;

        [Header("Gesture Settings")]
        [SerializeField] private float _gestureHoldTime = 0.5f;  // Time to hold for gesture
        [SerializeField] private float _caressSpeed = 0.3f;      // Speed threshold for caress detection

        [Header("Interaction Zones")]
        [SerializeField] private bool _handsEnabled = true;
        [SerializeField] private bool _bodyEnabled = true;
        [SerializeField] private bool _intimateZonesEnabled = false; // Requires explicit consent

        [Header("References")]
        [SerializeField] private PlayerController _playerController;
        [SerializeField] private HapticController _hapticController;
        [SerializeField] private CompanionSessionManager _companionSession;

        // Active interactions
        private Dictionary<int, InteractionState> _activeInteractions = new Dictionary<int, InteractionState>();

        // Partner avatar (when in private booth)
        private AvatarController _partnerAvatar;
        private int _partnerClientId = -1;

        // Consent state
        private HashSet<InteractionZone> _consentedZones = new HashSet<InteractionZone>();

        // Proximity state
        private float _lastProximityCheck;
        private ProximityLevel _currentProximityLevel = ProximityLevel.None;
        private float _partnerDistance = float.MaxValue;
        private Coroutine _proximityHapticCoroutine;

        // Gesture tracking
        private Dictionary<OVRInput.Controller, GestureState> _gestureStates = new Dictionary<OVRInput.Controller, GestureState>();
        private Vector3 _lastLeftHandPos;
        private Vector3 _lastRightHandPos;

        // Events
        public event Action<InteractionEvent> OnInteractionStarted;
        public event Action<InteractionEvent> OnInteractionEnded;
        public event Action<InteractionZone> OnConsentGranted;
        public event Action<InteractionZone> OnConsentRevoked;
        public event Action<ProximityLevel> OnProximityChanged;
        public event Action<GestureType, OVRInput.Controller> OnGestureDetected;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            if (_playerController == null)
                _playerController = PlayerController.Instance;
            if (_hapticController == null)
                _hapticController = HapticController.Instance;
            if (_companionSession == null)
                _companionSession = CompanionSessionManager.Instance;

            // Initialize gesture states
            _gestureStates[OVRInput.Controller.LTouch] = new GestureState();
            _gestureStates[OVRInput.Controller.RTouch] = new GestureState();
        }

        private void OnDestroy()
        {
            if (Instance == this)
            {
                if (_proximityHapticCoroutine != null)
                    StopCoroutine(_proximityHapticCoroutine);
                Instance = null;
            }
        }

        private void Update()
        {
            if (_partnerAvatar == null) return;

            CheckHandInteractions();
            CheckProximity();
            CheckGestures();
        }

        /// <summary>
        /// Sets the partner avatar for interaction detection.
        /// Called when entering a private booth.
        /// </summary>
        public void SetPartner(AvatarController avatar, int clientId)
        {
            _partnerAvatar = avatar;
            _partnerClientId = clientId;
            _activeInteractions.Clear();

            Debug.Log($"[InteractionManager] Partner set: clientId={clientId}");
        }

        /// <summary>
        /// Sets the partner avatar via Transform (overload for BoothManager).
        /// </summary>
        public void SetPartner(Transform partnerTransform, int clientId)
        {
            // Check if partner is blocked
            var partner = SessionManager.Instance?.Partner;
            if (partner != null && SafetyManager.Instance != null)
            {
                if (SafetyManager.Instance.IsUserBlocked(partner.UserId))
                {
                    Debug.LogWarning("[InteractionManager] Cannot set partner - user is blocked");
                    return;
                }
            }

            // Try to get AvatarController from transform
            var avatarController = partnerTransform?.GetComponent<AvatarController>();
            if (avatarController != null)
            {
                SetPartner(avatarController, clientId);
            }
            else
            {
                // Create wrapper or store transform directly
                _partnerClientId = clientId;
                _activeInteractions.Clear();
                Debug.Log($"[InteractionManager] Partner set (transform): clientId={clientId}");
            }
        }

        /// <summary>
        /// Clears the partner (leaving private booth).
        /// </summary>
        public void ClearPartner()
        {
            // End all active interactions
            foreach (var interaction in _activeInteractions.Values)
            {
                EndInteraction(interaction);
            }

            _partnerAvatar = null;
            _partnerClientId = -1;
            _activeInteractions.Clear();

            Debug.Log("[InteractionManager] Partner cleared");
        }

        /// <summary>
        /// Grants consent for a specific interaction zone.
        /// </summary>
        public void GrantConsent(InteractionZone zone)
        {
            if (_consentedZones.Add(zone))
            {
                Debug.Log($"[InteractionManager] Consent granted for: {zone}");
                OnConsentGranted?.Invoke(zone);

                // Enable zone
                if (zone == InteractionZone.Intimate)
                    _intimateZonesEnabled = true;
            }
        }

        /// <summary>
        /// Revokes consent for a specific interaction zone.
        /// </summary>
        public void RevokeConsent(InteractionZone zone)
        {
            if (_consentedZones.Remove(zone))
            {
                Debug.Log($"[InteractionManager] Consent revoked for: {zone}");
                OnConsentRevoked?.Invoke(zone);

                // Disable zone
                if (zone == InteractionZone.Intimate)
                    _intimateZonesEnabled = false;

                // End any active interactions in that zone
                var toRemove = new List<int>();
                foreach (var kvp in _activeInteractions)
                {
                    if (kvp.Value.Zone == zone)
                    {
                        EndInteraction(kvp.Value);
                        toRemove.Add(kvp.Key);
                    }
                }
                foreach (var id in toRemove)
                {
                    _activeInteractions.Remove(id);
                }
            }
        }

        /// <summary>
        /// Revokes all consent immediately.
        /// </summary>
        public void RevokeAllConsent()
        {
            foreach (var zone in new List<InteractionZone>(_consentedZones))
            {
                RevokeConsent(zone);
            }
            _intimateZonesEnabled = false;
        }

        /// <summary>
        /// Checks if consent is granted for a zone.
        /// </summary>
        public bool HasConsent(InteractionZone zone)
        {
            return _consentedZones.Contains(zone);
        }

        private void CheckHandInteractions()
        {
            if (!_playerController.IsInteractionEnabled) return;

            // Check left hand
            CheckHandTouch(
                _playerController.LeftHandPosition,
                OVRInput.Controller.LTouch,
                0 // Interaction ID for left hand
            );

            // Check right hand
            CheckHandTouch(
                _playerController.RightHandPosition,
                OVRInput.Controller.RTouch,
                1 // Interaction ID for right hand
            );
        }

        private void CheckHandTouch(Vector3 handPosition, OVRInput.Controller controller, int interactionId)
        {
            // Check distance to partner's body parts
            InteractionZone hitZone = InteractionZone.None;
            AvatarPart hitPart = AvatarPart.Head;
            float closestDist = float.MaxValue;

            // Check each avatar part
            foreach (AvatarPart part in System.Enum.GetValues(typeof(AvatarPart)))
            {
                float dist = _partnerAvatar.GetHandDistanceTo(part, handPosition);
                if (dist < _touchRadius && dist < closestDist)
                {
                    closestDist = dist;
                    hitPart = part;
                    hitZone = GetZoneForPart(part);
                }
            }

            // Check if we should process this zone
            if (hitZone != InteractionZone.None && IsZoneEnabled(hitZone))
            {
                // Start or continue interaction
                if (!_activeInteractions.ContainsKey(interactionId))
                {
                    StartInteraction(interactionId, controller, hitPart, hitZone);
                }
                else
                {
                    UpdateInteraction(interactionId, closestDist);
                }
            }
            else
            {
                // End interaction if active
                if (_activeInteractions.TryGetValue(interactionId, out var interaction))
                {
                    EndInteraction(interaction);
                    _activeInteractions.Remove(interactionId);
                }
            }
        }

        private void StartInteraction(int id, OVRInput.Controller controller, AvatarPart part, InteractionZone zone)
        {
            var interaction = new InteractionState
            {
                Id = id,
                Controller = controller,
                TargetPart = part,
                Zone = zone,
                StartTime = Time.time,
                LastDistance = 0
            };

            _activeInteractions[id] = interaction;

            // Trigger haptic on partner
            SendTouchHaptic(zone);

            // Fire event
            var evt = new InteractionEvent
            {
                Type = InteractionEventType.Started,
                Zone = zone,
                Part = part,
                Controller = controller
            };
            OnInteractionStarted?.Invoke(evt);

            Debug.Log($"[InteractionManager] Interaction started: {part} ({zone})");
        }

        private void UpdateInteraction(int id, float distance)
        {
            if (!_activeInteractions.TryGetValue(id, out var interaction))
                return;

            // Could modulate haptic intensity based on pressure/distance
            float intensity = Mathf.InverseLerp(_touchRadius, 0, distance);
            interaction.LastDistance = distance;
            interaction.CurrentIntensity = intensity;

            // Send continuous haptic based on intensity
            if (Time.time - interaction.LastHapticTime > 0.1f)
            {
                SendContinuousHaptic(interaction.Zone, intensity);
                interaction.LastHapticTime = Time.time;
            }
        }

        private void EndInteraction(InteractionState interaction)
        {
            // Stop haptic
            StopPartnerHaptic();

            // Fire event
            var evt = new InteractionEvent
            {
                Type = InteractionEventType.Ended,
                Zone = interaction.Zone,
                Part = interaction.TargetPart,
                Controller = interaction.Controller,
                Duration = Time.time - interaction.StartTime
            };
            OnInteractionEnded?.Invoke(evt);

            Debug.Log($"[InteractionManager] Interaction ended: {interaction.TargetPart} (duration: {evt.Duration:F2}s)");
        }

        private void SendTouchHaptic(InteractionZone zone)
        {
            if (_partnerClientId < 0) return;

            var hapticSync = FindObjectOfType<HapticSync>();
            if (hapticSync == null) return;

            // Different patterns for different zones
            string pattern = zone switch
            {
                InteractionZone.Hand => "Touch",
                InteractionZone.Body => "Caress",
                InteractionZone.Intimate => "Foreplay",
                _ => "Touch"
            };

            hapticSync.SendPatternToPartner(_partnerClientId, pattern);
        }

        private void SendContinuousHaptic(InteractionZone zone, float intensity)
        {
            if (_partnerClientId < 0) return;

            var hapticSync = FindObjectOfType<HapticSync>();
            if (hapticSync == null) return;

            // Scale intensity based on zone sensitivity
            float scaledIntensity = zone switch
            {
                InteractionZone.Intimate => intensity * 1.5f,
                InteractionZone.Body => intensity,
                _ => intensity * 0.7f
            };

            hapticSync.SendContinuousToPartner(_partnerClientId, Mathf.Clamp01(scaledIntensity));
        }

        private void StopPartnerHaptic()
        {
            if (_partnerClientId < 0) return;

            var hapticSync = FindObjectOfType<HapticSync>();
            hapticSync?.SendStopToPartner(_partnerClientId);
        }

        private InteractionZone GetZoneForPart(AvatarPart part)
        {
            return part switch
            {
                AvatarPart.LeftHand or AvatarPart.RightHand => InteractionZone.Hand,
                AvatarPart.Head => InteractionZone.Head,
                AvatarPart.Body => InteractionZone.Body,
                _ => InteractionZone.None
            };
        }

        private bool IsZoneEnabled(InteractionZone zone)
        {
            return zone switch
            {
                InteractionZone.Hand => _handsEnabled,
                InteractionZone.Head => true, // Always allow head
                InteractionZone.Body => _bodyEnabled,
                InteractionZone.Intimate => _intimateZonesEnabled && HasConsent(InteractionZone.Intimate),
                _ => false
            };
        }

        /// <summary>
        /// Triggers a specific pattern on the partner.
        /// Can be called from UI buttons etc.
        /// </summary>
        public void TriggerPatternOnPartner(string patternName)
        {
            if (_partnerClientId < 0)
            {
                Debug.LogWarning("[InteractionManager] No partner to send pattern to");
                return;
            }

            var hapticSync = FindObjectOfType<HapticSync>();
            hapticSync?.SendPatternToPartner(_partnerClientId, patternName);

            // Also notify companions
            NotifyCompanions(InteractionEventType.Started, InteractionZone.Body, patternName);
        }

        // ==========================================================================
        // Proximity Detection
        // ==========================================================================

        private void CheckProximity()
        {
            if (Time.time - _lastProximityCheck < _proximityCheckInterval) return;
            _lastProximityCheck = Time.time;

            if (_partnerAvatar == null || _playerController == null) return;

            // Calculate distance between heads
            Vector3 myHead = _playerController.HeadPosition;
            Vector3 partnerHead = _partnerAvatar.GetPartPosition(AvatarPart.Head);
            _partnerDistance = Vector3.Distance(myHead, partnerHead);

            // Determine proximity level
            ProximityLevel newLevel = ProximityLevel.None;
            if (_partnerDistance <= _proximityIntimateDistance)
                newLevel = ProximityLevel.Intimate;
            else if (_partnerDistance <= _proximityCloseDistance)
                newLevel = ProximityLevel.Close;
            else if (_partnerDistance <= _proximityNearDistance)
                newLevel = ProximityLevel.Near;

            // Handle level change
            if (newLevel != _currentProximityLevel)
            {
                ProximityLevel previousLevel = _currentProximityLevel;
                _currentProximityLevel = newLevel;

                OnProximityChanged?.Invoke(newLevel);
                HandleProximityChange(previousLevel, newLevel);

                Debug.Log($"[InteractionManager] Proximity changed: {previousLevel} -> {newLevel} (distance: {_partnerDistance:F2}m)");
            }
        }

        private void HandleProximityChange(ProximityLevel previous, ProximityLevel current)
        {
            // Stop previous proximity haptic
            if (_proximityHapticCoroutine != null)
            {
                StopCoroutine(_proximityHapticCoroutine);
                _proximityHapticCoroutine = null;
            }

            // Start new proximity haptic based on level
            switch (current)
            {
                case ProximityLevel.Near:
                    // Gentle pulse when entering near range
                    TriggerProximityHaptic(0.1f, 200);
                    NotifyCompanions(InteractionEventType.Started, InteractionZone.Body, "proximity_near");
                    break;

                case ProximityLevel.Close:
                    // Soft continuous when close
                    _proximityHapticCoroutine = StartCoroutine(ProximityHapticLoop(0.15f, 0.5f));
                    NotifyCompanions(InteractionEventType.Started, InteractionZone.Body, "proximity_close");
                    break;

                case ProximityLevel.Intimate:
                    // Stronger continuous when very close
                    _proximityHapticCoroutine = StartCoroutine(ProximityHapticLoop(0.25f, 0.3f));
                    NotifyCompanions(InteractionEventType.Started, InteractionZone.Body, "proximity_intimate");
                    break;

                case ProximityLevel.None:
                    if (previous != ProximityLevel.None)
                    {
                        NotifyCompanions(InteractionEventType.Ended, InteractionZone.Body, "proximity_ended");
                    }
                    break;
            }
        }

        private void TriggerProximityHaptic(float intensity, int durationMs)
        {
            // Local haptic
            _hapticController?.Pulse(intensity, durationMs / 1000f);

            // Partner haptic
            if (_partnerClientId >= 0)
            {
                var hapticSync = FindObjectOfType<HapticSync>();
                hapticSync?.SendHapticToPartner(_partnerClientId, intensity, durationMs);
            }
        }

        private IEnumerator ProximityHapticLoop(float intensity, float interval)
        {
            while (true)
            {
                TriggerProximityHaptic(intensity * _proximityHapticIntensity, 100);
                yield return new WaitForSeconds(interval);
            }
        }

        // ==========================================================================
        // Gesture Detection
        // ==========================================================================

        private void CheckGestures()
        {
            if (_playerController == null) return;

            // Track hand velocities for gesture detection
            Vector3 leftHandPos = _playerController.LeftHandPosition;
            Vector3 rightHandPos = _playerController.RightHandPosition;

            Vector3 leftVelocity = (leftHandPos - _lastLeftHandPos) / Time.deltaTime;
            Vector3 rightVelocity = (rightHandPos - _lastRightHandPos) / Time.deltaTime;

            _lastLeftHandPos = leftHandPos;
            _lastRightHandPos = rightHandPos;

            // Check for gestures on each hand
            CheckHandGesture(OVRInput.Controller.LTouch, leftHandPos, leftVelocity);
            CheckHandGesture(OVRInput.Controller.RTouch, rightHandPos, rightVelocity);
        }

        private void CheckHandGesture(OVRInput.Controller controller, Vector3 position, Vector3 velocity)
        {
            if (!_gestureStates.TryGetValue(controller, out var state))
                return;

            float speed = velocity.magnitude;
            bool triggerHeld = _playerController.GetTriggerValue(controller) > 0.5f;
            bool gripHeld = _playerController.GetGripValue(controller) > 0.5f;

            // Detect caress gesture: slow movement while touching
            if (_activeInteractions.ContainsKey(controller == OVRInput.Controller.LTouch ? 0 : 1))
            {
                if (speed > 0.05f && speed < _caressSpeed)
                {
                    if (!state.IsCaressing)
                    {
                        state.IsCaressing = true;
                        state.CaressStartTime = Time.time;
                        OnGestureDetected?.Invoke(GestureType.CaressStart, controller);
                        Debug.Log($"[InteractionManager] Caress started: {controller}");

                        // Trigger caress pattern
                        TriggerPatternOnPartner("Caress");
                    }
                }
                else if (state.IsCaressing && speed < 0.01f)
                {
                    // Stopped moving - end caress
                    state.IsCaressing = false;
                    OnGestureDetected?.Invoke(GestureType.CaressEnd, controller);
                    Debug.Log($"[InteractionManager] Caress ended: {controller}");
                }
            }
            else
            {
                state.IsCaressing = false;
            }

            // Detect hold gesture: stationary while gripping
            if (gripHeld && speed < 0.02f)
            {
                if (!state.IsHolding)
                {
                    state.IsHolding = true;
                    state.HoldStartTime = Time.time;
                }
                else if (Time.time - state.HoldStartTime >= _gestureHoldTime && !state.HoldTriggered)
                {
                    state.HoldTriggered = true;
                    OnGestureDetected?.Invoke(GestureType.Hold, controller);
                    Debug.Log($"[InteractionManager] Hold gesture: {controller}");

                    // Trigger hold pattern
                    TriggerPatternOnPartner("Hold");
                }
            }
            else
            {
                if (state.IsHolding && state.HoldTriggered)
                {
                    OnGestureDetected?.Invoke(GestureType.HoldRelease, controller);
                }
                state.IsHolding = false;
                state.HoldTriggered = false;
            }

            // Detect squeeze gesture: trigger pull intensity
            if (triggerHeld && _activeInteractions.ContainsKey(controller == OVRInput.Controller.LTouch ? 0 : 1))
            {
                float triggerValue = _playerController.GetTriggerValue(controller);
                if (!state.IsSqueezing && triggerValue > 0.8f)
                {
                    state.IsSqueezing = true;
                    OnGestureDetected?.Invoke(GestureType.Squeeze, controller);
                    Debug.Log($"[InteractionManager] Squeeze gesture: {controller}");

                    // Intense haptic for squeeze
                    TriggerProximityHaptic(0.8f, 500);
                    NotifyCompanions(InteractionEventType.Started, InteractionZone.Body, "squeeze");
                }
                else if (state.IsSqueezing && triggerValue < 0.3f)
                {
                    state.IsSqueezing = false;
                    OnGestureDetected?.Invoke(GestureType.SqueezeRelease, controller);
                }
            }
            else
            {
                state.IsSqueezing = false;
            }
        }

        // ==========================================================================
        // Companion Session Integration
        // ==========================================================================

        private void NotifyCompanions(InteractionEventType eventType, InteractionZone zone, string detail)
        {
            if (_companionSession == null)
                _companionSession = CompanionSessionManager.Instance;

            if (_companionSession == null || !_companionSession.HasActiveSession)
                return;

            // Send haptic to all companions based on event
            float intensity = GetIntensityForEvent(zone, detail);
            int duration = GetDurationForEvent(detail);

            if (eventType == InteractionEventType.Started && intensity > 0)
            {
                foreach (var companion in _companionSession.Companions)
                {
                    _ = _companionSession.SendHapticToCompanion(companion.user_id, intensity, duration);
                }
            }
        }

        private float GetIntensityForEvent(InteractionZone zone, string detail)
        {
            // Base intensity on zone and event type
            float baseIntensity = zone switch
            {
                InteractionZone.Intimate => 0.7f,
                InteractionZone.Body => 0.5f,
                InteractionZone.Hand => 0.3f,
                _ => 0.2f
            };

            // Modify based on detail
            if (detail.Contains("intimate")) baseIntensity *= 1.3f;
            if (detail.Contains("close")) baseIntensity *= 1.1f;
            if (detail.Contains("squeeze")) baseIntensity = 0.9f;
            if (detail.Contains("caress")) baseIntensity *= 0.8f;

            return Mathf.Clamp01(baseIntensity);
        }

        private int GetDurationForEvent(string detail)
        {
            if (detail.Contains("squeeze")) return 500;
            if (detail.Contains("caress")) return 1500;
            if (detail.Contains("hold")) return 2000;
            if (detail.Contains("intimate")) return 1000;
            if (detail.Contains("close")) return 800;
            return 500;
        }

        /// <summary>
        /// Gets the current proximity level to partner.
        /// </summary>
        public ProximityLevel CurrentProximityLevel => _currentProximityLevel;

        /// <summary>
        /// Gets the current distance to partner in meters.
        /// </summary>
        public float PartnerDistance => _partnerDistance;
    }

    /// <summary>
    /// Interaction zones on the avatar.
    /// </summary>
    public enum InteractionZone
    {
        None,
        Hand,
        Head,
        Body,
        Intimate  // Requires explicit consent
    }

    /// <summary>
    /// State of an active interaction.
    /// </summary>
    public class InteractionState
    {
        public int Id;
        public OVRInput.Controller Controller;
        public AvatarPart TargetPart;
        public InteractionZone Zone;
        public float StartTime;
        public float LastDistance;
        public float CurrentIntensity;
        public float LastHapticTime;
    }

    /// <summary>
    /// Event data for interactions.
    /// </summary>
    public struct InteractionEvent
    {
        public InteractionEventType Type;
        public InteractionZone Zone;
        public AvatarPart Part;
        public OVRInput.Controller Controller;
        public float Duration; // Only set for Ended events
    }

    public enum InteractionEventType
    {
        Started,
        Ended
    }

    /// <summary>
    /// Proximity levels between players.
    /// </summary>
    public enum ProximityLevel
    {
        None,       // Too far for haptic feedback
        Near,       // Starting to feel presence
        Close,      // Close enough for light feedback
        Intimate    // Very close, stronger feedback
    }

    /// <summary>
    /// Gesture types that can trigger haptics.
    /// </summary>
    public enum GestureType
    {
        CaressStart,
        CaressEnd,
        Hold,
        HoldRelease,
        Squeeze,
        SqueezeRelease,
        Tap,
        DoubleTap
    }

    /// <summary>
    /// Tracks gesture state for a controller.
    /// </summary>
    public class GestureState
    {
        public bool IsCaressing;
        public float CaressStartTime;
        public bool IsHolding;
        public float HoldStartTime;
        public bool HoldTriggered;
        public bool IsSqueezing;
        public Vector3 LastPosition;
        public float LastTapTime;
        public int TapCount;
    }
}
