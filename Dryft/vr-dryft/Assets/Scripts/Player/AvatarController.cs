using UnityEngine;
using Normal.Realtime;
using Drift.API;
using Drift.Marketplace;
using Drift.Avatar;

namespace Drift.Player
{
    /// <summary>
    /// Controls the visual avatar representation in VR.
    /// Syncs head and hand positions for other players to see.
    ///
    /// Avatar features:
    /// - Head tracking (shows where user is looking)
    /// - Hand tracking (controller or hand tracking positions)
    /// - Optional body estimation
    /// - Customizable appearance (loaded from marketplace purchases)
    /// </summary>
    public class AvatarController : MonoBehaviour
    {
        [Header("Avatar Parts")]
        [SerializeField] private Transform _headTransform;
        [SerializeField] private Transform _leftHandTransform;
        [SerializeField] private Transform _rightHandTransform;
        [SerializeField] private Transform _bodyTransform;

        [Header("Visual Components")]
        [SerializeField] private Renderer _headRenderer;
        [SerializeField] private Renderer _leftHandRenderer;
        [SerializeField] private Renderer _rightHandRenderer;
        [SerializeField] private Renderer _bodyRenderer;

        [Header("Settings")]
        [SerializeField] private bool _isLocalAvatar = false;
        [SerializeField] private bool _hideLocalAvatar = true;
        [SerializeField] private float _bodyHeightOffset = -0.7f;

        [Header("Customization")]
        [SerializeField] private string _avatarId = "default";
        [SerializeField] private Color _avatarColor = Color.cyan;
        [SerializeField] private Color _skinTone = Color.white;
        [SerializeField] private Color _hairColor = Color.black;
        [SerializeField] private Color _eyeColor = Color.blue;

        [Header("Animation")]
        [SerializeField] private Animator _animator;
        [SerializeField] private string _emoteLayerName = "Emotes";

        [Header("Equipped Items")]
        [SerializeField] private Transform _avatarModelRoot;
        [SerializeField] private Transform _outfitModelRoot;
        [SerializeField] private Transform _effectsRoot;

        // Currently equipped items
        private InventoryItem _equippedAvatar;
        private InventoryItem _equippedOutfit;
        private InventoryItem _equippedEffect;
        private GameObject _loadedAvatarModel;
        private GameObject _loadedOutfitModel;
        private GameObject _loadedEffectPrefab;

        // Normcore sync
        private RealtimeView _realtimeView;
        private RealtimeTransform _headSync;
        private RealtimeTransform _leftHandSync;
        private RealtimeTransform _rightHandSync;

        // Local tracking references
        private Transform _trackingHead;
        private Transform _trackingLeftHand;
        private Transform _trackingRightHand;

        public bool IsLocalAvatar => _isLocalAvatar;
        public string AvatarId => _avatarId;

        private void Awake()
        {
            _realtimeView = GetComponent<RealtimeView>();
        }

        private void Start()
        {
            // Determine if this is the local avatar
            if (_realtimeView != null)
            {
                _isLocalAvatar = _realtimeView.isOwnedLocallySelf;
            }

            if (_isLocalAvatar)
            {
                SetupLocalAvatar();
                SubscribeToInventoryEvents();
                LoadEquippedItems();
            }
            else
            {
                SetupRemoteAvatar();
            }
        }

        private void SubscribeToInventoryEvents()
        {
            var inventory = InventoryManager.Instance;
            if (inventory != null)
            {
                inventory.OnItemEquipped += OnItemEquipped;
                inventory.OnItemUnequipped += OnItemUnequipped;
                inventory.OnInventoryLoaded += LoadEquippedItems;
            }
        }

        private void OnItemEquipped(InventoryItem item)
        {
            if (item?.item == null) return;

            switch (item.item.ItemType)
            {
                case ItemType.Avatar:
                    _ = LoadAvatarFromInventory(item);
                    break;
                case ItemType.Outfit:
                    _ = LoadOutfitFromInventory(item);
                    break;
                case ItemType.Effect:
                    _ = LoadEffectFromInventory(item);
                    break;
            }
        }

