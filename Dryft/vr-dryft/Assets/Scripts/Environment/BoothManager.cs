using UnityEngine;
using System;
using System.Collections;
using System.Threading.Tasks;
using Drift.Core;
using Drift.Player;
using Normal.Realtime;

namespace Drift.Environment
{
    /// <summary>
    /// Manages private booth instances.
    ///
    /// Private booths are intimate 2-person spaces where matched users
    /// can interact privately. Features include:
    /// - Soundproofing (no audio leak to/from public space)
    /// - Custom ambiance settings
    /// - Consent management UI
    /// - Quick exit option
    ///
    /// LEGAL NOTE: Users can leave at any time. Emergency exit
    /// button is always visible and accessible.
    /// </summary>
    public class BoothManager : MonoBehaviour
    {
        public static BoothManager Instance { get; private set; }

        [Header("Booth Setup")]
        [SerializeField] private Transform _userASpawnPoint;
        [SerializeField] private Transform _userBSpawnPoint;
        [SerializeField] private float _boothRadius = 3f;
        [SerializeField] private bool _inviteOnly = true;
        [SerializeField] private bool _roomLocked = false;
        [SerializeField] private bool _companionVoiceAllowed = true;
        [SerializeField] private int _maxGuestCount = 2;

        [Header("Partner Detection")]
        [SerializeField] private float _partnerSearchInterval = 1f;
        [SerializeField] private string _partnerAvatarTag = "PlayerAvatar";
        [SerializeField] private LayerMask _avatarLayer;

        [Header("Ambiance")]
        [SerializeField] private Light[] _boothLights;
        [SerializeField] private AudioSource _ambienceSource;
        [SerializeField] private AudioClip[] _ambienceClips;
        [SerializeField] private Color _defaultLightColor = new Color(1f, 0.4f, 0.8f); // Pink

        [Header("UI")]
        [SerializeField] private GameObject _consentUI;
        [SerializeField] private GameObject _exitButton;
        [SerializeField] private GameObject _settingsPanel;

        [Header("Effects")]
        [SerializeField] private ParticleSystem _atmosphereEffect;
        [SerializeField] private float _lightDimSpeed = 2f;

        // State
        public bool IsOccupied { get; private set; }
        public string BoothId { get; private set; }
        public bool ConsentGranted { get; private set; }
        public Transform PartnerAvatar { get; private set; }
        public int PartnerClientId { get; private set; } = -1;
        public bool IsHost => _isHost;
        public bool IsInviteOnly => _inviteOnly;
        public bool IsRoomLocked => _roomLocked;
        public bool IsCompanionVoiceAllowed => _companionVoiceAllowed;
        public int MaxGuestCount => _maxGuestCount;

        // Events
        public event Action OnPartnerJoined;
        public event Action OnPartnerLeft;
        public event Action OnConsentChanged;
        public event Action OnExitRequested;
        public event Action<Transform> OnPartnerAvatarFound;
        public event Action OnPrivacyStateChanged;

        private float _targetLightIntensity = 1f;
        private bool _isHost;
        private Coroutine _partnerSearchCoroutine;
        private bool _partnerFound;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        private void Start()
        {
            // Ensure exit button is always visible
            if (_exitButton != null)
            {
                _exitButton.SetActive(true);
            }

            // Hide consent UI initially
            if (_consentUI != null)
            {
                _consentUI.SetActive(false);
            }

            InitializeAmbiance();
            SubscribeInviteService();
        }

        private void Update()
        {
            UpdateLighting();
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;

            if (_partnerSearchCoroutine != null)
            {
                StopCoroutine(_partnerSearchCoroutine);
            }

            UnsubscribeInviteService();
        }

        private void LateUpdate()
        {
            // Monitor partner avatar - detect if they've left
            if (_partnerFound && IsOccupied)
            {
                // Check if partner avatar still exists and is valid
                if (PartnerAvatar == null)
                {
                    OnPartnerExited();
                }
                else
                {
                    // Check if partner is still in room via RealtimeAvatarManager
                    var avatarManager = FindObjectOfType<RealtimeAvatarManager>();
                    if (avatarManager != null && !avatarManager.avatars.ContainsKey(PartnerClientId))
                    {
                        OnPartnerExited();
                    }
                }
            }
        }

