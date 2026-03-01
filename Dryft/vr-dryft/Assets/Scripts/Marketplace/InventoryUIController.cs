using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.UI;
using TMPro;
using Drift.API;

namespace Drift.Marketplace
{
    /// <summary>
    /// Controls the VR inventory interface.
    /// Displays owned items, allows equipping/unequipping, and shows equipped loadout.
    /// </summary>
    public class InventoryUIController : MonoBehaviour
    {
        [Header("Tab References")]
        [SerializeField] private Button allTab;
        [SerializeField] private Button avatarsTab;
        [SerializeField] private Button outfitsTab;
        [SerializeField] private Button toysTab;
        [SerializeField] private Button effectsTab;
        [SerializeField] private Button gesturesTab;

        [Header("Grid")]
        [SerializeField] private Transform itemGridContainer;
        [SerializeField] private GameObject inventoryItemPrefab;

        [Header("Equipped Panel")]
        [SerializeField] private Transform equippedContainer;
        [SerializeField] private EquippedSlot avatarSlot;
        [SerializeField] private EquippedSlot outfitSlot;
        [SerializeField] private EquippedSlot toySlot;
        [SerializeField] private EquippedSlot effectSlot;
        [SerializeField] private EquippedSlot gestureSlot;

        [Header("Detail Panel")]
        [SerializeField] private GameObject detailPanel;
        [SerializeField] private Image detailThumbnail;
        [SerializeField] private TextMeshProUGUI detailName;
        [SerializeField] private TextMeshProUGUI detailType;
        [SerializeField] private TextMeshProUGUI detailDescription;
        [SerializeField] private Button equipButton;
        [SerializeField] private TextMeshProUGUI equipButtonText;
        [SerializeField] private Button closeDetailButton;

        [Header("States")]
        [SerializeField] private GameObject loadingIndicator;
        [SerializeField] private GameObject emptyState;
        [SerializeField] private TextMeshProUGUI emptyStateText;

        // Events
        public event Action<InventoryItem> OnItemEquipped;
        public event Action<InventoryItem> OnItemUnequipped;

        // State
        private ItemType? _currentFilter;
        private InventoryItem _selectedItem;
        private List<InventoryItemCard> _itemCards = new List<InventoryItemCard>();

        private void Start()
        {
            // Wire up tabs
            if (allTab != null)
                allTab.onClick.AddListener(() => FilterByType(null));
            if (avatarsTab != null)
                avatarsTab.onClick.AddListener(() => FilterByType(ItemType.Avatar));
            if (outfitsTab != null)
                outfitsTab.onClick.AddListener(() => FilterByType(ItemType.Outfit));
            if (toysTab != null)
                toysTab.onClick.AddListener(() => FilterByType(ItemType.Toy));
            if (effectsTab != null)
                effectsTab.onClick.AddListener(() => FilterByType(ItemType.Effect));
            if (gesturesTab != null)
                gesturesTab.onClick.AddListener(() => FilterByType(ItemType.Gesture));

            // Wire up detail panel
            if (closeDetailButton != null)
                closeDetailButton.onClick.AddListener(CloseDetailPanel);
            if (equipButton != null)
                equipButton.onClick.AddListener(OnEquipClicked);

            // Hide panels
            if (detailPanel != null)
                detailPanel.SetActive(false);
            if (loadingIndicator != null)
                loadingIndicator.SetActive(false);
            if (emptyState != null)
                emptyState.SetActive(false);

            // Subscribe to inventory events
            var inventory = InventoryManager.Instance;
            if (inventory != null)
            {
                inventory.OnInventoryLoaded += RefreshUI;
                inventory.OnItemEquipped += OnInventoryItemEquipped;
                inventory.OnItemUnequipped += OnInventoryItemUnequipped;
                inventory.OnItemAcquired += OnInventoryItemAcquired;
            }

            // Initial load
            _ = InitializeAsync();
        }

        private async Task InitializeAsync()
        {
            var inventory = InventoryManager.Instance;
            if (inventory == null) return;

            if (!inventory.IsLoaded || inventory.NeedsRefresh())
            {
                ShowLoading(true);
                await inventory.RefreshInventoryAsync();
                ShowLoading(false);
            }

            RefreshUI();
        }

        /// <summary>
        /// Refreshes the entire UI.
        /// </summary>
        public void RefreshUI()
        {
            RefreshGrid();
            RefreshEquippedSlots();
        }

        private void RefreshGrid()
        {
            ClearGrid();

            var inventory = InventoryManager.Instance;
            if (inventory == null) return;

            List<InventoryItem> items;

            if (_currentFilter.HasValue)
            {
                items = inventory.GetItemsByType(_currentFilter.Value);
            }
            else
            {
                items = new List<InventoryItem>(inventory.Items);
            }

            if (items.Count == 0)
            {
                ShowEmptyState(_currentFilter.HasValue
                    ? $"No {_currentFilter.Value}s in your inventory"
                    : "Your inventory is empty");
                return;
            }

            if (emptyState != null)
                emptyState.SetActive(false);

            foreach (var item in items)
            {
                CreateItemCard(item);
            }
        }

