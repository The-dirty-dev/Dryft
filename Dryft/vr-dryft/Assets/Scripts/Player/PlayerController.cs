using UnityEngine;
using System;

namespace Drift.Player
{
    /// <summary>
    /// VR Player Controller for Meta Quest.
    /// Handles locomotion, input, and player state.
    ///
    /// Supports:
    /// - Smooth locomotion (thumbstick)
    /// - Snap turn
    /// - Teleport (optional)
    /// - Hand tracking or controllers
    /// </summary>
    public class PlayerController : MonoBehaviour
    {
        public static PlayerController Instance { get; private set; }

        [Header("Movement Settings")]
        [SerializeField] private float _moveSpeed = 2.0f;
        [SerializeField] private float _sprintMultiplier = 1.5f;
        [SerializeField] private float _snapTurnAngle = 45f;
        [SerializeField] private float _smoothTurnSpeed = 90f;
        [SerializeField] private bool _useSnapTurn = true;

        [Header("References")]
        [SerializeField] private Transform _cameraRig;
        [SerializeField] private Transform _centerEyeAnchor;
        [SerializeField] private Transform _leftHandAnchor;
        [SerializeField] private Transform _rightHandAnchor;
        [SerializeField] private CharacterController _characterController;

        [Header("Interaction")]
        [SerializeField] private LayerMask _interactionLayer;
        [SerializeField] private float _interactionRange = 2f;

        // State
        public bool IsMovementEnabled { get; set; } = true;
        public bool IsTurningEnabled { get; set; } = true;
        public bool IsInteractionEnabled { get; set; } = true;

        // Hand positions (world space)
        public Vector3 LeftHandPosition => _leftHandAnchor?.position ?? Vector3.zero;
        public Vector3 RightHandPosition => _rightHandAnchor?.position ?? Vector3.zero;
        public Quaternion LeftHandRotation => _leftHandAnchor?.rotation ?? Quaternion.identity;
        public Quaternion RightHandRotation => _rightHandAnchor?.rotation ?? Quaternion.identity;

        // Head position
        public Vector3 HeadPosition => _centerEyeAnchor?.position ?? transform.position;
        public Quaternion HeadRotation => _centerEyeAnchor?.rotation ?? transform.rotation;
        public Vector3 HeadForward => _centerEyeAnchor?.forward ?? transform.forward;

        // Events
        public event Action<OVRInput.Controller> OnGripPressed;
        public event Action<OVRInput.Controller> OnGripReleased;
        public event Action<OVRInput.Controller> OnTriggerPressed;
        public event Action<OVRInput.Controller> OnTriggerReleased;
        public event Action OnMenuPressed;

        private bool _leftGripHeld;
        private bool _rightGripHeld;
        private bool _leftTriggerHeld;
        private bool _rightTriggerHeld;
        private float _snapTurnCooldown;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            // Auto-find references if not set
            if (_cameraRig == null) _cameraRig = transform;
            if (_characterController == null) _characterController = GetComponent<CharacterController>();

            // Find OVR anchors
            if (_centerEyeAnchor == null)
                _centerEyeAnchor = transform.Find("TrackingSpace/CenterEyeAnchor");
            if (_leftHandAnchor == null)
                _leftHandAnchor = transform.Find("TrackingSpace/LeftHandAnchor");
            if (_rightHandAnchor == null)
                _rightHandAnchor = transform.Find("TrackingSpace/RightHandAnchor");
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        private void Update()
        {
            HandleMovement();
            HandleTurning();
            HandleInput();

            // Cooldown for snap turn
            if (_snapTurnCooldown > 0)
                _snapTurnCooldown -= Time.deltaTime;
        }

        private void HandleMovement()
        {
            if (!IsMovementEnabled || _characterController == null) return;

            // Get left thumbstick input for movement
            Vector2 input = OVRInput.Get(OVRInput.Axis2D.PrimaryThumbstick);

            if (input.sqrMagnitude > 0.01f)
            {
                // Get forward direction based on head orientation (projected on XZ plane)
                Vector3 forward = _centerEyeAnchor != null
                    ? Vector3.ProjectOnPlane(_centerEyeAnchor.forward, Vector3.up).normalized
                    : transform.forward;
                Vector3 right = Vector3.Cross(Vector3.up, forward);

                // Calculate movement direction
                Vector3 moveDir = (forward * input.y + right * input.x).normalized;

                // Check for sprint (thumbstick click)
                float speed = _moveSpeed;
                if (OVRInput.Get(OVRInput.Button.PrimaryThumbstick))
                {
                    speed *= _sprintMultiplier;
                }

                // Apply movement
                _characterController.SimpleMove(moveDir * speed);
            }

            // Apply gravity
            if (!_characterController.isGrounded)
            {
                _characterController.SimpleMove(Physics.gravity);
            }
        }