        /// <summary>
        /// Initializes the booth for a session.
        /// </summary>
        public void InitializeBooth(string boothId, bool isHost)
        {
            BoothId = boothId;
            _isHost = isHost;
            IsOccupied = true;
            ConsentGranted = false;
            _partnerFound = false;
            PartnerAvatar = null;
            PartnerClientId = -1;

            // Position local player
            var spawnPoint = isHost ? _userASpawnPoint : _userBSpawnPoint;
            if (spawnPoint != null && PlayerController.Instance != null)
            {
                PlayerController.Instance.TeleportTo(spawnPoint.position, spawnPoint.rotation);
            }

            // Show consent UI
            if (_consentUI != null)
            {
                _consentUI.SetActive(true);
            }

            // Start searching for partner avatar
            if (_partnerSearchCoroutine != null)
            {
                StopCoroutine(_partnerSearchCoroutine);
            }
            _partnerSearchCoroutine = StartCoroutine(SearchForPartnerAvatar());

            Debug.Log($"[BoothManager] Initialized booth: {boothId} (isHost: {isHost})");

            if (_isHost)
            {
                BroadcastPrivacyState();
            }
        }

        /// <summary>
        /// Coroutine to search for partner's avatar in the scene.
        /// </summary>
        private IEnumerator SearchForPartnerAvatar()
        {
            // Wait a moment for avatars to spawn
            yield return new WaitForSeconds(1f);

            while (IsOccupied && !_partnerFound)
            {
                // Try to find partner avatar via RealtimeAvatarManager
                var avatarManager = FindObjectOfType<RealtimeAvatarManager>();
                if (avatarManager != null)
                {
                    foreach (var kvp in avatarManager.avatars)
                    {
                        var avatar = kvp.Value;
                        int clientId = kvp.Key;

                        // Skip our own avatar
                        if (clientId == DriftRealtime.Instance?.LocalClientId)
                            continue;

                        // Found partner avatar
                        PartnerAvatar = avatar.transform;
                        PartnerClientId = clientId;
                        _partnerFound = true;

                        // Set up interaction manager with partner
                        SetupPartnerInteraction(avatar.transform, clientId);

                        OnPartnerAvatarFound?.Invoke(avatar.transform);
                        OnPartnerEntered();

                        Debug.Log($"[BoothManager] Partner avatar found (clientId: {clientId})");
                        yield break;
                    }
                }

                // Fallback: Search by tag if no RealtimeAvatarManager
                if (!_partnerFound)
                {
                    var avatars = GameObject.FindGameObjectsWithTag(_partnerAvatarTag);
                    foreach (var avatar in avatars)
                    {
                        // Skip our own avatar
                        if (avatar.transform == PlayerController.Instance?.transform)
                            continue;

                        // Check if this is a networked avatar
                        var realtimeView = avatar.GetComponent<RealtimeView>();
                        if (realtimeView != null && !realtimeView.isOwnedLocallySelf)
                        {
                            PartnerAvatar = avatar.transform;
                            PartnerClientId = realtimeView.ownerIDSelf;
                            _partnerFound = true;

                            SetupPartnerInteraction(avatar.transform, PartnerClientId);

                            OnPartnerAvatarFound?.Invoke(avatar.transform);
                            OnPartnerEntered();

                            Debug.Log($"[BoothManager] Partner avatar found by tag (clientId: {PartnerClientId})");
                            yield break;
                        }
                    }
                }

                yield return new WaitForSeconds(_partnerSearchInterval);
            }
        }

        /// <summary>
        /// Sets up the InteractionManager with the partner avatar.
        /// </summary>
        private void SetupPartnerInteraction(Transform partnerAvatar, int clientId)
        {
            var interactionManager = InteractionManager.Instance;
            if (interactionManager == null) return;

            interactionManager.SetPartner(partnerAvatar, clientId);
            Debug.Log($"[BoothManager] InteractionManager configured with partner");
        }

        /// <summary>
        /// Called when partner joins the booth.
        /// </summary>
        public void OnPartnerEntered()
        {
            Debug.Log("[BoothManager] Partner entered booth");

            // Start ambiance
            PlayAmbience();

            OnPartnerJoined?.Invoke();
        }

        /// <summary>
        /// Called when partner leaves the booth.
        /// </summary>
        public void OnPartnerExited()
        {
            Debug.Log("[BoothManager] Partner left booth");

            // Clear partner tracking
            PartnerAvatar = null;
            PartnerClientId = -1;
            _partnerFound = false;

            // Clear interaction manager partner
            InteractionManager.Instance?.ClearPartner();

            // Revoke consent automatically
            RevokeConsent();

            OnPartnerLeft?.Invoke();
        }

        /// <summary>
        /// Grants consent for intimate interactions.
        /// Both users must grant consent for intimate zones to be enabled.
        /// </summary>
        public void GrantConsent()
        {
            ConsentGranted = true;

            // Enable intimate interactions
            InteractionManager.Instance?.GrantConsent(InteractionZone.Intimate);

            // Dim lights for mood
            SetMoodLighting(true);

            // Sync consent state (would go through Normcore)
            OnConsentChanged?.Invoke();

            Debug.Log("[BoothManager] Consent granted");
        }

