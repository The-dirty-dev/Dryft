using UnityEngine;
using Drift.Player;
using Drift.Haptics;
using Drift.Core;

namespace Drift.Interaction
{
    /// <summary>
    /// Makes an object trigger haptic feedback when touched by a VR hand.
    /// Attach to any object you want to be interactable.
    ///
    /// Supports:
    /// - Touch enter/stay/exit haptics
    /// - Custom patterns per interaction type
    /// - Intensity based on contact pressure
    /// - Optional interaction with partner's device
    /// </summary>
    [RequireComponent(typeof(Collider))]
    public class HapticInteractable : MonoBehaviour
    {
        [Header("Haptic Settings")]
        [SerializeField] private float _touchIntensity = 0.3f;
        [SerializeField] private float _holdIntensity = 0.5f;
        [SerializeField] private int _touchDurationMs = 200;
        [SerializeField] private string _touchPattern = "Touch";
        [SerializeField] private string _holdPattern = "";

        [Header("Interaction Type")]
        [SerializeField] private InteractableType _type = InteractableType.Generic;
        [SerializeField] private bool _sendToPartner = false;
        [SerializeField] private bool _sendToCompanions = true;

        [Header("Optional")]
        [SerializeField] private AudioSource _touchSound;
        [SerializeField] private ParticleSystem _touchEffect;

        // State
        private bool _isTouching;
        private float _touchStartTime;
        private OVRInput.Controller _touchingController;
        private HapticController _hapticController;
        private CompanionSessionManager _companionSession;

        private void Start()
        {
            _hapticController = HapticController.Instance;
            _companionSession = CompanionSessionManager.Instance;

            // Ensure collider is trigger
            var collider = GetComponent<Collider>();
            if (collider != null && !collider.isTrigger)
            {
                Debug.LogWarning($"[HapticInteractable] {name}: Collider should be a trigger for haptic detection");
            }
        }

        private void OnTriggerEnter(Collider other)
        {
            if (!IsHand(other, out var controller)) return;

            _isTouching = true;
            _touchStartTime = Time.time;
            _touchingController = controller;

            // Trigger enter haptic
            TriggerHaptic(_touchIntensity, _touchDurationMs);

            // Play pattern if set
            if (!string.IsNullOrEmpty(_touchPattern))
            {
                _ = _hapticController?.PlayPattern(_touchPattern);
            }

            // Play sound/effect
            _touchSound?.Play();
            _touchEffect?.Play();

            // Notify systems
            OnTouchEnter(controller);

            Debug.Log($"[HapticInteractable] Touch enter: {name} ({_type})");
        }

        private void OnTriggerStay(Collider other)
        {
            if (!_isTouching) return;
            if (!IsHand(other, out var controller)) return;
            if (controller != _touchingController) return;

            // Check for hold pattern
            float holdTime = Time.time - _touchStartTime;
            if (holdTime > 0.5f && !string.IsNullOrEmpty(_holdPattern))
            {
                // Switch to hold pattern (only once)
                if (holdTime < 0.6f)
                {
                    _ = _hapticController?.PlayPattern(_holdPattern);
                    TriggerHaptic(_holdIntensity, 500);
                    OnHoldStart(controller);
                }
            }
        }

        private void OnTriggerExit(Collider other)
        {
            if (!_isTouching) return;
            if (!IsHand(other, out var controller)) return;
            if (controller != _touchingController) return;

            _isTouching = false;
            _touchingController = OVRInput.Controller.None;

            // Small exit pulse
            TriggerHaptic(_touchIntensity * 0.5f, 100);

            // Stop effect
            _touchEffect?.Stop();

            // Notify systems
            OnTouchExit(controller);

            Debug.Log($"[HapticInteractable] Touch exit: {name}");
        }

        private bool IsHand(Collider other, out OVRInput.Controller controller)
        {
            controller = OVRInput.Controller.None;

            // Check if it's tagged as a hand
            if (other.CompareTag("LeftHand"))
            {
                controller = OVRInput.Controller.LTouch;
                return true;
            }
            if (other.CompareTag("RightHand"))
            {
                controller = OVRInput.Controller.RTouch;
                return true;
            }

            // Check by layer
            if (other.gameObject.layer == LayerMask.NameToLayer("Hands"))
            {
                // Determine left/right by position relative to head
                var player = PlayerController.Instance;
                if (player != null)
                {
                    float distToLeft = Vector3.Distance(other.transform.position, player.LeftHandPosition);
                    float distToRight = Vector3.Distance(other.transform.position, player.RightHandPosition);
                    controller = distToLeft < distToRight
                        ? OVRInput.Controller.LTouch
                        : OVRInput.Controller.RTouch;
                    return true;
                }
            }

            return false;
        }

        private void TriggerHaptic(float intensity, int durationMs)
        {
            // Local haptic
            _hapticController?.Pulse(intensity, durationMs / 1000f);

            // Send to partner if enabled
            if (_sendToPartner)
            {
                var interactionManager = InteractionManager.Instance;
                if (interactionManager != null)
                {
                    interactionManager.TriggerPatternOnPartner(_touchPattern);
                }
            }

            // Send to companions if enabled
            if (_sendToCompanions && _companionSession != null && _companionSession.HasActiveSession)
            {
                foreach (var companion in _companionSession.Companions)
                {
                    _ = _companionSession.SendHapticToCompanion(companion.user_id, intensity, durationMs);
                }
            }
        }

        protected virtual void OnTouchEnter(OVRInput.Controller controller)
        {
            // Override in subclasses for custom behavior
        }

        protected virtual void OnHoldStart(OVRInput.Controller controller)
        {
            // Override in subclasses for custom behavior
        }

        protected virtual void OnTouchExit(OVRInput.Controller controller)
        {
            // Override in subclasses for custom behavior
        }

        /// <summary>
        /// Gets the interactable type.
        /// </summary>
        public InteractableType Type => _type;

        /// <summary>
        /// Is currently being touched.
        /// </summary>
        public bool IsTouching => _isTouching;
    }

    /// <summary>
    /// Types of haptic interactables.
    /// </summary>
    public enum InteractableType
    {
        Generic,
        Furniture,      // Beds, couches, etc
        Toy,            // Interactive toys
        Consumable,     // Drinks, food
        UI,             // Buttons, controls
        Intimate        // Adult content (requires consent)
    }
}