        private void HandleTurning()
        {
            if (!IsTurningEnabled) return;

            // Get right thumbstick for turning
            Vector2 input = OVRInput.Get(OVRInput.Axis2D.SecondaryThumbstick);

            if (Mathf.Abs(input.x) > 0.5f)
            {
                if (_useSnapTurn)
                {
                    // Snap turn
                    if (_snapTurnCooldown <= 0)
                    {
                        float turnDir = Mathf.Sign(input.x);
                        transform.Rotate(0, _snapTurnAngle * turnDir, 0);
                        _snapTurnCooldown = 0.3f; // Prevent rapid snap turns
                    }
                }
                else
                {
                    // Smooth turn
                    transform.Rotate(0, input.x * _smoothTurnSpeed * Time.deltaTime, 0);
                }
            }
        }

        private void HandleInput()
        {
            // Grip buttons
            bool leftGrip = OVRInput.Get(OVRInput.Button.PrimaryHandTrigger);
            bool rightGrip = OVRInput.Get(OVRInput.Button.SecondaryHandTrigger);

            if (leftGrip && !_leftGripHeld)
            {
                _leftGripHeld = true;
                OnGripPressed?.Invoke(OVRInput.Controller.LTouch);
            }
            else if (!leftGrip && _leftGripHeld)
            {
                _leftGripHeld = false;
                OnGripReleased?.Invoke(OVRInput.Controller.LTouch);
            }

            if (rightGrip && !_rightGripHeld)
            {
                _rightGripHeld = true;
                OnGripPressed?.Invoke(OVRInput.Controller.RTouch);
            }
            else if (!rightGrip && _rightGripHeld)
            {
                _rightGripHeld = false;
                OnGripReleased?.Invoke(OVRInput.Controller.RTouch);
            }

            // Trigger buttons
            bool leftTrigger = OVRInput.Get(OVRInput.Button.PrimaryIndexTrigger);
            bool rightTrigger = OVRInput.Get(OVRInput.Button.SecondaryIndexTrigger);

            if (leftTrigger && !_leftTriggerHeld)
            {
                _leftTriggerHeld = true;
                OnTriggerPressed?.Invoke(OVRInput.Controller.LTouch);
            }
            else if (!leftTrigger && _leftTriggerHeld)
            {
                _leftTriggerHeld = false;
                OnTriggerReleased?.Invoke(OVRInput.Controller.LTouch);
            }

            if (rightTrigger && !_rightTriggerHeld)
            {
                _rightTriggerHeld = true;
                OnTriggerPressed?.Invoke(OVRInput.Controller.RTouch);
            }
            else if (!rightTrigger && _rightTriggerHeld)
            {
                _rightTriggerHeld = false;
                OnTriggerReleased?.Invoke(OVRInput.Controller.RTouch);
            }

            // Menu button
            if (OVRInput.GetDown(OVRInput.Button.Start))
            {
                OnMenuPressed?.Invoke();
            }
        }

        /// <summary>
        /// Teleports the player to a position.
        /// </summary>
        public void TeleportTo(Vector3 position)
        {
            if (_characterController != null)
            {
                _characterController.enabled = false;
                transform.position = position;
                _characterController.enabled = true;
            }
            else
            {
                transform.position = position;
            }
        }

        /// <summary>
        /// Teleports the player to a position and rotation.
        /// </summary>
        public void TeleportTo(Vector3 position, Quaternion rotation)
        {
            TeleportTo(position);
            transform.rotation = rotation;
        }

        /// <summary>
        /// Gets the trigger value (0-1) for a controller.
        /// </summary>
        public float GetTriggerValue(OVRInput.Controller controller)
        {
            return controller == OVRInput.Controller.LTouch
                ? OVRInput.Get(OVRInput.Axis1D.PrimaryIndexTrigger)
                : OVRInput.Get(OVRInput.Axis1D.SecondaryIndexTrigger);
        }

        /// <summary>
        /// Gets the grip value (0-1) for a controller.
        /// </summary>
        public float GetGripValue(OVRInput.Controller controller)
        {
            return controller == OVRInput.Controller.LTouch
                ? OVRInput.Get(OVRInput.Axis1D.PrimaryHandTrigger)
                : OVRInput.Get(OVRInput.Axis1D.SecondaryHandTrigger);
        }

        /// <summary>
        /// Checks if hand tracking is active (vs controllers).
        /// </summary>
        public bool IsHandTrackingActive()
        {
            return OVRInput.GetActiveController() == OVRInput.Controller.Hands;
        }

        /// <summary>
        /// Disables all player input (for cutscenes, menus, etc.).
        /// </summary>
        public void DisableAllInput()
        {
            IsMovementEnabled = false;
            IsTurningEnabled = false;
            IsInteractionEnabled = false;
        }

        /// <summary>
        /// Enables all player input.
        /// </summary>
        public void EnableAllInput()
        {
            IsMovementEnabled = true;
            IsTurningEnabled = true;
            IsInteractionEnabled = true;
        }

        /// <summary>
        /// Sets movement speed (useful for different contexts).
        /// </summary>
        public void SetMoveSpeed(float speed)
        {
            _moveSpeed = Mathf.Max(0, speed);
        }

        /// <summary>
        /// Switches between snap and smooth turning.
        /// </summary>
        public void SetSnapTurn(bool useSnap)
        {
            _useSnapTurn = useSnap;
        }
    }
}
