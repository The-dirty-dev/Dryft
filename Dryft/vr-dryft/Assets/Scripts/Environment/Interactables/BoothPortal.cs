using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;
using Drift.Core;
using Drift.Environment;
using Drift.Networking;
using Drift.Player;

namespace Drift.Environment.Interactables
{
    /// <summary>
    /// Portal to enter a private booth with invitation-based access.
    /// </summary>
    public class BoothPortal : InteractableObject
    {
        [Header("Portal Settings")]
        [SerializeField] private string _boothId;
        [SerializeField] private BoothStatus _status = BoothStatus.Available;
        [SerializeField] private bool _requiresInvite = true;

        [Header("Invite Defaults (optional)")]
        [SerializeField] private string _defaultInviteTargetUserId;
        [SerializeField] private string _defaultInviteTargetName = "Partner";
        [SerializeField] private int _inviteDurationSeconds = 60;

        [Header("In-World Invite Picker")]
        [SerializeField] private bool _useInvitePicker = true;
        [SerializeField] private int _invitePickerSlots = 4;
        [SerializeField] private float _inviteCandidateRadius = 12f;
        [SerializeField] private float _invitePanelAutoHideSeconds = 12f;
        [SerializeField] private Transform _invitePanelAnchor;
        [SerializeField] private GameObject _invitePanelRoot;
        [SerializeField] private TextMesh _invitePanelTitle;
        [SerializeField] private BoothInviteTargetButton[] _inviteSlotButtons;

        [Header("Visuals")]
        [SerializeField] private MeshRenderer _portalRenderer;
        [SerializeField] private ParticleSystem _portalEffect;
        [SerializeField] private Light _portalLight;
        [SerializeField] private Color _availableColor = new Color(0.5f, 0f, 1f);
        [SerializeField] private Color _invitedColor = new Color(1f, 0.5f, 0f);
        [SerializeField] private Color _occupiedColor = new Color(1f, 0f, 0f);

        [Header("Animation")]
        [SerializeField] private float _pulseSpeed = 2f;
        [SerializeField] private float _rotationSpeed = 30f;

        public string InvitedUserId { get; private set; }
        public string InviterUserId { get; private set; }
        public string InviterName { get; private set; }

        public event Action<string, string> OnInviteReceived;
        public event Action OnInviteExpired;

        private struct InviteCandidate
        {
            public string userId;
            public string displayName;
            public float distance;
        }

        private MaterialPropertyBlock _propBlock;
        private float _inviteExpireTime;
        private float _pulsePhase;
        private BoothInviteService _inviteService;
        private string _pendingInviteName;
        private float _invitePanelHideAt;
        private readonly List<InviteCandidate> _inviteCandidates = new List<InviteCandidate>();

        protected override void Start()
        {
            base.Start();

            _propBlock = new MaterialPropertyBlock();

            if (string.IsNullOrWhiteSpace(_boothId))
            {
                string stableName = gameObject.name.Replace(" ", "_").ToLowerInvariant();
                _boothId = $"booth_{stableName}";
            }

            AttachInviteService();
            EnsureInvitePickerObjects();
            SetInvitePanelVisible(false);
            UpdateVisuals();
        }

        private void OnDestroy()
        {
            DetachInviteService();
        }

        protected override void Update()
        {
            base.Update();

            if (!string.IsNullOrEmpty(InvitedUserId) && Time.time > _inviteExpireTime)
            {
                ClearInvite();
            }

            if (_invitePanelRoot != null && _invitePanelRoot.activeSelf && Time.time >= _invitePanelHideAt)
            {
                SetInvitePanelVisible(false);
            }

            UpdatePulse();

            if (_portalEffect != null)
            {
                _portalEffect.transform.Rotate(Vector3.forward, _rotationSpeed * Time.deltaTime);
            }
        }