        private void CreateItemCard(InventoryItem item)
        {
            if (itemGridContainer == null || inventoryItemPrefab == null)
                return;

            var cardObj = Instantiate(inventoryItemPrefab, itemGridContainer);
            var card = cardObj.GetComponent<InventoryItemCard>();

            if (card != null)
            {
                card.Setup(item);
                card.OnClicked += OnItemCardClicked;
                _itemCards.Add(card);
            }
        }

        private void ClearGrid()
        {
            foreach (var card in _itemCards)
            {
                if (card != null)
                {
                    card.OnClicked -= OnItemCardClicked;
                    Destroy(card.gameObject);
                }
            }
            _itemCards.Clear();
        }

        private void RefreshEquippedSlots()
        {
            var inventory = InventoryManager.Instance;
            if (inventory == null) return;

            UpdateEquippedSlot(avatarSlot, inventory.GetEquippedItem(ItemType.Avatar));
            UpdateEquippedSlot(outfitSlot, inventory.GetEquippedItem(ItemType.Outfit));
            UpdateEquippedSlot(toySlot, inventory.GetEquippedItem(ItemType.Toy));
            UpdateEquippedSlot(effectSlot, inventory.GetEquippedItem(ItemType.Effect));
            UpdateEquippedSlot(gestureSlot, inventory.GetEquippedItem(ItemType.Gesture));
        }

        private void UpdateEquippedSlot(EquippedSlot slot, InventoryItem item)
        {
            if (slot == null) return;

            if (item != null)
            {
                slot.SetItem(item);
            }
            else
            {
                slot.Clear();
            }
        }

        private void FilterByType(ItemType? type)
        {
            _currentFilter = type;
            RefreshGrid();
        }

        private void OnItemCardClicked(InventoryItem item)
        {
            ShowItemDetail(item);
        }

        /// <summary>
        /// Shows the detail panel for an inventory item.
        /// </summary>
        public void ShowItemDetail(InventoryItem item)
        {
            _selectedItem = item;

            if (detailPanel == null || item.item == null) return;

            detailPanel.SetActive(true);

            if (detailName != null)
                detailName.text = item.item.name;
            if (detailType != null)
                detailType.text = item.item.ItemType.ToString();
            if (detailDescription != null)
                detailDescription.text = item.item.description;

            UpdateEquipButton(item);

            // Load thumbnail
            if (detailThumbnail != null && !string.IsNullOrEmpty(item.item.thumbnail_url))
            {
                _ = LoadThumbnailAsync(item.item.thumbnail_url, detailThumbnail);
            }
        }

        private void UpdateEquipButton(InventoryItem item)
        {
            if (equipButton == null || equipButtonText == null)
                return;

            if (item.is_equipped)
            {
                equipButtonText.text = "Unequip";
            }
            else
            {
                equipButtonText.text = "Equip";
            }
        }

        public void CloseDetailPanel()
        {
            if (detailPanel != null)
                detailPanel.SetActive(false);
            _selectedItem = null;
        }

        private async void OnEquipClicked()
        {
            if (_selectedItem == null) return;

            var inventory = InventoryManager.Instance;
            if (inventory == null) return;

            equipButton.interactable = false;
            equipButtonText.text = "...";

            bool success;

            if (_selectedItem.is_equipped)
            {
                success = await inventory.UnequipItemAsync(_selectedItem.item_id);
            }
            else
            {
                success = await inventory.EquipItemAsync(_selectedItem.item_id);
            }

            if (success)
            {
                UpdateEquipButton(_selectedItem);
                RefreshUI();
            }
            else
            {
                equipButtonText.text = "Failed";
                await Task.Delay(1000);
                UpdateEquipButton(_selectedItem);
            }

            equipButton.interactable = true;
        }

        private void OnInventoryItemEquipped(InventoryItem item)
        {
            RefreshEquippedSlots();

            // Update cards
            foreach (var card in _itemCards)
            {
                if (card.Item?.item_id == item.item_id)
                {
                    card.SetEquipped(true);
                }
                else if (card.Item?.item?.ItemType == item.item?.ItemType)
                {
                    card.SetEquipped(false);
                }
            }

            OnItemEquipped?.Invoke(item);
        }

        private void OnInventoryItemUnequipped(InventoryItem item)
        {
            RefreshEquippedSlots();

            foreach (var card in _itemCards)
            {
                if (card.Item?.item_id == item.item_id)
                {
                    card.SetEquipped(false);
                }
            }

            OnItemUnequipped?.Invoke(item);
        }

        private void OnInventoryItemAcquired(InventoryItem item)
        {
            // Refresh to show new item
            RefreshGrid();
        }

        private void ShowLoading(bool show)
        {
            if (loadingIndicator != null)
                loadingIndicator.SetActive(show);
        }