        private void OnItemUnequipped(InventoryItem item)
        {
            if (item?.item == null) return;

            switch (item.item.ItemType)
            {
                case ItemType.Avatar:
                    UnloadAvatar();
                    break;
                case ItemType.Outfit:
                    UnloadOutfit();
                    break;
                case ItemType.Effect:
                    UnloadEffect();
                    break;
            }
        }

        private void LoadEquippedItems()
        {
            var inventory = InventoryManager.Instance;
            if (inventory == null) return;

            var avatar = inventory.GetEquippedItem(ItemType.Avatar);
            var outfit = inventory.GetEquippedItem(ItemType.Outfit);
            var effect = inventory.GetEquippedItem(ItemType.Effect);

            if (avatar != null) _ = LoadAvatarFromInventory(avatar);
            if (outfit != null) _ = LoadOutfitFromInventory(outfit);
            if (effect != null) _ = LoadEffectFromInventory(effect);
        }

        private void Update()
        {
            if (_isLocalAvatar)
            {
                UpdateLocalTracking();
            }

            UpdateBodyPosition();
        }

        private void SetupLocalAvatar()
        {
            // Find local tracking references
            var playerController = PlayerController.Instance;
            if (playerController != null)
            {
                // We'll track from player controller's anchors
                _trackingHead = playerController.transform.Find("TrackingSpace/CenterEyeAnchor");
                _trackingLeftHand = playerController.transform.Find("TrackingSpace/LeftHandAnchor");
                _trackingRightHand = playerController.transform.Find("TrackingSpace/RightHandAnchor");
            }

            // Hide local avatar visuals if configured
            if (_hideLocalAvatar)
            {
                SetAvatarVisible(false);
            }

            Debug.Log("[AvatarController] Local avatar setup complete");
        }

        private void SetupRemoteAvatar()
        {
            // Remote avatar - just show visuals
            SetAvatarVisible(true);
            ApplyAvatarColor(_avatarColor);

            Debug.Log("[AvatarController] Remote avatar setup complete");
        }

        private void UpdateLocalTracking()
        {
            // Update avatar transforms to match tracking
            if (_trackingHead != null && _headTransform != null)
            {
                _headTransform.position = _trackingHead.position;
                _headTransform.rotation = _trackingHead.rotation;
            }

            if (_trackingLeftHand != null && _leftHandTransform != null)
            {
                _leftHandTransform.position = _trackingLeftHand.position;
                _leftHandTransform.rotation = _trackingLeftHand.rotation;
            }

            if (_trackingRightHand != null && _rightHandTransform != null)
            {
                _rightHandTransform.position = _trackingRightHand.position;
                _rightHandTransform.rotation = _trackingRightHand.rotation;
            }
        }

        private void UpdateBodyPosition()
        {
            // Position body below head
            if (_bodyTransform != null && _headTransform != null)
            {
                Vector3 bodyPos = _headTransform.position;
                bodyPos.y += _bodyHeightOffset;
                _bodyTransform.position = bodyPos;

                // Body faces same direction as head (on Y axis only)
                Vector3 headForward = _headTransform.forward;
                headForward.y = 0;
                if (headForward.sqrMagnitude > 0.01f)
                {
                    _bodyTransform.rotation = Quaternion.LookRotation(headForward);
                }
            }
        }

        /// <summary>
        /// Sets avatar visibility.
        /// </summary>
        public void SetAvatarVisible(bool visible)
        {
            if (_headRenderer != null) _headRenderer.enabled = visible;
            if (_leftHandRenderer != null) _leftHandRenderer.enabled = visible;
            if (_rightHandRenderer != null) _rightHandRenderer.enabled = visible;
            if (_bodyRenderer != null) _bodyRenderer.enabled = visible;
        }

