using UnityEngine;
using Normal.Realtime;
using Normal.Realtime.Serialization;
using Drift.Player;
using Drift.Marketplace;

namespace Drift.Avatar
{
    /// <summary>
    /// Normcore RealtimeModel for synchronizing avatar customization across the network.
    /// Tracks equipped avatar, outfit, and active effects so other players see your look.
    /// </summary>
    [RealtimeModel]
    public partial class AvatarSyncModel
    {
        // Equipped item IDs (empty string = none equipped)
        [RealtimeProperty(1, true, true)]
        private string _equippedAvatarId;

        [RealtimeProperty(2, true, true)]
        private string _equippedOutfitId;

        [RealtimeProperty(3, true, true)]
        private string _equippedEffectId;

        // Avatar colors/tints (serialized as hex)
        [RealtimeProperty(4, true, true)]
        private string _skinTone;

        [RealtimeProperty(5, true, true)]
        private string _hairColor;

        [RealtimeProperty(6, true, true)]
        private string _eyeColor;

        // Display name shown above avatar
        [RealtimeProperty(7, true, true)]
        private string _displayName;

        // Avatar visibility state
        [RealtimeProperty(8, true, true)]
        private bool _isVisible;

        // Animation state
        [RealtimeProperty(9, true, true)]
        private int _currentEmote;

        // Timestamp for effect sync
        [RealtimeProperty(10, true, true)]
        private double _effectStartTime;
    }

    /// <summary>
    /// Syncs avatar customization state across the Normcore network.
    /// Attach to the player avatar prefab alongside RealtimeView.
    /// </summary>
    public class AvatarSync : RealtimeComponent<AvatarSyncModel>
    {
        [Header("References")]
        [SerializeField] private AvatarController _avatarController;
        [SerializeField] private TMPro.TextMeshPro _nameLabel;

        [Header("Settings")]
        [SerializeField] private float _syncDebounceTime = 0.1f;

        private float _lastSyncTime;
        private bool _pendingSync;

        private void Awake()
        {
            if (_avatarController == null)
            {
                _avatarController = GetComponent<AvatarController>();
            }
        }

        protected override void OnRealtimeModelReplaced(AvatarSyncModel previousModel, AvatarSyncModel currentModel)
        {
            if (previousModel != null)
            {
                previousModel.equippedAvatarIdDidChange -= OnAvatarChanged;
                previousModel.equippedOutfitIdDidChange -= OnOutfitChanged;
                previousModel.equippedEffectIdDidChange -= OnEffectChanged;
                previousModel.skinToneDidChange -= OnSkinToneChanged;
                previousModel.hairColorDidChange -= OnHairColorChanged;
                previousModel.eyeColorDidChange -= OnEyeColorChanged;
                previousModel.displayNameDidChange -= OnDisplayNameChanged;
                previousModel.isVisibleDidChange -= OnVisibilityChanged;
                previousModel.currentEmoteDidChange -= OnEmoteChanged;
            }

            if (currentModel != null)
            {
                currentModel.equippedAvatarIdDidChange += OnAvatarChanged;
                currentModel.equippedOutfitIdDidChange += OnOutfitChanged;
                currentModel.equippedEffectIdDidChange += OnEffectChanged;
                currentModel.skinToneDidChange += OnSkinToneChanged;
                currentModel.hairColorDidChange += OnHairColorChanged;
                currentModel.eyeColorDidChange += OnEyeColorChanged;
                currentModel.displayNameDidChange += OnDisplayNameChanged;
                currentModel.isVisibleDidChange += OnVisibilityChanged;
                currentModel.currentEmoteDidChange += OnEmoteChanged;

                // Apply initial state if not local
                if (!realtimeView.isOwnedLocallyInHierarchy)
                {
                    ApplyRemoteState(currentModel);
                }
            }
        }

        // =========================================================================
        // Local Player - Push Changes to Network
        // =========================================================================

        /// <summary>
        /// Call when local player equips a new avatar.
        /// </summary>
        public void SetEquippedAvatar(string avatarId)
        {
            if (!realtimeView.isOwnedLocallyInHierarchy) return;
            model.equippedAvatarId = avatarId ?? "";
        }

        /// <summary>
        /// Call when local player equips a new outfit.
        /// </summary>
        public void SetEquippedOutfit(string outfitId)
        {
            if (!realtimeView.isOwnedLocallyInHierarchy) return;
            model.equippedOutfitId = outfitId ?? "";
        }

        /// <summary>
        /// Call when local player equips a new effect.
        /// </summary>
        public void SetEquippedEffect(string effectId)
        {
            if (!realtimeView.isOwnedLocallyInHierarchy) return;
            model.equippedEffectId = effectId ?? "";
            model.effectStartTime = realtime.room.time;
        }

        /// <summary>
        /// Sets the avatar colors.
        /// </summary>
        public void SetColors(Color skinTone, Color hairColor, Color eyeColor)
        {
            if (!realtimeView.isOwnedLocallyInHierarchy) return;

            model.skinTone = ColorUtility.ToHtmlStringRGBA(skinTone);
            model.hairColor = ColorUtility.ToHtmlStringRGBA(hairColor);
            model.eyeColor = ColorUtility.ToHtmlStringRGBA(eyeColor);
        }

        /// <summary>
        /// Sets the display name shown above the avatar.
        /// </summary>
        public void SetDisplayName(string name)
        {
            if (!realtimeView.isOwnedLocallyInHierarchy) return;
            model.displayName = name ?? "";
        }

        /// <summary>
        /// Sets avatar visibility.
        /// </summary>
        public void SetVisible(bool visible)
        {
            if (!realtimeView.isOwnedLocallyInHierarchy) return;
            model.isVisible = visible;
        }