        public override void Interact()
        {
            if (!CanInteract)
            {
                return;
            }

            string myUserId = GameManager.Instance?.UserId;
            if (string.IsNullOrEmpty(myUserId))
            {
                return;
            }

            switch (_status)
            {
                case BoothStatus.Available:
                    if (_requiresInvite)
                    {
                        OpenInviteUI();
                    }
                    else
                    {
                        EnterBooth(invitationConfirmed: false, partnerClientId: -1, partnerName: string.Empty);
                    }
                    break;

                case BoothStatus.Invited:
                    if (InvitedUserId == myUserId)
                    {
                        AcceptInvite();
                    }
                    else if (InviterUserId == myUserId)
                    {
                        UI.HUDController.Instance?.ShowMessage("Invite sent. Waiting for acceptance.");
                    }
                    else
                    {
                        UI.HUDController.Instance?.ShowMessage("This booth invite is for someone else.");
                    }
                    break;

                case BoothStatus.Occupied:
                    UI.HUDController.Instance?.ShowMessage("Booth occupied");
                    break;
            }

            base.Interact();
        }

        public bool SendInvite(string targetUserId, string targetName)
        {
            if (_status != BoothStatus.Available)
            {
                return false;
            }

            if (string.IsNullOrWhiteSpace(targetUserId))
            {
                UI.HUDController.Instance?.ShowMessage("Invite target missing");
                return false;
            }

            string localUserId = GameManager.Instance?.UserId;
            if (string.Equals(localUserId, targetUserId, StringComparison.Ordinal))
            {
                UI.HUDController.Instance?.ShowMessage("You cannot invite yourself.");
                return false;
            }

            InvitedUserId = targetUserId;
            InviterUserId = localUserId;
            InviterName = GameManager.Instance?.UserDisplayName;
            _pendingInviteName = targetName;
            _inviteExpireTime = Time.time + Mathf.Max(10, _inviteDurationSeconds);
            _status = BoothStatus.Invited;

            SetInvitePanelVisible(false);
            UpdateVisuals();
            _ = SendInviteNetwork(targetUserId, targetName);
            return true;
        }

        public void SendInviteFromPicker(string targetUserId, string targetName)
        {
            if (SendInvite(targetUserId, targetName))
            {
                UI.HUDController.Instance?.ShowMessage($"Invite sent to {targetName}");
            }
        }

        public void ReceiveInvite(string inviterId, string inviterName, int expiresInSeconds = 60)
        {
            InvitedUserId = GameManager.Instance?.UserId;
            InviterUserId = inviterId;
            InviterName = inviterName;
            _inviteExpireTime = Time.time + Mathf.Max(10, expiresInSeconds);
            _status = BoothStatus.Invited;

            SetInvitePanelVisible(false);
            UpdateVisuals();
            OnInviteReceived?.Invoke(inviterId, inviterName);
            AudioManager.Instance?.PlayNotification();
            UI.HUDController.Instance?.ShowMessage($"Invite from {inviterName}");
        }

        public void AcceptInvite()
        {
            if (_status != BoothStatus.Invited)
            {
                return;
            }

            string localUserId = GameManager.Instance?.UserId;
            _ = SendInviteResponseNetwork(accepted: true, localUserId, null);

            int partnerClientId = -1;
            string partnerName = InviterUserId == localUserId ? "Partner" : InviterName;
            EnterBooth(invitationConfirmed: true, partnerClientId, partnerName);
        }

        public void DeclineInvite()
        {
            if (_status != BoothStatus.Invited)
            {
                return;
            }

            string localUserId = GameManager.Instance?.UserId;
            _ = SendInviteResponseNetwork(accepted: false, localUserId, "declined");
            ClearInvite();
            UI.HUDController.Instance?.ShowMessage("Invite declined");
        }

        private async Task SendInviteNetwork(string targetUserId, string targetName)
        {
            if (_inviteService == null)
            {
                return;
            }

            await _inviteService.SendInvite(new BoothInviteMessage
            {
                booth_id = _boothId,
                inviter_user_id = GameManager.Instance?.UserId,
                inviter_display_name = GameManager.Instance?.UserDisplayName,
                target_user_id = targetUserId,
                target_display_name = targetName,
                sent_at_unix_ms = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                expires_in_seconds = Mathf.Max(10, _inviteDurationSeconds)
            });
        }

