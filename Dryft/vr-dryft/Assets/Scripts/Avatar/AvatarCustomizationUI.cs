using UnityEngine;
using UnityEngine.UI;
using TMPro;
using System.Collections.Generic;
using Drift.Marketplace;
using Drift.Player;

namespace Drift.Avatar
{
    /// <summary>
    /// UI for customizing the player's avatar.
    /// Displays inventory items and allows equipping/previewing.
    /// </summary>
    public class AvatarCustomizationUI : MonoBehaviour
    {
        [Header("UI References")]
        [SerializeField] private GameObject _panel;
        [SerializeField] private Transform _avatarTabContent;
        [SerializeField] private Transform _outfitTabContent;
        [SerializeField] private Transform _effectTabContent;
        [SerializeField] private GameObject _itemCardPrefab;

        [Header("Tab Buttons")]
        [SerializeField] private Button _avatarTabButton;
        [SerializeField] private Button _outfitTabButton;
        [SerializeField] private Button _effectTabButton;

        [Header("Color Customization")]
        [SerializeField] private Slider _skinToneR;
        [SerializeField] private Slider _skinToneG;
        [SerializeField] private Slider _skinToneB;
        [SerializeField] private Slider _hairColorR;
        [SerializeField] private Slider _hairColorG;
        [SerializeField] private Slider _hairColorB;
        [SerializeField] private Slider _eyeColorR;
        [SerializeField] private Slider _eyeColorG;
        [SerializeField] private Slider _eyeColorB;

        [Header("Preview")]
        [SerializeField] private RawImage _previewImage;
        [SerializeField] private Camera _previewCamera;
        [SerializeField] private Transform _previewAvatarRoot;

        [Header("Buttons")]
        [SerializeField] private Button _closeButton;
        [SerializeField] private Button _saveButton;
        [SerializeField] private Button _resetButton;

        [Header("Status")]
        [SerializeField] private TextMeshProUGUI _statusText;
        [SerializeField] private GameObject _loadingIndicator;

        private InventoryManager _inventory;
        private AvatarController _localAvatar;
        private AvatarSync _avatarSync;

        private ItemType _currentTab = ItemType.Avatar;
        private Dictionary<string, GameObject> _itemCards = new();
        private string _previewingItemId;

        // Saved colors for reset
        private Color _savedSkinTone;
        private Color _savedHairColor;
        private Color _savedEyeColor;

        private void Awake()
        {
            if (_panel != null)
            {
                _panel.SetActive(false);
            }
        }

        private void Start()
        {
            _inventory = InventoryManager.Instance;

            // Setup tab buttons
            _avatarTabButton?.onClick.AddListener(() => SwitchTab(ItemType.Avatar));
            _outfitTabButton?.onClick.AddListener(() => SwitchTab(ItemType.Outfit));
            _effectTabButton?.onClick.AddListener(() => SwitchTab(ItemType.Effect));

            // Setup action buttons
            _closeButton?.onClick.AddListener(Close);
            _saveButton?.onClick.AddListener(SaveChanges);
            _resetButton?.onClick.AddListener(ResetChanges);

            // Setup color sliders
            SetupColorSliders();

            // Subscribe to inventory changes
            if (_inventory != null)
            {
                _inventory.OnInventoryLoaded += RefreshCurrentTab;
                _inventory.OnItemEquipped += OnItemEquipped;
                _inventory.OnItemUnequipped += OnItemUnequipped;
            }
        }

        private void SetupColorSliders()
        {
            void SetupSliderGroup(Slider r, Slider g, Slider b, System.Action<Color> onChange)
            {
                if (r == null || g == null || b == null) return;

                r.onValueChanged.AddListener(_ => onChange(new Color(r.value, g.value, b.value)));
                g.onValueChanged.AddListener(_ => onChange(new Color(r.value, g.value, b.value)));
                b.onValueChanged.AddListener(_ => onChange(new Color(r.value, g.value, b.value)));
            }

            SetupSliderGroup(_skinToneR, _skinToneG, _skinToneB, OnSkinToneChanged);
            SetupSliderGroup(_hairColorR, _hairColorG, _hairColorB, OnHairColorChanged);
            SetupSliderGroup(_eyeColorR, _eyeColorG, _eyeColorB, OnEyeColorChanged);
        }

        /// <summary>
        /// Opens the customization panel.
        /// </summary>
        public void Open()
        {
            // Find local avatar
            _localAvatar = FindLocalAvatar();
            _avatarSync = _localAvatar?.GetComponent<AvatarSync>();

            if (_localAvatar == null)
            {
                Debug.LogWarning("[AvatarCustomizationUI] No local avatar found");
                return;
            }

            // Save current state for reset
            SaveCurrentState();

            // Refresh inventory if needed
            if (_inventory != null && _inventory.NeedsRefresh())
            {
                _ = _inventory.RefreshInventoryAsync();
            }

            // Show panel
            _panel?.SetActive(true);
            SwitchTab(ItemType.Avatar);

            Debug.Log("[AvatarCustomizationUI] Opened");
        }