        /// <summary>
        /// Applies a color tint to the avatar.
        /// </summary>
        public void ApplyAvatarColor(Color color)
        {
            _avatarColor = color;

            MaterialPropertyBlock props = new MaterialPropertyBlock();
            props.SetColor("_Color", color);
            props.SetColor("_EmissionColor", color * 0.5f);

            if (_headRenderer != null) _headRenderer.SetPropertyBlock(props);
            if (_leftHandRenderer != null) _leftHandRenderer.SetPropertyBlock(props);
            if (_rightHandRenderer != null) _rightHandRenderer.SetPropertyBlock(props);
            if (_bodyRenderer != null) _bodyRenderer.SetPropertyBlock(props);
        }

        /// <summary>
        /// Loads a custom avatar by ID (from marketplace).
        /// </summary>
        public void LoadAvatar(string avatarId)
        {
            _avatarId = avatarId;
            Debug.Log($"[AvatarController] Loading avatar: {avatarId}");
        }

        /// <summary>
        /// Loads an avatar from an inventory item.
        /// </summary>
        public async System.Threading.Tasks.Task LoadAvatarFromInventory(InventoryItem item)
        {
            if (item?.item == null) return;

            var inventory = InventoryManager.Instance;
            if (inventory == null) return;

            Debug.Log($"[AvatarController] Loading avatar from inventory: {item.item.name}");

            // Unload current avatar first
            UnloadAvatar();

            _equippedAvatar = item;
            _avatarId = item.item_id;

            // Load asset bundle
            var bundle = await inventory.LoadAssetBundleAsync(item.item_id);
            if (bundle == null)
            {
                Debug.LogWarning($"[AvatarController] Failed to load avatar bundle: {item.item_id}");
                return;
            }

            // Find and instantiate the avatar prefab
            var prefabName = bundle.GetAllAssetNames().Length > 0 ? bundle.GetAllAssetNames()[0] : null;
            if (string.IsNullOrEmpty(prefabName))
            {
                Debug.LogWarning($"[AvatarController] No prefab found in avatar bundle");
                return;
            }

            var prefab = bundle.LoadAsset<GameObject>(prefabName);
            if (prefab == null)
            {
                Debug.LogWarning($"[AvatarController] Failed to load avatar prefab");
                return;
            }

            // Instantiate under avatar root
            var parent = _avatarModelRoot != null ? _avatarModelRoot : transform;
            _loadedAvatarModel = Instantiate(prefab, parent);
            _loadedAvatarModel.name = $"Avatar_{item.item.name}";

            Debug.Log($"[AvatarController] Avatar loaded: {item.item.name}");
        }

        /// <summary>
        /// Unloads the current avatar.
        /// </summary>
        public void UnloadAvatar()
        {
            if (_loadedAvatarModel != null)
            {
                Destroy(_loadedAvatarModel);
                _loadedAvatarModel = null;
            }

            if (_equippedAvatar != null)
            {
                InventoryManager.Instance?.UnloadAssetBundle(_equippedAvatar.item_id, false);
                _equippedAvatar = null;
            }

            _avatarId = "default";
        }

        /// <summary>
        /// Loads an outfit from an inventory item.
        /// </summary>
        public async System.Threading.Tasks.Task LoadOutfitFromInventory(InventoryItem item)
        {
            if (item?.item == null) return;

            var inventory = InventoryManager.Instance;
            if (inventory == null) return;

            Debug.Log($"[AvatarController] Loading outfit: {item.item.name}");

            UnloadOutfit();
            _equippedOutfit = item;

            var bundle = await inventory.LoadAssetBundleAsync(item.item_id);
            if (bundle == null) return;

            var prefabNames = bundle.GetAllAssetNames();
            if (prefabNames.Length == 0) return;

            var prefab = bundle.LoadAsset<GameObject>(prefabNames[0]);
            if (prefab == null) return;

            var parent = _outfitModelRoot != null ? _outfitModelRoot : transform;
            _loadedOutfitModel = Instantiate(prefab, parent);
            _loadedOutfitModel.name = $"Outfit_{item.item.name}";

            Debug.Log($"[AvatarController] Outfit loaded: {item.item.name}");
        }