        /// <summary>
        /// Revokes consent immediately.
        /// </summary>
        public void RevokeConsent()
        {
            ConsentGranted = false;

            // Disable intimate interactions
            InteractionManager.Instance?.RevokeConsent(InteractionZone.Intimate);

            // Return to normal lighting
            SetMoodLighting(false);

            OnConsentChanged?.Invoke();

            Debug.Log("[BoothManager] Consent revoked");
        }

        /// <summary>
        /// Requests to leave the booth.
        /// </summary>
        public void RequestExit()
        {
            Debug.Log("[BoothManager] Exit requested");

            // Immediately revoke consent
            RevokeConsent();

            // Clear interaction partner
            InteractionManager.Instance?.ClearPartner();

            OnExitRequested?.Invoke();

            // Leave via GameManager
            _ = GameManager.Instance?.LeaveVRSpace();
        }

        public void EndPartySession()
        {
            if (!_isHost)
            {
                return;
            }

            _ = BroadcastHostControl("end_party", null, "Host ended the party");
            RequestExit();
        }

        public void SetInviteOnly(bool value)
        {
            if (!_isHost)
            {
                return;
            }

            _inviteOnly = value;
            OnPrivacyStateChanged?.Invoke();
            BroadcastPrivacyState();
        }

        public void SetRoomLocked(bool value)
        {
            if (!_isHost)
            {
                return;
            }

            _roomLocked = value;
            OnPrivacyStateChanged?.Invoke();
            BroadcastPrivacyState();
        }

        public void SetCompanionVoiceAllowed(bool value)
        {
            if (!_isHost)
            {
                return;
            }

            _companionVoiceAllowed = value;
            OnPrivacyStateChanged?.Invoke();
            BroadcastPrivacyState();
        }

        public void SetMaxGuestCount(int value)
        {
            if (!_isHost)
            {
                return;
            }

            _maxGuestCount = Mathf.Clamp(value, 2, 12);
            OnPrivacyStateChanged?.Invoke();
            BroadcastPrivacyState();
        }

        /// <summary>
        /// Emergency exit - instant, no animation.
        /// LEGAL NOTE: This must always be accessible and functional.
        /// </summary>
        public void EmergencyExit()
        {
            Debug.Log("[BoothManager] EMERGENCY EXIT");

            // Stop partner search
            if (_partnerSearchCoroutine != null)
            {
                StopCoroutine(_partnerSearchCoroutine);
                _partnerSearchCoroutine = null;
            }

            // Clear partner state
            PartnerAvatar = null;
            PartnerClientId = -1;
            _partnerFound = false;
            IsOccupied = false;

            // Immediate cleanup
            RevokeConsent();
            InteractionManager.Instance?.RevokeAllConsent();
            InteractionManager.Instance?.ClearPartner();

            // Force disconnect
            DriftRealtime.Instance?.LeaveRoom();

            // Return to safe state
            GameManager.Instance?.LeaveVRSpace();
        }

        private void SubscribeInviteService()
        {
            var service = BoothInviteService.Instance;
            if (service == null)
            {
                var go = new GameObject("BoothInviteService");
                service = go.AddComponent<BoothInviteService>();
            }

            service.OnPrivacyUpdateReceived += HandleRemotePrivacyUpdate;
            service.OnHostControlReceived += HandleRemoteHostControl;
        }

        private void UnsubscribeInviteService()
        {
            var service = BoothInviteService.Instance;
            if (service == null)
            {
                return;
            }

            service.OnPrivacyUpdateReceived -= HandleRemotePrivacyUpdate;
            service.OnHostControlReceived -= HandleRemoteHostControl;
        }

        private void HandleRemotePrivacyUpdate(BoothPrivacyUpdateMessage message)
        {
            if (message == null || !MatchesCurrentBooth(message.booth_id))
            {
                return;
            }

            _inviteOnly = message.invite_only;
            _roomLocked = message.room_locked;
            _companionVoiceAllowed = message.companion_voice_allowed;
            _maxGuestCount = Mathf.Clamp(message.max_guest_count, 2, 12);
            OnPrivacyStateChanged?.Invoke();
        }

        private void HandleRemoteHostControl(BoothHostControlMessage message)
        {
            if (message == null || !MatchesCurrentBooth(message.booth_id))
            {
                return;
            }

            if (string.Equals(message.action, "end_party", StringComparison.OrdinalIgnoreCase))
            {
                EmergencyExit();
            }
        }

        private bool MatchesCurrentBooth(string boothId)
        {
            if (string.IsNullOrWhiteSpace(boothId) || string.IsNullOrWhiteSpace(BoothId))
            {
                return false;
            }

            return string.Equals(BoothId, boothId, StringComparison.Ordinal);
        }