        /// <summary>
        /// Triggers an emote animation.
        /// </summary>
        public void PlayEmote(int emoteId)
        {
            if (!realtimeView.isOwnedLocallyInHierarchy) return;
            model.currentEmote = emoteId;
        }

        /// <summary>
        /// Syncs all current avatar state to the network.
        /// </summary>
        public void SyncCurrentState()
        {
            if (!realtimeView.isOwnedLocallyInHierarchy || _avatarController == null) return;

            var state = _avatarController.GetCurrentState();
            if (state != null)
            {
                model.equippedAvatarId = state.AvatarId ?? "";
                model.equippedOutfitId = state.OutfitId ?? "";
                model.equippedEffectId = state.EffectId ?? "";
                model.skinTone = ColorUtility.ToHtmlStringRGBA(state.SkinTone);
                model.hairColor = ColorUtility.ToHtmlStringRGBA(state.HairColor);
                model.eyeColor = ColorUtility.ToHtmlStringRGBA(state.EyeColor);
            }
        }

        // =========================================================================
        // Remote Players - Receive Changes from Network
        // =========================================================================

        private void OnAvatarChanged(AvatarSyncModel model, string value)
        {
            if (realtimeView.isOwnedLocallyInHierarchy) return;
            LoadRemoteAvatar(value);
        }

        private void OnOutfitChanged(AvatarSyncModel model, string value)
        {
            if (realtimeView.isOwnedLocallyInHierarchy) return;
            LoadRemoteOutfit(value);
        }

        private void OnEffectChanged(AvatarSyncModel model, string value)
        {
            if (realtimeView.isOwnedLocallyInHierarchy) return;
            LoadRemoteEffect(value, model.effectStartTime);
        }

        private void OnSkinToneChanged(AvatarSyncModel model, string value)
        {
            if (realtimeView.isOwnedLocallyInHierarchy) return;
            ApplyColor("_SkinTone", value);
        }

        private void OnHairColorChanged(AvatarSyncModel model, string value)
        {
            if (realtimeView.isOwnedLocallyInHierarchy) return;
            ApplyColor("_HairColor", value);
        }

        private void OnEyeColorChanged(AvatarSyncModel model, string value)
        {
            if (realtimeView.isOwnedLocallyInHierarchy) return;
            ApplyColor("_EyeColor", value);
        }

        private void OnDisplayNameChanged(AvatarSyncModel model, string value)
        {
            if (_nameLabel != null)
            {
                _nameLabel.text = value ?? "";
            }
        }

        private void OnVisibilityChanged(AvatarSyncModel model, bool value)
        {
            if (_avatarController != null)
            {
                _avatarController.SetVisible(value);
            }
        }

        private void OnEmoteChanged(AvatarSyncModel model, int value)
        {
            if (realtimeView.isOwnedLocallyInHierarchy) return;
            if (_avatarController != null && value > 0)
            {
                _avatarController.PlayEmote(value);
            }
        }

        // =========================================================================
        // Helpers
        // =========================================================================

        private void ApplyRemoteState(AvatarSyncModel model)
        {
            if (!string.IsNullOrEmpty(model.equippedAvatarId))
            {
                LoadRemoteAvatar(model.equippedAvatarId);
            }

            if (!string.IsNullOrEmpty(model.equippedOutfitId))
            {
                LoadRemoteOutfit(model.equippedOutfitId);
            }

            if (!string.IsNullOrEmpty(model.equippedEffectId))
            {
                LoadRemoteEffect(model.equippedEffectId, model.effectStartTime);
            }

            ApplyColor("_SkinTone", model.skinTone);
            ApplyColor("_HairColor", model.hairColor);
            ApplyColor("_EyeColor", model.eyeColor);

            if (_nameLabel != null && !string.IsNullOrEmpty(model.displayName))
            {
                _nameLabel.text = model.displayName;
            }

            if (_avatarController != null)
            {
                _avatarController.SetVisible(model.isVisible);
            }
        }

        private async void LoadRemoteAvatar(string avatarId)
        {
            if (_avatarController == null || string.IsNullOrEmpty(avatarId)) return;

            var item = await InventoryManager.Instance?.GetItemInfoAsync(avatarId);
            if (item != null)
            {
                await _avatarController.LoadAvatarFromInventory(item);
            }
        }

        private async void LoadRemoteOutfit(string outfitId)
        {
            if (_avatarController == null || string.IsNullOrEmpty(outfitId)) return;

            var item = await InventoryManager.Instance?.GetItemInfoAsync(outfitId);
            if (item != null)
            {
                await _avatarController.LoadOutfitFromInventory(item);
            }
        }

        private async void LoadRemoteEffect(string effectId, double startTime)
        {
            if (_avatarController == null || string.IsNullOrEmpty(effectId)) return;

            var item = await InventoryManager.Instance?.GetItemInfoAsync(effectId);
            if (item != null)
            {
                // Calculate time offset for effect sync
                double elapsed = realtime.room.time - startTime;
                await _avatarController.LoadEffectFromInventory(item, (float)elapsed);
            }
        }

        private void ApplyColor(string propertyName, string hexColor)
        {
            if (_avatarController == null || string.IsNullOrEmpty(hexColor)) return;

            if (ColorUtility.TryParseHtmlString("#" + hexColor, out Color color))
            {
                _avatarController.SetMaterialColor(propertyName, color);
            }
        }
    }

    /// <summary>
    /// Represents the current avatar customization state.
    /// </summary>
    public class AvatarState
    {
        public string AvatarId { get; set; }
        public string OutfitId { get; set; }
        public string EffectId { get; set; }
        public Color SkinTone { get; set; } = Color.white;
        public Color HairColor { get; set; } = Color.black;
        public Color EyeColor { get; set; } = Color.blue;
    }
}