        /// <summary>
        /// Unloads the current outfit.
        /// </summary>
        public void UnloadOutfit()
        {
            if (_loadedOutfitModel != null)
            {
                Destroy(_loadedOutfitModel);
                _loadedOutfitModel = null;
            }

            if (_equippedOutfit != null)
            {
                InventoryManager.Instance?.UnloadAssetBundle(_equippedOutfit.item_id, false);
                _equippedOutfit = null;
            }
        }

        /// <summary>
        /// Loads an effect from an inventory item.
        /// </summary>
        public async System.Threading.Tasks.Task LoadEffectFromInventory(InventoryItem item)
        {
            if (item?.item == null) return;

            var inventory = InventoryManager.Instance;
            if (inventory == null) return;

            Debug.Log($"[AvatarController] Loading effect: {item.item.name}");

            UnloadEffect();
            _equippedEffect = item;

            var bundle = await inventory.LoadAssetBundleAsync(item.item_id);
            if (bundle == null) return;

            var prefabNames = bundle.GetAllAssetNames();
            if (prefabNames.Length == 0) return;

            var prefab = bundle.LoadAsset<GameObject>(prefabNames[0]);
            if (prefab == null) return;

            var parent = _effectsRoot != null ? _effectsRoot : transform;
            _loadedEffectPrefab = Instantiate(prefab, parent);
            _loadedEffectPrefab.name = $"Effect_{item.item.name}";

            Debug.Log($"[AvatarController] Effect loaded: {item.item.name}");
        }

        /// <summary>
        /// Unloads the current effect.
        /// </summary>
        public void UnloadEffect()
        {
            if (_loadedEffectPrefab != null)
            {
                Destroy(_loadedEffectPrefab);
                _loadedEffectPrefab = null;
            }

            if (_equippedEffect != null)
            {
                InventoryManager.Instance?.UnloadAssetBundle(_equippedEffect.item_id, false);
                _equippedEffect = null;
            }
        }

        private void OnDestroy()
        {
            // Unsubscribe from events
            var inventory = InventoryManager.Instance;
            if (inventory != null)
            {
                inventory.OnItemEquipped -= OnItemEquipped;
                inventory.OnItemUnequipped -= OnItemUnequipped;
                inventory.OnInventoryLoaded -= LoadEquippedItems;
            }

            // Unload all equipped items
            UnloadAvatar();
            UnloadOutfit();
            UnloadEffect();
        }

        /// <summary>
        /// Gets the position of a specific avatar part.
        /// </summary>
        public Vector3 GetPartPosition(AvatarPart part)
        {
            return part switch
            {
                AvatarPart.Head => _headTransform?.position ?? Vector3.zero,
                AvatarPart.LeftHand => _leftHandTransform?.position ?? Vector3.zero,
                AvatarPart.RightHand => _rightHandTransform?.position ?? Vector3.zero,
                AvatarPart.Body => _bodyTransform?.position ?? Vector3.zero,
                _ => Vector3.zero
            };
        }

        /// <summary>
        /// Gets the forward direction of a specific avatar part.
        /// </summary>
        public Vector3 GetPartForward(AvatarPart part)
        {
            return part switch
            {
                AvatarPart.Head => _headTransform?.forward ?? Vector3.forward,
                AvatarPart.LeftHand => _leftHandTransform?.forward ?? Vector3.forward,
                AvatarPart.RightHand => _rightHandTransform?.forward ?? Vector3.forward,
                AvatarPart.Body => _bodyTransform?.forward ?? Vector3.forward,
                _ => Vector3.forward
            };
        }

        /// <summary>
        /// Calculates distance between this avatar's hand and a point.
        /// Used for interaction detection.
        /// </summary>
        public float GetHandDistanceTo(AvatarPart hand, Vector3 point)
        {
            if (hand != AvatarPart.LeftHand && hand != AvatarPart.RightHand)
                return float.MaxValue;

            Vector3 handPos = GetPartPosition(hand);
            return Vector3.Distance(handPos, point);
        }