        /// <summary>
        /// Closes the customization panel.
        /// </summary>
        public void Close()
        {
            _panel?.SetActive(false);
            _previewingItemId = null;
            Debug.Log("[AvatarCustomizationUI] Closed");
        }

        private AvatarController FindLocalAvatar()
        {
            var avatars = FindObjectsOfType<AvatarController>();
            foreach (var avatar in avatars)
            {
                if (avatar.IsLocalAvatar)
                {
                    return avatar;
                }
            }
            return null;
        }

        private void SaveCurrentState()
        {
            if (_localAvatar == null) return;

            var state = _localAvatar.GetCurrentState();
            _savedSkinTone = state.SkinTone;
            _savedHairColor = state.HairColor;
            _savedEyeColor = state.EyeColor;

            // Update sliders to current values
            SetSliderColor(_skinToneR, _skinToneG, _skinToneB, _savedSkinTone);
            SetSliderColor(_hairColorR, _hairColorG, _hairColorB, _savedHairColor);
            SetSliderColor(_eyeColorR, _eyeColorG, _eyeColorB, _savedEyeColor);
        }

        private void SetSliderColor(Slider r, Slider g, Slider b, Color color)
        {
            if (r != null) r.SetValueWithoutNotify(color.r);
            if (g != null) g.SetValueWithoutNotify(color.g);
            if (b != null) b.SetValueWithoutNotify(color.b);
        }

        private void SwitchTab(ItemType tab)
        {
            _currentTab = tab;

            // Update tab button states
            UpdateTabButtonState(_avatarTabButton, tab == ItemType.Avatar);
            UpdateTabButtonState(_outfitTabButton, tab == ItemType.Outfit);
            UpdateTabButtonState(_effectTabButton, tab == ItemType.Effect);

            // Show/hide content
            _avatarTabContent?.gameObject.SetActive(tab == ItemType.Avatar);
            _outfitTabContent?.gameObject.SetActive(tab == ItemType.Outfit);
            _effectTabContent?.gameObject.SetActive(tab == ItemType.Effect);

            RefreshCurrentTab();
        }

        private void UpdateTabButtonState(Button button, bool selected)
        {
            if (button == null) return;

            var colors = button.colors;
            colors.normalColor = selected ? new Color(0.9f, 0.3f, 0.4f) : new Color(0.2f, 0.2f, 0.3f);
            button.colors = colors;
        }

        private void RefreshCurrentTab()
        {
            Transform content = _currentTab switch
            {
                ItemType.Avatar => _avatarTabContent,
                ItemType.Outfit => _outfitTabContent,
                ItemType.Effect => _effectTabContent,
                _ => null
            };

            if (content == null || _inventory == null) return;

            // Clear existing cards
            foreach (Transform child in content)
            {
                Destroy(child.gameObject);
            }
            _itemCards.Clear();

            // Get items of this type
            var items = _inventory.GetItemsByType(_currentTab);
            var equipped = _inventory.GetEquippedItem(_currentTab);

            foreach (var item in items)
            {
                CreateItemCard(content, item, item.item_id == equipped?.item_id);
            }

            // Update status
            if (_statusText != null)
            {
                _statusText.text = $"{items.Count} {_currentTab}s available";
            }
        }

        private void CreateItemCard(Transform parent, InventoryItem item, bool isEquipped)
        {
            if (_itemCardPrefab == null || item?.item == null) return;

            var card = Instantiate(_itemCardPrefab, parent);
            card.name = $"ItemCard_{item.item_id}";
            _itemCards[item.item_id] = card;

            // Setup card UI
            var nameText = card.GetComponentInChildren<TextMeshProUGUI>();
            if (nameText != null)
            {
                nameText.text = item.item.name;
            }

            // Setup equipped indicator
            var equippedIndicator = card.transform.Find("EquippedIndicator");
            if (equippedIndicator != null)
            {
                equippedIndicator.gameObject.SetActive(isEquipped);
            }

            // Setup button
            var button = card.GetComponent<Button>();
            if (button != null)
            {
                button.onClick.AddListener(() => OnItemCardClicked(item));
            }

            // Load thumbnail (if available)
            LoadItemThumbnail(card, item);
        }