        private void ShowEmptyState(string message)
        {
            if (emptyState != null)
            {
                emptyState.SetActive(true);
                if (emptyStateText != null)
                    emptyStateText.text = message;
            }
        }

        private async Task LoadThumbnailAsync(string url, Image target)
        {
            try
            {
                using var request = UnityEngine.Networking.UnityWebRequestTexture.GetTexture(url);
                var operation = request.SendWebRequest();

                while (!operation.isDone)
                {
                    await Task.Yield();
                }

                if (request.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
                {
                    var texture = UnityEngine.Networking.DownloadHandlerTexture.GetContent(request);
                    target.sprite = Sprite.Create(
                        texture,
                        new Rect(0, 0, texture.width, texture.height),
                        new Vector2(0.5f, 0.5f));
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[InventoryUI] Failed to load thumbnail: {ex.Message}");
            }
        }

        private void OnDestroy()
        {
            var inventory = InventoryManager.Instance;
            if (inventory != null)
            {
                inventory.OnInventoryLoaded -= RefreshUI;
                inventory.OnItemEquipped -= OnInventoryItemEquipped;
                inventory.OnItemUnequipped -= OnInventoryItemUnequipped;
                inventory.OnItemAcquired -= OnInventoryItemAcquired;
            }
        }
    }

    /// <summary>
    /// Card for displaying an inventory item.
    /// </summary>
    public class InventoryItemCard : MonoBehaviour
    {
        [SerializeField] private Image thumbnailImage;
        [SerializeField] private TextMeshProUGUI nameText;
        [SerializeField] private GameObject equippedIndicator;
        [SerializeField] private Button button;

        public event Action<InventoryItem> OnClicked;

        public InventoryItem Item { get; private set; }

        public void Setup(InventoryItem item)
        {
            Item = item;

            if (nameText != null && item.item != null)
                nameText.text = item.item.name;

            if (equippedIndicator != null)
                equippedIndicator.SetActive(item.is_equipped);

            if (button != null)
                button.onClick.AddListener(() => OnClicked?.Invoke(item));

            if (thumbnailImage != null && item.item != null && !string.IsNullOrEmpty(item.item.thumbnail_url))
            {
                _ = LoadThumbnailAsync(item.item.thumbnail_url);
            }
        }

        public void SetEquipped(bool equipped)
        {
            if (Item != null)
                Item.is_equipped = equipped;

            if (equippedIndicator != null)
                equippedIndicator.SetActive(equipped);
        }

        private async Task LoadThumbnailAsync(string url)
        {
            try
            {
                using var request = UnityEngine.Networking.UnityWebRequestTexture.GetTexture(url);
                var operation = request.SendWebRequest();

                while (!operation.isDone)
                {
                    await Task.Yield();
                }

                if (this == null || thumbnailImage == null) return;

                if (request.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
                {
                    var texture = UnityEngine.Networking.DownloadHandlerTexture.GetContent(request);
                    thumbnailImage.sprite = Sprite.Create(
                        texture,
                        new Rect(0, 0, texture.width, texture.height),
                        new Vector2(0.5f, 0.5f));
                }
            }
            catch { }
        }
    }

    /// <summary>
    /// Slot for displaying an equipped item.
    /// </summary>
    [Serializable]
    public class EquippedSlot : MonoBehaviour
    {
        [SerializeField] private Image thumbnailImage;
        [SerializeField] private TextMeshProUGUI nameText;
        [SerializeField] private TextMeshProUGUI typeText;
        [SerializeField] private GameObject emptyState;
        [SerializeField] private GameObject filledState;

        public InventoryItem CurrentItem { get; private set; }

        public void SetItem(InventoryItem item)
        {
            CurrentItem = item;

            if (emptyState != null)
                emptyState.SetActive(false);
            if (filledState != null)
                filledState.SetActive(true);

            if (nameText != null && item.item != null)
                nameText.text = item.item.name;
            if (typeText != null && item.item != null)
                typeText.text = item.item.ItemType.ToString();

            if (thumbnailImage != null && item.item != null && !string.IsNullOrEmpty(item.item.thumbnail_url))
            {
                _ = LoadThumbnailAsync(item.item.thumbnail_url);
            }
        }

        public void Clear()
        {
            CurrentItem = null;

            if (emptyState != null)
                emptyState.SetActive(true);
            if (filledState != null)
                filledState.SetActive(false);
        }

        private async Task LoadThumbnailAsync(string url)
        {
            try
            {
                using var request = UnityEngine.Networking.UnityWebRequestTexture.GetTexture(url);
                var operation = request.SendWebRequest();

                while (!operation.isDone)
                {
                    await Task.Yield();
                }

                if (this == null || thumbnailImage == null) return;

                if (request.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
                {
                    var texture = UnityEngine.Networking.DownloadHandlerTexture.GetContent(request);
                    thumbnailImage.sprite = Sprite.Create(
                        texture,
                        new Rect(0, 0, texture.width, texture.height),
                        new Vector2(0.5f, 0.5f));
                }
            }
            catch { }
        }
    }
}