        private async Task SendInviteResponseNetwork(bool accepted, string localUserId, string reason)
        {
            if (_inviteService == null)
            {
                return;
            }

            await _inviteService.SendInviteResponse(new BoothInviteResponseMessage
            {
                booth_id = _boothId,
                inviter_user_id = InviterUserId,
                target_user_id = localUserId,
                accepted = accepted,
                reason = reason,
                responded_at_unix_ms = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            });
        }

        private void EnterBooth(bool invitationConfirmed, int partnerClientId, string partnerName)
        {
            if (_requiresInvite && !invitationConfirmed)
            {
                UI.HUDController.Instance?.ShowMessage("Private booths require an invite.");
                return;
            }

            _status = BoothStatus.Occupied;
            SetInvitePanelVisible(false);
            UpdateVisuals();
            _ = GameManager.Instance?.EnterPrivateBooth(_boothId, partnerClientId, partnerName);
        }

        private void ClearInvite()
        {
            InvitedUserId = null;
            InviterUserId = null;
            InviterName = null;
            _pendingInviteName = null;
            _status = BoothStatus.Available;
            UpdateVisuals();
            OnInviteExpired?.Invoke();
        }

        private void OpenInviteUI()
        {
            if (_useInvitePicker)
            {
                int candidateCount = PopulateInvitePicker();
                if (candidateCount > 0)
                {
                    SetInvitePanelVisible(true);
                    UI.HUDController.Instance?.ShowMessage("Select a nearby user to invite.");
                    return;
                }
            }

            if (!string.IsNullOrWhiteSpace(_defaultInviteTargetUserId))
            {
                if (SendInvite(_defaultInviteTargetUserId, _defaultInviteTargetName))
                {
                    UI.HUDController.Instance?.ShowMessage($"Invite sent to {_defaultInviteTargetName}");
                }
                return;
            }

            UI.HUDController.Instance?.ShowMessage("No nearby invite targets found.");
        }

        private void AttachInviteService()
        {
            _inviteService = BoothInviteService.Instance;
            if (_inviteService == null)
            {
                var go = new GameObject("BoothInviteService");
                _inviteService = go.AddComponent<BoothInviteService>();
            }

            _inviteService.OnInviteReceived += HandleNetworkInviteReceived;
            _inviteService.OnInviteResponseReceived += HandleNetworkInviteResponse;
        }

        private void DetachInviteService()
        {
            if (_inviteService == null)
            {
                return;
            }

            _inviteService.OnInviteReceived -= HandleNetworkInviteReceived;
            _inviteService.OnInviteResponseReceived -= HandleNetworkInviteResponse;
            _inviteService = null;
        }

        private void HandleNetworkInviteReceived(BoothInviteMessage message)
        {
            if (message == null)
            {
                return;
            }

            string localUserId = GameManager.Instance?.UserId;
            if (string.IsNullOrWhiteSpace(localUserId))
            {
                return;
            }

            if (!string.Equals(message.booth_id, _boothId, StringComparison.Ordinal))
            {
                return;
            }

            if (!string.Equals(message.target_user_id, localUserId, StringComparison.Ordinal))
            {
                return;
            }

            ReceiveInvite(message.inviter_user_id, message.inviter_display_name, message.expires_in_seconds);
        }

        private void HandleNetworkInviteResponse(BoothInviteResponseMessage message)
        {
            if (message == null)
            {
                return;
            }

            string localUserId = GameManager.Instance?.UserId;
            if (string.IsNullOrWhiteSpace(localUserId))
            {
                return;
            }

            if (!string.Equals(message.booth_id, _boothId, StringComparison.Ordinal))
            {
                return;
            }

            if (!string.Equals(message.inviter_user_id, localUserId, StringComparison.Ordinal))
            {
                return;
            }

            if (message.accepted)
            {
                string partnerName = !string.IsNullOrWhiteSpace(_pendingInviteName) ? _pendingInviteName : "Partner";
                EnterBooth(invitationConfirmed: true, partnerClientId: -1, partnerName);
                UI.HUDController.Instance?.ShowMessage("Invite accepted. Entering booth.");
            }
            else
            {
                ClearInvite();
                UI.HUDController.Instance?.ShowMessage("Invite declined");
            }
        }