        private async void LoadItemThumbnail(GameObject card, InventoryItem item)
        {
            if (item?.item == null || string.IsNullOrEmpty(item.item.thumbnail_url)) return;

            var image = card.transform.Find("Thumbnail")?.GetComponent<RawImage>();
            if (image == null) return;

            try
            {
                var request = UnityEngine.Networking.UnityWebRequestTexture.GetTexture(item.item.thumbnail_url);
                var operation = request.SendWebRequest();

                while (!operation.isDone)
                {
                    await System.Threading.Tasks.Task.Yield();
                }

                if (request.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
                {
                    var texture = UnityEngine.Networking.DownloadHandlerTexture.GetContent(request);
                    if (card != null && image != null)
                    {
                        image.texture = texture;
                    }
                }
            }
            catch (System.Exception ex)
            {
                Debug.LogWarning($"[AvatarCustomizationUI] Failed to load thumbnail: {ex.Message}");
            }
        }

        private async void OnItemCardClicked(InventoryItem item)
        {
            if (item == null || _inventory == null) return;

            ShowLoading(true);

            var equipped = _inventory.GetEquippedItem(_currentTab);

            if (equipped?.item_id == item.item_id)
            {
                // Unequip
                await _inventory.UnequipItemAsync(item.item_id);
            }
            else
            {
                // Equip
                await _inventory.EquipItemAsync(item.item_id);
            }

            ShowLoading(false);
        }

        private void OnItemEquipped(InventoryItem item)
        {
            if (item?.item?.ItemType != _currentTab) return;

            RefreshCurrentTab();

            // Sync to network
            if (_avatarSync != null)
            {
                switch (item.item.ItemType)
                {
                    case ItemType.Avatar:
                        _avatarSync.SetEquippedAvatar(item.item_id);
                        break;
                    case ItemType.Outfit:
                        _avatarSync.SetEquippedOutfit(item.item_id);
                        break;
                    case ItemType.Effect:
                        _avatarSync.SetEquippedEffect(item.item_id);
                        break;
                }
            }
        }

        private void OnItemUnequipped(InventoryItem item)
        {
            if (item?.item?.ItemType != _currentTab) return;
            RefreshCurrentTab();
        }

        private void OnSkinToneChanged(Color color)
        {
            if (_localAvatar != null)
            {
                _localAvatar.SetMaterialColor("_SkinTone", color);
            }
        }

        private void OnHairColorChanged(Color color)
        {
            if (_localAvatar != null)
            {
                _localAvatar.SetMaterialColor("_HairColor", color);
            }
        }

        private void OnEyeColorChanged(Color color)
        {
            if (_localAvatar != null)
            {
                _localAvatar.SetMaterialColor("_EyeColor", color);
            }
        }

        private void SaveChanges()
        {
            if (_localAvatar == null || _avatarSync == null) return;

            // Get current slider colors
            Color skinTone = new Color(
                _skinToneR?.value ?? _savedSkinTone.r,
                _skinToneG?.value ?? _savedSkinTone.g,
                _skinToneB?.value ?? _savedSkinTone.b
            );

            Color hairColor = new Color(
                _hairColorR?.value ?? _savedHairColor.r,
                _hairColorG?.value ?? _savedHairColor.g,
                _hairColorB?.value ?? _savedHairColor.b
            );

            Color eyeColor = new Color(
                _eyeColorR?.value ?? _savedEyeColor.r,
                _eyeColorG?.value ?? _savedEyeColor.g,
                _eyeColorB?.value ?? _savedEyeColor.b
            );

            // Sync colors to network
            _avatarSync.SetColors(skinTone, hairColor, eyeColor);

            // Update saved state
            _savedSkinTone = skinTone;
            _savedHairColor = hairColor;
            _savedEyeColor = eyeColor;

            if (_statusText != null)
            {
                _statusText.text = "Changes saved!";
            }

            Debug.Log("[AvatarCustomizationUI] Changes saved and synced");
        }

        private void ResetChanges()
        {
            if (_localAvatar == null) return;

            // Reset colors to saved values
            _localAvatar.SetColors(_savedSkinTone, _savedHairColor, _savedEyeColor);

            // Reset sliders
            SetSliderColor(_skinToneR, _skinToneG, _skinToneB, _savedSkinTone);
            SetSliderColor(_hairColorR, _hairColorG, _hairColorB, _savedHairColor);
            SetSliderColor(_eyeColorR, _eyeColorG, _eyeColorB, _savedEyeColor);

            if (_statusText != null)
            {
                _statusText.text = "Changes reset";
            }

            Debug.Log("[AvatarCustomizationUI] Changes reset");
        }

        private void ShowLoading(bool show)
        {
            if (_loadingIndicator != null)
            {
                _loadingIndicator.SetActive(show);
            }
        }

        private void OnDestroy()
        {
            if (_inventory != null)
            {
                _inventory.OnInventoryLoaded -= RefreshCurrentTab;
                _inventory.OnItemEquipped -= OnItemEquipped;
                _inventory.OnItemUnequipped -= OnItemUnequipped;
            }
        }
    }
}