        private async Task BroadcastHostControl(string action, string targetUserId, string note)
        {
            var service = BoothInviteService.Instance;
            if (service == null || string.IsNullOrWhiteSpace(BoothId))
            {
                return;
            }

            await service.BroadcastHostControl(new BoothHostControlMessage
            {
                booth_id = BoothId,
                host_user_id = GameManager.Instance?.UserId,
                action = action,
                target_user_id = targetUserId,
                note = note,
                sent_at_unix_ms = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            });
        }

        private async void BroadcastPrivacyState()
        {
            var service = BoothInviteService.Instance;
            if (service == null || string.IsNullOrWhiteSpace(BoothId))
            {
                return;
            }

            await service.BroadcastPrivacyUpdate(new BoothPrivacyUpdateMessage
            {
                booth_id = BoothId,
                host_user_id = GameManager.Instance?.UserId,
                invite_only = _inviteOnly,
                room_locked = _roomLocked,
                companion_voice_allowed = _companionVoiceAllowed,
                max_guest_count = _maxGuestCount,
                updated_at_unix_ms = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            });
        }

        /// <summary>
        /// Gets the partner's current position if available.
        /// </summary>
        public Vector3? GetPartnerPosition()
        {
            if (PartnerAvatar != null)
            {
                return PartnerAvatar.position;
            }
            return null;
        }

        /// <summary>
        /// Gets the distance to partner if available.
        /// </summary>
        public float? GetDistanceToPartner()
        {
            if (PartnerAvatar != null && PlayerController.Instance != null)
            {
                return Vector3.Distance(
                    PlayerController.Instance.transform.position,
                    PartnerAvatar.position
                );
            }
            return null;
        }

        private void InitializeAmbiance()
        {
            if (_boothLights == null)
            {
                return;
            }

            // Set default lighting
            foreach (var light in _boothLights)
            {
                if (light != null)
                {
                    light.color = _defaultLightColor;
                    light.intensity = 1f;
                }
            }

            // Start atmosphere effect
            if (_atmosphereEffect != null)
            {
                _atmosphereEffect.Play();
            }
        }

        private void PlayAmbience()
        {
            if (_ambienceSource == null || _ambienceClips == null || _ambienceClips.Length == 0)
                return;

            int index = UnityEngine.Random.Range(0, _ambienceClips.Length);
            _ambienceSource.clip = _ambienceClips[index];
            _ambienceSource.loop = true;
            _ambienceSource.Play();
        }

        private void SetMoodLighting(bool intimate)
        {
            _targetLightIntensity = intimate ? 0.3f : 1f;

            // Change color slightly
            Color targetColor = intimate
                ? new Color(1f, 0.2f, 0.4f) // Deeper pink/red
                : _defaultLightColor;

            if (_boothLights == null)
            {
                return;
            }

            foreach (var light in _boothLights)
            {
                if (light != null)
                {
                    light.color = targetColor;
                }
            }
        }

        private void UpdateLighting()
        {
            if (_boothLights == null)
            {
                return;
            }

            foreach (var light in _boothLights)
            {
                if (light != null)
                {
                    light.intensity = Mathf.Lerp(
                        light.intensity,
                        _targetLightIntensity,
                        Time.deltaTime * _lightDimSpeed
                    );
                }
            }
        }

        /// <summary>
        /// Sets the booth ambiance preset.
        /// </summary>
        public void SetAmbiancePreset(BoothAmbiance preset)
        {
            switch (preset)
            {
                case BoothAmbiance.Romantic:
                    SetLightColor(new Color(1f, 0.3f, 0.5f));
                    _targetLightIntensity = 0.5f;
                    break;

                case BoothAmbiance.Passionate:
                    SetLightColor(new Color(1f, 0.1f, 0.2f));
                    _targetLightIntensity = 0.3f;
                    break;

                case BoothAmbiance.Playful:
                    SetLightColor(new Color(0.5f, 0.3f, 1f));
                    _targetLightIntensity = 0.7f;
                    break;

                case BoothAmbiance.Calm:
                    SetLightColor(new Color(0.3f, 0.5f, 1f));
                    _targetLightIntensity = 0.6f;
                    break;

                default:
                    SetLightColor(_defaultLightColor);
                    _targetLightIntensity = 1f;
                    break;
            }
        }

        private void SetLightColor(Color color)
        {
            if (_boothLights == null)
            {
                return;
            }

            foreach (var light in _boothLights)
            {
                if (light != null)
                {
                    light.color = color;
                }
            }
        }

        /// <summary>
        /// Shows/hides the settings panel.
        /// </summary>
        public void ToggleSettings()
        {
            if (_settingsPanel != null)
            {
                _settingsPanel.SetActive(!_settingsPanel.activeSelf);
            }
        }
    }

    /// <summary>
    /// Ambiance presets for private booths.
    /// </summary>
    public enum BoothAmbiance
    {
        Default,
        Romantic,
        Passionate,
        Playful,
        Calm
    }
}