        private void EnsureInvitePickerObjects()
        {
            if (!_useInvitePicker)
            {
                return;
            }

            int slotCount = Mathf.Clamp(_invitePickerSlots, 1, 8);

            if (_invitePanelAnchor == null)
            {
                var anchorGo = new GameObject("InvitePickerAnchor");
                _invitePanelAnchor = anchorGo.transform;
                _invitePanelAnchor.SetParent(transform, false);
                _invitePanelAnchor.localPosition = new Vector3(0f, 0.9f, 1.0f);
                _invitePanelAnchor.localRotation = Quaternion.identity;
            }

            if (_invitePanelRoot == null)
            {
                _invitePanelRoot = new GameObject("InvitePickerPanel");
                _invitePanelRoot.transform.SetParent(_invitePanelAnchor, false);
                _invitePanelRoot.transform.localPosition = Vector3.zero;
                _invitePanelRoot.transform.localRotation = Quaternion.identity;
            }

            EnsureInvitePanelVisuals();

            if (_inviteSlotButtons == null || _inviteSlotButtons.Length != slotCount)
            {
                _inviteSlotButtons = new BoothInviteTargetButton[slotCount];
            }

            for (int i = 0; i < slotCount; i++)
            {
                var button = _inviteSlotButtons[i];
                if (button == null)
                {
                    button = CreateInviteButton(i);
                    _inviteSlotButtons[i] = button;
                }
                else
                {
                    button.transform.localPosition = GetInviteButtonLocalPosition(i);
                    button.transform.localRotation = Quaternion.identity;
                    button.transform.localScale = new Vector3(0.95f, 0.18f, 0.12f);
                }
            }
        }

        private void EnsureInvitePanelVisuals()
        {
            var backplateTransform = _invitePanelRoot.transform.Find("Backplate");
            GameObject backplate;
            if (backplateTransform == null)
            {
                backplate = GameObject.CreatePrimitive(PrimitiveType.Cube);
                backplate.name = "Backplate";
                backplate.transform.SetParent(_invitePanelRoot.transform, false);
            }
            else
            {
                backplate = backplateTransform.gameObject;
            }

            backplate.transform.localPosition = new Vector3(0f, 0f, 0f);
            backplate.transform.localScale = new Vector3(1.1f, 1.0f, 0.08f);
            SetRendererColor(backplate.GetComponent<Renderer>(), new Color(0.09f, 0.08f, 0.14f, 1f));

            if (_invitePanelTitle == null)
            {
                var titleGo = new GameObject("Title");
                titleGo.transform.SetParent(_invitePanelRoot.transform, false);
                titleGo.transform.localPosition = new Vector3(0f, 0.4f, 0.08f);
                titleGo.transform.localScale = Vector3.one * 0.06f;
                _invitePanelTitle = titleGo.AddComponent<TextMesh>();
            }

            _invitePanelTitle.text = "INVITE NEARBY";
            _invitePanelTitle.alignment = TextAlignment.Center;
            _invitePanelTitle.anchor = TextAnchor.MiddleCenter;
            _invitePanelTitle.characterSize = 0.16f;
            _invitePanelTitle.fontSize = 56;
            _invitePanelTitle.color = new Color(0.92f, 0.9f, 1f);
        }

        private BoothInviteTargetButton CreateInviteButton(int index)
        {
            var buttonGo = GameObject.CreatePrimitive(PrimitiveType.Cube);
            buttonGo.name = $"InviteSlot_{index + 1:00}";
            buttonGo.transform.SetParent(_invitePanelRoot.transform, false);
            buttonGo.transform.localPosition = GetInviteButtonLocalPosition(index);
            buttonGo.transform.localRotation = Quaternion.identity;
            buttonGo.transform.localScale = new Vector3(0.95f, 0.18f, 0.12f);
            SetRendererColor(buttonGo.GetComponent<Renderer>(), new Color(0.2f, 0.14f, 0.31f, 1f));

            var textGo = new GameObject("Label");
            textGo.transform.SetParent(buttonGo.transform, false);
            textGo.transform.localPosition = new Vector3(0f, 0f, 0.58f);
            textGo.transform.localRotation = Quaternion.identity;
            textGo.transform.localScale = Vector3.one * 0.07f;

            var label = textGo.AddComponent<TextMesh>();
            label.text = "Open Slot";
            label.alignment = TextAlignment.Center;
            label.anchor = TextAnchor.MiddleCenter;
            label.characterSize = 0.15f;
            label.fontSize = 48;
            label.color = new Color(0.95f, 0.9f, 1f);

            var slotButton = buttonGo.GetComponent<BoothInviteTargetButton>();
            if (slotButton == null)
            {
                slotButton = buttonGo.AddComponent<BoothInviteTargetButton>();
            }

            slotButton.ClearCandidate(this, "Open Slot", true);
            return slotButton;
        }

