using UnityEngine;
using Drift.Core;

namespace Drift.Environment.Interactables
{
    /// <summary>
    /// Portal to enter a private booth with a matched partner.
    /// </summary>
    public class BoothPortal : InteractableObject
    {
        [Header("Portal Settings")]
        [SerializeField] private string _boothId;
        [SerializeField] private BoothStatus _status = BoothStatus.Available;
        [SerializeField] private bool _requiresInvite = true;

        [Header("Visuals")]
        [SerializeField] private MeshRenderer _portalRenderer;
        [SerializeField] private ParticleSystem _portalEffect;
        [SerializeField] private Light _portalLight;
        [SerializeField] private Color _availableColor = new Color(0.5f, 0, 1f);
        [SerializeField] private Color _invitedColor = new Color(1f, 0.5f, 0f);
        [SerializeField] private Color _occupiedColor = new Color(1f, 0, 0);

        [Header("Animation")]
        [SerializeField] private float _pulseSpeed = 2f;
        [SerializeField] private float _rotationSpeed = 30f;

        // Invite state
        public string InvitedUserId { get; private set; }
        public string InviterUserId { get; private set; }
        public string InviterName { get; private set; }

        // Events
        public event System.Action<string, string> OnInviteReceived; // (inviterId, inviterName)
        public event System.Action OnInviteExpired;

        private MaterialPropertyBlock _propBlock;
        private float _inviteExpireTime;
        private float _pulsePhase;

        protected override void Start()
        {
            base.Start();

            _propBlock = new MaterialPropertyBlock();

            // Generate booth ID if not set
            if (string.IsNullOrEmpty(_boothId))
            {
                _boothId = $"booth_{System.Guid.NewGuid().ToString().Substring(0, 8)}";
            }

            UpdateVisuals();
        }

        protected override void Update()
        {
            base.Update();

            // Check invite expiration
            if (!string.IsNullOrEmpty(InvitedUserId) && Time.time > _inviteExpireTime)
            {
                ClearInvite();
            }

            // Update visuals
            UpdatePulse();

            // Rotate portal effect
            if (_portalEffect != null)
            {
                _portalEffect.transform.Rotate(Vector3.forward, _rotationSpeed * Time.deltaTime);
            }
        }

        public override void Interact()
        {
            if (!CanInteract) return;

            string myUserId = GameManager.Instance?.UserId;
            if (string.IsNullOrEmpty(myUserId)) return;

            switch (_status)
            {
                case BoothStatus.Available:
                    if (_requiresInvite)
                    {
                        // Would open invite UI
                        Debug.Log("[BoothPortal] Need to invite someone first");
                        OpenInviteUI();
                    }
                    else
                    {
                        EnterBooth();
                    }
                    break;

                case BoothStatus.Invited:
                    // Check if we're the invited user
                    if (InvitedUserId == myUserId)
                    {
                        AcceptInvite();
                    }
                    else if (InviterUserId == myUserId)
                    {
                        // Inviter entering to wait
                        EnterBooth();
                    }
                    break;

                case BoothStatus.Occupied:
                    Debug.Log("[BoothPortal] Booth is occupied");
                    break;
            }

            base.Interact();
        }

        /// <summary>
        /// Sends an invite to a specific user.
        /// </summary>
        public void SendInvite(string targetUserId, string targetName)
        {
            if (_status != BoothStatus.Available) return;

            InvitedUserId = targetUserId;
            InviterUserId = GameManager.Instance?.UserId;
            InviterName = GameManager.Instance?.UserDisplayName;
            _inviteExpireTime = Time.time + 60f; // 60 second expiry
            _status = BoothStatus.Invited;

            UpdateVisuals();

            // Would send network invite here
            Debug.Log($"[BoothPortal] Sent invite to {targetName}");
        }

        /// <summary>
        /// Called when this portal receives an invite for the local user.
        /// </summary>
        public void ReceiveInvite(string inviterId, string inviterName)
        {
            InvitedUserId = GameManager.Instance?.UserId;
            InviterUserId = inviterId;
            InviterName = inviterName;
            _inviteExpireTime = Time.time + 60f;
            _status = BoothStatus.Invited;

            UpdateVisuals();
            OnInviteReceived?.Invoke(inviterId, inviterName);

            // Show notification
            AudioManager.Instance?.PlayNotification();
            Debug.Log($"[BoothPortal] Received invite from {inviterName}");
        }

        /// <summary>
        /// Accepts the current invite and enters the booth.
        /// </summary>
        public void AcceptInvite()
        {
            if (_status != BoothStatus.Invited) return;

            _status = BoothStatus.Occupied;
            UpdateVisuals();

            // Get partner info
            int partnerClientId = 0; // Would come from network
            string partnerName = InviterUserId == GameManager.Instance?.UserId ? "Partner" : InviterName;

            // Enter booth
            _ = GameManager.Instance?.EnterPrivateBooth(_boothId, partnerClientId, partnerName);

            Debug.Log($"[BoothPortal] Accepted invite, entering booth: {_boothId}");
        }

        /// <summary>
        /// Declines the current invite.
        /// </summary>
        public void DeclineInvite()
        {
            if (_status != BoothStatus.Invited) return;

            ClearInvite();

            // Would send decline over network
            Debug.Log("[BoothPortal] Declined invite");
        }

        private void EnterBooth()
        {
            _status = BoothStatus.Occupied;
            UpdateVisuals();

            // Enter solo (waiting for partner)
            _ = GameManager.Instance?.EnterPrivateBooth(_boothId, -1, "");

            Debug.Log($"[BoothPortal] Entered booth: {_boothId}");
        }

        private void ClearInvite()
        {
            InvitedUserId = null;
            InviterUserId = null;
            InviterName = null;
            _status = BoothStatus.Available;
            UpdateVisuals();
            OnInviteExpired?.Invoke();
        }

        private void OpenInviteUI()
        {
            // Would open a UI to select a user to invite
            UI.HUDController.Instance?.ShowMessage("Select a user to invite");
        }

        private void UpdateVisuals()
        {
            Color targetColor = _status switch
            {
                BoothStatus.Available => _availableColor,
                BoothStatus.Invited => _invitedColor,
                BoothStatus.Occupied => _occupiedColor,
                _ => _availableColor
            };

            if (_portalLight != null)
            {
                _portalLight.color = targetColor;
            }

            if (_portalRenderer != null && _propBlock != null)
            {
                _portalRenderer.GetPropertyBlock(_propBlock);
                _propBlock.SetColor("_EmissionColor", targetColor);
                _portalRenderer.SetPropertyBlock(_propBlock);
            }

            // Update particle color
            if (_portalEffect != null)
            {
                var main = _portalEffect.main;
                main.startColor = targetColor;
            }
        }

        private void UpdatePulse()
        {
            _pulsePhase += Time.deltaTime * _pulseSpeed;

            float pulse = (Mathf.Sin(_pulsePhase) + 1f) * 0.5f;
            float intensity = Mathf.Lerp(0.5f, 1.5f, pulse);

            if (_portalLight != null)
            {
                _portalLight.intensity = intensity;
            }
        }

        /// <summary>
        /// Called when booth is vacated (both users left).
        /// </summary>
        public void OnBoothVacated()
        {
            _status = BoothStatus.Available;
            InvitedUserId = null;
            InviterUserId = null;
            InviterName = null;
            UpdateVisuals();
        }
    }

    public enum BoothStatus
    {
        Available,
        Invited,
        Occupied
    }
}