        // =========================================================================
        // Network Sync Integration
        // =========================================================================

        /// <summary>
        /// Gets the current avatar customization state for network sync.
        /// </summary>
        public AvatarState GetCurrentState()
        {
            return new AvatarState
            {
                AvatarId = _equippedAvatar?.item_id ?? "",
                OutfitId = _equippedOutfit?.item_id ?? "",
                EffectId = _equippedEffect?.item_id ?? "",
                SkinTone = _skinTone,
                HairColor = _hairColor,
                EyeColor = _eyeColor
            };
        }

        /// <summary>
        /// Sets avatar visibility (alias for network sync).
        /// </summary>
        public void SetVisible(bool visible)
        {
            SetAvatarVisible(visible);
        }

        /// <summary>
        /// Sets a material color property on all avatar renderers.
        /// </summary>
        public void SetMaterialColor(string propertyName, Color color)
        {
            MaterialPropertyBlock props = new MaterialPropertyBlock();

            void ApplyToRenderer(Renderer renderer)
            {
                if (renderer == null) return;
                renderer.GetPropertyBlock(props);
                props.SetColor(propertyName, color);
                renderer.SetPropertyBlock(props);
            }

            ApplyToRenderer(_headRenderer);
            ApplyToRenderer(_leftHandRenderer);
            ApplyToRenderer(_rightHandRenderer);
            ApplyToRenderer(_bodyRenderer);

            // Apply to loaded models
            if (_loadedAvatarModel != null)
            {
                foreach (var renderer in _loadedAvatarModel.GetComponentsInChildren<Renderer>())
                {
                    ApplyToRenderer(renderer);
                }
            }

            if (_loadedOutfitModel != null)
            {
                foreach (var renderer in _loadedOutfitModel.GetComponentsInChildren<Renderer>())
                {
                    ApplyToRenderer(renderer);
                }
            }

            // Update local color references
            switch (propertyName)
            {
                case "_SkinTone":
                    _skinTone = color;
                    break;
                case "_HairColor":
                    _hairColor = color;
                    break;
                case "_EyeColor":
                    _eyeColor = color;
                    break;
            }
        }

        /// <summary>
        /// Sets the avatar colors.
        /// </summary>
        public void SetColors(Color skinTone, Color hairColor, Color eyeColor)
        {
            SetMaterialColor("_SkinTone", skinTone);
            SetMaterialColor("_HairColor", hairColor);
            SetMaterialColor("_EyeColor", eyeColor);
        }

        /// <summary>
        /// Plays an emote animation.
        /// </summary>
        public void PlayEmote(int emoteId)
        {
            if (_animator == null)
            {
                _animator = GetComponentInChildren<Animator>();
            }

            if (_animator != null && emoteId > 0)
            {
                _animator.SetInteger("EmoteId", emoteId);
                _animator.SetTrigger("PlayEmote");
                Debug.Log($"[AvatarController] Playing emote: {emoteId}");
            }
        }

        /// <summary>
        /// Loads an effect with time offset (for network sync).
        /// </summary>
        public async System.Threading.Tasks.Task LoadEffectFromInventory(InventoryItem item, float timeOffset)
        {
            await LoadEffectFromInventory(item);

            // Apply time offset to synced particle effects
            if (_loadedEffectPrefab != null && timeOffset > 0)
            {
                var particles = _loadedEffectPrefab.GetComponentsInChildren<ParticleSystem>();
                foreach (var ps in particles)
                {
                    ps.Simulate(timeOffset, true, true);
                    ps.Play();
                }
            }
        }
    }

    /// <summary>
    /// Avatar body parts.
    /// </summary>
    public enum AvatarPart
    {
        Head,
        LeftHand,
        RightHand,
        Body
    }
}