        private Vector3 GetInviteButtonLocalPosition(int index)
        {
            return new Vector3(0f, 0.16f - (index * 0.23f), 0.08f);
        }

        private static void SetRendererColor(Renderer renderer, Color color)
        {
            if (renderer == null)
            {
                return;
            }

            var material = renderer.material;
            if (material == null)
            {
                return;
            }

            if (material.HasProperty("_BaseColor"))
            {
                material.SetColor("_BaseColor", color);
            }
            if (material.HasProperty("_Color"))
            {
                material.SetColor("_Color", color);
            }
        }

        private int PopulateInvitePicker()
        {
            EnsureInvitePickerObjects();
            _inviteCandidates.Clear();

            string localUserId = GameManager.Instance?.UserId;
            if (string.IsNullOrWhiteSpace(localUserId) || _inviteSlotButtons == null || _inviteSlotButtons.Length == 0)
            {
                return 0;
            }

            Vector3 referencePosition = PlayerController.Instance != null
                ? PlayerController.Instance.transform.position
                : transform.position;

            var seenUserIds = new HashSet<string>(StringComparer.Ordinal);
            var players = UnityEngine.Object.FindObjectsByType<PlayerSync>(FindObjectsSortMode.None);
            foreach (var player in players)
            {
                if (player == null || player.IsLocalPlayer)
                {
                    continue;
                }

                string userId = player.GetUserId();
                if (string.IsNullOrWhiteSpace(userId) || string.Equals(userId, localUserId, StringComparison.Ordinal))
                {
                    continue;
                }

                if (!seenUserIds.Add(userId))
                {
                    continue;
                }

                float distance = Vector3.Distance(referencePosition, player.transform.position);
                if (distance > _inviteCandidateRadius)
                {
                    continue;
                }

                _inviteCandidates.Add(new InviteCandidate
                {
                    userId = userId,
                    displayName = player.GetDisplayName(),
                    distance = distance
                });
            }

            _inviteCandidates.Sort((a, b) => a.distance.CompareTo(b.distance));

            int assigned = Mathf.Min(_inviteCandidates.Count, _inviteSlotButtons.Length);
            for (int i = 0; i < _inviteSlotButtons.Length; i++)
            {
                var slot = _inviteSlotButtons[i];
                if (slot == null)
                {
                    continue;
                }

                if (i < assigned)
                {
                    var candidate = _inviteCandidates[i];
                    string safeName = string.IsNullOrWhiteSpace(candidate.displayName) ? "Guest" : candidate.displayName;
                    string label = $"{safeName} ({Mathf.RoundToInt(candidate.distance)}m)";
                    slot.ConfigureCandidate(this, candidate.userId, safeName, label);
                }
                else
                {
                    slot.ClearCandidate(this, "Open Slot", true);
                }
            }

            if (_invitePanelTitle != null)
            {
                _invitePanelTitle.text = assigned > 0 ? "INVITE NEARBY" : "NO USERS NEARBY";
            }

            return assigned;
        }

        private void SetInvitePanelVisible(bool visible)
        {
            if (_invitePanelRoot != null)
            {
                _invitePanelRoot.SetActive(visible);
            }

            _invitePanelHideAt = visible
                ? Time.time + Mathf.Max(4f, _invitePanelAutoHideSeconds)
                : 0f;
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

        public void OnBoothVacated()
        {
            _status = BoothStatus.Available;
            InvitedUserId = null;
            InviterUserId = null;
            InviterName = null;
            _pendingInviteName = null;
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
