using UnityEngine;
using System.Collections;
using Drift.Player;
using Drift.Haptics;
using Drift.Core;

namespace Drift.Interaction
{
    /// <summary>
    /// Creates a zone that provides ambient haptic feedback while inside.
    /// Useful for creating atmospheric areas like intimate booths, dance floors, etc.
    ///
    /// Features:
    /// - Entry/exit haptic pulses
    /// - Continuous ambient haptics while inside
    /// - Pattern playback
    /// - Synced with partner and companions
    /// </summary>
    [RequireComponent(typeof(Collider))]
    public class HapticZone : MonoBehaviour
    {
        [Header("Zone Settings")]
        [SerializeField] private ZoneType _zoneType = ZoneType.Ambient;
        [SerializeField] private string _zoneName = "Haptic Zone";
        [SerializeField] private bool _requiresConsent = false;

        [Header("Entry/Exit Haptics")]
        [SerializeField] private float _entryIntensity = 0.4f;
        [SerializeField] private int _entryDurationMs = 300;
        [SerializeField] private string _entryPattern = "";
        [SerializeField] private float _exitIntensity = 0.2f;
        [SerializeField] private int _exitDurationMs = 200;

        [Header("Ambient Haptics")]
        [SerializeField] private bool _enableAmbientHaptics = true;
        [SerializeField] private float _ambientIntensity = 0.15f;
        [SerializeField] private float _ambientInterval = 2f;
        [SerializeField] private float _ambientVariation = 0.3f; // Random intensity variation

        [Header("Music Sync")]
        [SerializeField] private bool _syncToMusic = false;
        [SerializeField] private AudioSource _musicSource;
        [SerializeField] private float _beatMultiplier = 1.5f;

        [Header("Partner Sync")]
        [SerializeField] private bool _syncWithPartner = true;
        [SerializeField] private bool _syncWithCompanions = true;

        // State
        private bool _playerInZone;
        private Coroutine _ambientCoroutine;
        private HapticController _hapticController;
        private CompanionSessionManager _companionSession;
        private float _lastBeatTime;

        // Events
        public System.Action<HapticZone> OnPlayerEntered;
        public System.Action<HapticZone> OnPlayerExited;

        private void Start()
        {
            _hapticController = HapticController.Instance;
            _companionSession = CompanionSessionManager.Instance;

            // Ensure trigger
            var collider = GetComponent<Collider>();
            if (collider != null)
                collider.isTrigger = true;
        }

        private void OnTriggerEnter(Collider other)
        {
            if (!IsPlayer(other)) return;
            if (_playerInZone) return;

            // Check consent if required
            if (_requiresConsent)
            {
                var interactionManager = InteractionManager.Instance;
                if (interactionManager == null || !interactionManager.HasConsent(InteractionZone.Intimate))
                {
                    Debug.Log($"[HapticZone] {_zoneName}: Consent required but not granted");
                    return;
                }
            }

            _playerInZone = true;

            // Entry haptic
            TriggerHaptic(_entryIntensity, _entryDurationMs);

            if (!string.IsNullOrEmpty(_entryPattern))
            {
                _ = _hapticController?.PlayPattern(_entryPattern);
            }

            // Start ambient haptics
            if (_enableAmbientHaptics)
            {
                _ambientCoroutine = StartCoroutine(AmbientHapticLoop());
            }

            OnPlayerEntered?.Invoke(this);
            Debug.Log($"[HapticZone] Player entered: {_zoneName}");
        }

        private void OnTriggerExit(Collider other)
        {
            if (!IsPlayer(other)) return;
            if (!_playerInZone) return;

            _playerInZone = false;

            // Exit haptic
            TriggerHaptic(_exitIntensity, _exitDurationMs);

            // Stop ambient haptics
            if (_ambientCoroutine != null)
            {
                StopCoroutine(_ambientCoroutine);
                _ambientCoroutine = null;
            }

            OnPlayerExited?.Invoke(this);
            Debug.Log($"[HapticZone] Player exited: {_zoneName}");
        }

