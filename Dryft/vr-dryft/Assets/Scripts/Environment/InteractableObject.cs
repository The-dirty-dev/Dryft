using UnityEngine;
using UnityEngine.Events;
using Drift.Player;

namespace Drift.Environment
{
    /// <summary>
    /// Base class for interactable objects in the environment.
    ///
    /// Handles highlighting, interaction prompts, and events.
    /// </summary>
    public class InteractableObject : MonoBehaviour
    {
        [Header("Interaction Settings")]
        [SerializeField] private string _interactionPrompt = "Interact";
        [SerializeField] private float _interactionDistance = 2f;
        [SerializeField] private bool _requiresLineOfSight = true;
        [SerializeField] private bool _isEnabled = true;

        [Header("Highlight")]
        [SerializeField] private Renderer _highlightRenderer;
        [SerializeField] private Color _highlightColor = new Color(0, 1, 1, 0.5f);
        [SerializeField] private float _highlightPulseSpeed = 2f;

        [Header("Audio")]
        [SerializeField] private AudioClip _interactSound;

        [Header("Events")]
        public UnityEvent OnInteract;
        public UnityEvent OnHoverStart;
        public UnityEvent OnHoverEnd;

        // State
        public bool IsHighlighted { get; private set; }
        public bool CanInteract => _isEnabled && IsPlayerInRange();

        private MaterialPropertyBlock _propBlock;
        private Color _originalEmission;
        private bool _wasInRange;

        protected virtual void Start()
        {
            _propBlock = new MaterialPropertyBlock();

            // Store original emission
            if (_highlightRenderer != null)
            {
                _highlightRenderer.GetPropertyBlock(_propBlock);
                _originalEmission = _propBlock.GetColor("_EmissionColor");
            }
        }

        protected virtual void Update()
        {
            bool inRange = IsPlayerInRange();

            // Handle hover events
            if (inRange && !_wasInRange)
            {
                OnPlayerEnterRange();
            }
            else if (!inRange && _wasInRange)
            {
                OnPlayerExitRange();
            }

            _wasInRange = inRange;

            // Update highlight
            if (IsHighlighted)
            {
                UpdateHighlight();
            }
        }

        private bool IsPlayerInRange()
        {
            if (PlayerController.Instance == null) return false;

            Vector3 playerPos = PlayerController.Instance.transform.position;
            float distance = Vector3.Distance(transform.position, playerPos);

            if (distance > _interactionDistance) return false;

            if (_requiresLineOfSight)
            {
                // Raycast check
                Vector3 direction = (transform.position - playerPos).normalized;
                if (Physics.Raycast(playerPos, direction, out RaycastHit hit, _interactionDistance))
                {
                    if (hit.collider.gameObject != gameObject &&
                        hit.collider.transform.root != transform.root)
                    {
                        return false;
                    }
                }
            }

            return true;
        }

        private void OnPlayerEnterRange()
        {
            if (!_isEnabled) return;

            IsHighlighted = true;
            OnHoverStart?.Invoke();

            // Show interaction prompt via HUD
            UI.HUDController.Instance?.ShowInteractionPrompt(_interactionPrompt);
        }

        private void OnPlayerExitRange()
        {
            IsHighlighted = false;
            ResetHighlight();
            OnHoverEnd?.Invoke();

            UI.HUDController.Instance?.HideInteractionPrompt();
        }

        private void UpdateHighlight()
        {
            if (_highlightRenderer == null || _propBlock == null) return;

            // Pulsing highlight
            float pulse = (Mathf.Sin(Time.time * _highlightPulseSpeed) + 1f) * 0.5f;
            Color emissionColor = Color.Lerp(_originalEmission, _highlightColor, pulse);

            _propBlock.SetColor("_EmissionColor", emissionColor);
            _highlightRenderer.SetPropertyBlock(_propBlock);
        }

        private void ResetHighlight()
        {
            if (_highlightRenderer == null || _propBlock == null) return;

            _propBlock.SetColor("_EmissionColor", _originalEmission);
            _highlightRenderer.SetPropertyBlock(_propBlock);
        }

        /// <summary>
        /// Called when player interacts with this object.
        /// </summary>
        public virtual void Interact()
        {
            if (!CanInteract) return;

            // Play sound
            if (_interactSound != null)
            {
                AudioManager.Instance?.PlaySpatialSound(_interactSound, transform.position);
            }

            OnInteract?.Invoke();
            Debug.Log($"[Interactable] Interacted with: {gameObject.name}");
        }

        /// <summary>
        /// Enables or disables interaction.
        /// </summary>
        public void SetEnabled(bool enabled)
        {
            _isEnabled = enabled;
            if (!enabled && IsHighlighted)
            {
                OnPlayerExitRange();
            }
        }

        /// <summary>
        /// Gets the interaction prompt text.
        /// </summary>
        public string GetPrompt()
        {
            return _interactionPrompt;
        }

        private void OnDrawGizmosSelected()
        {
            Gizmos.color = Color.yellow;
            Gizmos.DrawWireSphere(transform.position, _interactionDistance);
        }
    }
}
