using UnityEngine;
using Drift.Player;
using Drift.Haptics;

namespace Drift.Interaction
{
    /// <summary>
    /// Attach to VR hand anchors to enable collision-based haptic detection.
    /// Creates a trigger collider on the hand that interacts with HapticInteractable objects.
    /// </summary>
    public class HandHapticTrigger : MonoBehaviour
    {
        [Header("Settings")]
        [SerializeField] private OVRInput.Controller _controller = OVRInput.Controller.LTouch;
        [SerializeField] private float _colliderRadius = 0.05f;
        [SerializeField] private Vector3 _colliderOffset = Vector3.zero;

        [Header("Haptic Feedback")]
        [SerializeField] private bool _vibrateOnTouch = true;
        [SerializeField] private float _touchVibrationIntensity = 0.3f;
        [SerializeField] private float _touchVibrationDuration = 0.1f;

        private SphereCollider _collider;
        private Rigidbody _rigidbody;
        private HapticController _hapticController;

        private void Awake()
        {
            // Auto-detect controller from name
            if (name.ToLower().Contains("left"))
                _controller = OVRInput.Controller.LTouch;
            else if (name.ToLower().Contains("right"))
                _controller = OVRInput.Controller.RTouch;

            SetupCollider();

            // Set appropriate tag
            gameObject.tag = _controller == OVRInput.Controller.LTouch ? "LeftHand" : "RightHand";
            gameObject.layer = LayerMask.NameToLayer("Hands");
        }

        private void Start()
        {
            _hapticController = HapticController.Instance;
        }

        private void SetupCollider()
        {
            // Add sphere collider for hand
            _collider = gameObject.GetComponent<SphereCollider>();
            if (_collider == null)
            {
                _collider = gameObject.AddComponent<SphereCollider>();
            }
            _collider.isTrigger = true;
            _collider.radius = _colliderRadius;
            _collider.center = _colliderOffset;

            // Add kinematic rigidbody for trigger detection
            _rigidbody = gameObject.GetComponent<Rigidbody>();
            if (_rigidbody == null)
            {
                _rigidbody = gameObject.AddComponent<Rigidbody>();
            }
            _rigidbody.isKinematic = true;
            _rigidbody.useGravity = false;
        }

        private void OnTriggerEnter(Collider other)
        {
            // Provide haptic feedback when touching anything
            if (_vibrateOnTouch && _hapticController != null)
            {
                // Use OVR haptic for controller vibration
                OVRInput.SetControllerVibration(
                    _touchVibrationIntensity,
                    _touchVibrationIntensity,
                    _controller
                );

                // Schedule stop
                Invoke(nameof(StopControllerVibration), _touchVibrationDuration);
            }
        }

        private void StopControllerVibration()
        {
            OVRInput.SetControllerVibration(0, 0, _controller);
        }

        /// <summary>
        /// Gets which controller this hand represents.
        /// </summary>
        public OVRInput.Controller Controller => _controller;

        /// <summary>
        /// Sets the collider radius for touch detection.
        /// </summary>
        public void SetColliderRadius(float radius)
        {
            _colliderRadius = radius;
            if (_collider != null)
                _collider.radius = radius;
        }

        private void OnDestroy()
        {
            CancelInvoke();
            StopControllerVibration();
        }

#if UNITY_EDITOR
        private void OnDrawGizmosSelected()
        {
            Gizmos.color = Color.cyan;
            Gizmos.DrawWireSphere(transform.position + transform.TransformDirection(_colliderOffset), _colliderRadius);
        }
#endif
    }
}