        private bool IsPlayer(Collider other)
        {
            // Check various ways to identify the player
            if (other.CompareTag("Player")) return true;
            if (other.GetComponent<PlayerController>() != null) return true;
            if (other.GetComponentInParent<PlayerController>() != null) return true;

            return false;
        }

        private IEnumerator AmbientHapticLoop()
        {
            while (_playerInZone)
            {
                float intensity = _ambientIntensity;

                // Add variation
                if (_ambientVariation > 0)
                {
                    intensity += Random.Range(-_ambientVariation, _ambientVariation) * _ambientIntensity;
                    intensity = Mathf.Clamp01(intensity);
                }

                // Sync to music beat if enabled
                if (_syncToMusic && _musicSource != null && _musicSource.isPlaying)
                {
                    // Simple beat detection using audio spectrum
                    float[] spectrum = new float[64];
                    _musicSource.GetSpectrumData(spectrum, 0, FFTWindow.Rectangular);
                    float bassEnergy = spectrum[0] + spectrum[1] + spectrum[2] + spectrum[3];

                    if (bassEnergy > 0.5f && Time.time - _lastBeatTime > 0.2f)
                    {
                        intensity *= _beatMultiplier;
                        _lastBeatTime = Time.time;
                    }
                }

                TriggerHaptic(intensity, 150);

                yield return new WaitForSeconds(_ambientInterval);
            }
        }

        private void TriggerHaptic(float intensity, int durationMs)
        {
            // Local haptic
            _hapticController?.Pulse(intensity, durationMs / 1000f);

            // Sync with partner
            if (_syncWithPartner)
            {
                var interactionManager = InteractionManager.Instance;
                if (interactionManager != null)
                {
                    // Uses the existing partner sync system
                    interactionManager.TriggerPatternOnPartner("Ambient");
                }
            }

            // Sync with companions
            if (_syncWithCompanions && _companionSession != null && _companionSession.HasActiveSession)
            {
                foreach (var companion in _companionSession.Companions)
                {
                    _ = _companionSession.SendHapticToCompanion(companion.user_id, intensity, durationMs);
                }
            }
        }

        /// <summary>
        /// Forces a haptic pulse in this zone.
        /// </summary>
        public void ForcePulse(float intensity, int durationMs)
        {
            if (_playerInZone)
            {
                TriggerHaptic(intensity, durationMs);
            }
        }

        /// <summary>
        /// Gets the zone type.
        /// </summary>
        public ZoneType Type => _zoneType;

        /// <summary>
        /// Gets the zone name.
        /// </summary>
        public string ZoneName => _zoneName;

        /// <summary>
        /// Is the player currently in this zone.
        /// </summary>
        public bool IsPlayerInZone => _playerInZone;

        private void OnDestroy()
        {
            if (_ambientCoroutine != null)
                StopCoroutine(_ambientCoroutine);
        }

#if UNITY_EDITOR
        private void OnDrawGizmos()
        {
            var collider = GetComponent<Collider>();
            if (collider == null) return;

            // Color based on zone type
            Color zoneColor = _zoneType switch
            {
                ZoneType.Intimate => new Color(1f, 0.3f, 0.5f, 0.3f),
                ZoneType.Dance => new Color(0.5f, 0.3f, 1f, 0.3f),
                ZoneType.Relaxation => new Color(0.3f, 1f, 0.5f, 0.3f),
                _ => new Color(0.5f, 0.5f, 1f, 0.3f)
            };

            Gizmos.color = zoneColor;

            if (collider is BoxCollider box)
            {
                Gizmos.matrix = transform.localToWorldMatrix;
                Gizmos.DrawCube(box.center, box.size);
                Gizmos.DrawWireCube(box.center, box.size);
            }
            else if (collider is SphereCollider sphere)
            {
                Gizmos.DrawSphere(transform.position + sphere.center, sphere.radius);
                Gizmos.DrawWireSphere(transform.position + sphere.center, sphere.radius);
            }
        }
#endif
    }

    /// <summary>
    /// Types of haptic zones.
    /// </summary>
    public enum ZoneType
    {
        Ambient,        // General ambient feedback
        Dance,          // Dance floor with music sync
        Relaxation,     // Calm, gentle feedback
        Intimate,       // Requires consent
        Booth           // Private booth area
    }
}
